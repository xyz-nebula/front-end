import { useCallback, useEffect, useRef, useState } from 'react'

import { useDomainServices } from '@/services/domainServices'
import type { AudioClient } from '@/services/contracts/audioClient'
import type { AudioConnectionState, AudioEngineEvent, AudioTranscriptDrafts } from '@/types/audio'
import type { NegotiationMessage } from '@/types/negotiation'

interface ArenaAudioState {
  state: AudioConnectionState
  partial: AudioTranscriptDrafts
  error: string | null
  isPlaying: boolean
  connect: () => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => Promise<void>
}

export function useArenaAudio(
  sessionId: string,
  enabled: boolean,
  onCommitted: (message: NegotiationMessage) => void,
  onReconnect: () => Promise<{ messages: NegotiationMessage[] } | null>,
): ArenaAudioState {
  const { createAudioClient, negotiationClient } = useDomainServices()
  const [state, setState] = useState<AudioConnectionState>('idle')
  const [partial, setPartial] = useState({ user: '', ai: '' })
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const clientRef = useRef<AudioClient | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const captureStreamRef = useRef<MediaStream | null>(null)
  const captureSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const captureNodeRef = useRef<AudioWorkletNode | null>(null)
  const captureMuteRef = useRef<GainNode | null>(null)
  const sourceRefs = useRef(new Set<AudioBufferSourceNode>())
  const playbackEndRef = useRef(0)
  const playbackGenerationRef = useRef(0)
  const eventIdsRef = useRef(new Set<string>())
  const committedMessageIdsRef = useRef(new Set<string>())
  const contextGenerationRef = useRef(0)
  const connectAttemptRef = useRef(0)
  const busyRef = useRef(false)
  const onCommittedRef = useRef(onCommitted)
  const onReconnectRef = useRef(onReconnect)
  const transcriptSyncRef = useRef({ user: 0, ai: 0 })

  useEffect(() => { onCommittedRef.current = onCommitted }, [onCommitted])
  useEffect(() => { onReconnectRef.current = onReconnect }, [onReconnect])

  const stopCapture = useCallback(() => {
    const node = captureNodeRef.current
    if (node) {
      node.port.onmessage = null
      node.port.postMessage('reset')
      node.disconnect()
    }
    captureSourceRef.current?.disconnect()
    captureMuteRef.current?.disconnect()
    captureStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null
      track.stop()
    })
    captureNodeRef.current = null
    captureSourceRef.current = null
    captureMuteRef.current = null
    captureStreamRef.current = null
  }, [])

  const startCapture = useCallback(async (client: AudioClient, isCurrent: () => boolean) => {
    if (!client.acceptsAudioInput) return
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Этот браузер не поддерживает захват звука.')
    }
    stopCapture()
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (error) {
      throw new Error(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Разрешите доступ к микрофону и подключитесь снова.'
          : 'Не удалось подключить микрофон. Проверьте выбранное устройство.',
        { cause: error },
      )
    }
    if (!isCurrent()) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    captureStreamRef.current = stream

    const context = contextRef.current ?? new AudioContext()
    contextRef.current = context
    await context.audioWorklet.addModule('/pcm-capture-worklet.js')
    if (!isCurrent()) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    const source = context.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(context, 'pcm-capture-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
    })
    const mute = context.createGain()
    mute.gain.value = 0
    source.connect(node).connect(mute).connect(context.destination)
    node.port.onmessage = (message: MessageEvent<ArrayBuffer>) => {
      if (!isCurrent()) return
      try {
        const bytes = new Uint8Array(message.data)
        let binary = ''
        for (const byte of bytes) binary += String.fromCharCode(byte)
        client.sendAudio(btoa(binary))
      } catch (caught) {
        stopCapture()
        setError(caught instanceof Error ? caught.message : 'Не удалось передать звук. Подключитесь снова.')
      }
    }
    const handleEnded = () => {
      if (!isCurrent()) return
      stopCapture()
      setError('Микрофон отключён. Подключите устройство и начните разговор снова.')
    }
    stream.getAudioTracks().forEach((track) => { track.onended = handleEnded })
    captureSourceRef.current = source
    captureNodeRef.current = node
    captureMuteRef.current = mute
    await context.resume()
  }, [stopCapture])

  const stopPlayback = useCallback(() => {
    playbackGenerationRef.current += 1
    for (const source of sourceRefs.current) {
      source.onended = null
      try {
        source.stop()
      } catch {
        // A source may already have ended between cleanup scheduling and stop().
      }
    }
    sourceRefs.current.clear()
    playbackEndRef.current = 0
    setIsPlaying(false)
  }, [])

  const playFrame = useCallback((
    event: Extract<AudioEngineEvent, { type: 'audio_frame' }>,
    isCurrent: () => boolean,
  ) => {
    if (!isCurrent()) return
    try {
      const bytes = Uint8Array.from(atob(event.payload), (character) => character.charCodeAt(0))
      if (bytes.length < 2 || bytes.length % 2 !== 0) return
      const context = contextRef.current ?? new AudioContext()
      contextRef.current = context
      void context.resume().catch(() => {
        if (isCurrent()) {
          stopPlayback()
          setError('Не удалось воспроизвести ответ. Текст ответа сохранён в диалоге.')
        }
      })
      const buffer = context.createBuffer(1, bytes.length / 2, event.format.sampleRate)
      const samples = buffer.getChannelData(0)
      const view = new DataView(bytes.buffer)
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = view.getInt16(index * 2, true) / 32768
      }
      if (!isCurrent()) return
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      const playbackGeneration = playbackGenerationRef.current
      const startAt = Math.max(context.currentTime, playbackEndRef.current)
      source.onended = () => {
        if (isCurrent() && playbackGenerationRef.current === playbackGeneration) {
          sourceRefs.current.delete(source)
          if (sourceRefs.current.size === 0) {
            playbackEndRef.current = 0
            setIsPlaying(false)
          }
        }
      }
      source.start(startAt)
      sourceRefs.current.add(source)
      playbackEndRef.current = startAt + buffer.duration
      setIsPlaying(true)
    } catch {
      if (isCurrent()) setError('Не удалось воспроизвести ответ. Текст ответа сохранён в диалоге.')
    }
  }, [stopPlayback])

  useEffect(() => {
    if (!enabled) return
    const generation = ++contextGenerationRef.current
    connectAttemptRef.current += 1
    busyRef.current = false
    eventIdsRef.current = new Set<string>()
    committedMessageIdsRef.current = new Set<string>()
    const client = createAudioClient()
    clientRef.current = client
    const playbackSources = sourceRefs.current
    const eventIds = eventIdsRef.current
    const committedMessageIds = committedMessageIdsRef.current
    const transcriptSync = transcriptSyncRef.current
    const isCurrent = () => contextGenerationRef.current === generation && clientRef.current === client
    queueMicrotask(() => {
      if (!isCurrent()) return
      setState('idle')
      setPartial({ user: '', ai: '' })
      setError(null)
      stopPlayback()
    })
    const unsubscribeEvent = client.subscribe((event) => {
      if (!isCurrent()) return
      if (event.type === 'transcript') {
        setPartial((current) => ({ ...current, [event.speaker]: event.text }))
        const syncId = ++transcriptSync[event.speaker]
        void (async () => {
          for (const delay of [250, 500, 1_000, 1_500, 2_000]) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, delay))
            if (!isCurrent() || transcriptSync[event.speaker] !== syncId) return
            const refreshed = await onReconnectRef.current()
            if (!isCurrent() || transcriptSync[event.speaker] !== syncId) return
            const persisted = refreshed?.messages.some(
              (message) => message.speaker === event.speaker && message.text === event.text,
            )
            if (persisted) {
              setPartial((current) => ({ ...current, [event.speaker]: '' }))
              return
            }
          }
          if (isCurrent() && transcriptSync[event.speaker] === syncId) {
            setError('Реплика получена, но пока не появилась в истории. Обновите диалог позже.')
          }
        })()
      } else if (event.type === 'transcript_partial') {
        setPartial((current) => ({ ...current, [event.speaker]: event.text }))
      } else if (event.type === 'message_committed') {
        if (eventIds.has(event.eventId) || committedMessageIds.has(event.message.id)) return
        eventIds.add(event.eventId)
        committedMessageIds.add(event.message.id)
        setPartial((current) => ({ ...current, [event.message.speaker]: '' }))
        onCommittedRef.current(event.message)
      } else if (event.type === 'audio_frame') {
        playFrame(event, isCurrent)
      } else if (event.type === 'error') {
        setPartial({ user: '', ai: '' })
        setError(event.message)
      } else if (event.type === 'closed') {
        setPartial({ user: '', ai: '' })
        stopPlayback()
      } else if (event.type === 'auth_error') {
        setError('Обновляем авторизацию голосового подключения…')
      }
    })
    const unsubscribeState = client.subscribeState((nextState) => {
      if (isCurrent()) setState(nextState)
    })
    return () => {
      contextGenerationRef.current += 1
      transcriptSync.user += 1
      transcriptSync.ai += 1
      connectAttemptRef.current += 1
      busyRef.current = false
      unsubscribeEvent()
      unsubscribeState()
      void client.disconnect().catch(() => {
        // The transport may already be unavailable; local cleanup below is mandatory.
      })
      if (clientRef.current === client) clientRef.current = null
      stopCapture()
      eventIds.clear()
      committedMessageIds.clear()
      playbackGenerationRef.current += 1
      for (const source of playbackSources) {
        source.onended = null
        try {
          source.stop()
        } catch {
          // Best-effort cleanup for sources that ended concurrently.
        }
      }
      playbackSources.clear()
      playbackEndRef.current = 0
      void contextRef.current?.close()
      contextRef.current = null
    }
  }, [createAudioClient, enabled, negotiationClient, playFrame, sessionId, stopCapture, stopPlayback])

  useEffect(() => {
    if (!enabled || !navigator.mediaDevices?.addEventListener) return
    const handleDeviceChange = () => {
      if (!captureStreamRef.current) return
      stopCapture()
      setError('Состав аудиоустройств изменился. Подключитесь к голосовому раунду снова.')
      void clientRef.current?.disconnect()
    }
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
  }, [enabled, stopCapture])

  const connect = useCallback(async () => {
    const client = clientRef.current
    if (!enabled || !client || busyRef.current) return
    const contextGeneration = contextGenerationRef.current
    const attempt = ++connectAttemptRef.current
    const isCurrent = () => contextGenerationRef.current === contextGeneration
      && connectAttemptRef.current === attempt
      && clientRef.current === client
    setError(null)
    try {
      const context = contextRef.current ?? new AudioContext()
      contextRef.current = context
      void context.resume().catch(() => {
        if (isCurrent()) setError('Не удалось включить звук. Текст ответа будет доступен в диалоге.')
      })
    } catch {
      setError('Звук недоступен в этом браузере. Текст ответа будет доступен в диалоге.')
    }
    busyRef.current = true
    setPartial({ user: '', ai: '' })
    eventIdsRef.current.clear()
    try {
      await onReconnectRef.current()
      if (!isCurrent()) return
      await negotiationClient.activateSession(sessionId)
      if (!isCurrent()) return
      const ticket = client.requiresTicket
        ? await negotiationClient.createAudioTicket(sessionId)
        : undefined
      if (!isCurrent()) return
      await client.connect({ sessionId, ...(ticket ? { ticket } : {}) })
      if (!isCurrent()) return
      await startCapture(client, isCurrent)
    } catch (caught) {
      if (isCurrent()) {
        stopCapture()
        await client.disconnect().catch(() => undefined)
        setError(caught instanceof Error ? caught.message : 'Не удалось подключить голосовой диалог.')
        setState('error')
      }
    } finally {
      if (isCurrent()) busyRef.current = false
    }
  }, [enabled, negotiationClient, sessionId, startCapture, stopCapture])

  const stop = useCallback(async () => {
    connectAttemptRef.current += 1
    busyRef.current = false
    const client = clientRef.current
    let transportFailed = false
    try {
      client?.sendControl('stop')
    } catch {
      transportFailed = true
    }
    try {
      await client?.disconnect()
    } catch {
      transportFailed = true
    } finally {
      stopCapture()
      stopPlayback()
      setPartial({ user: '', ai: '' })
      setState('stopped')
      if (transportFailed) {
        setError('Аудиосвязь недоступна. Локальные ресурсы освобождены, тренировку можно завершить.')
      }
    }
  }, [stopCapture, stopPlayback])

  const pause = useCallback(() => {
    captureNodeRef.current?.port.postMessage('pause')
    try {
      clientRef.current?.sendControl('pause')
    } catch {
      setError('Не удалось приостановить голосовой раунд.')
    }
    const context = contextRef.current
    const generation = contextGenerationRef.current
    void context?.suspend().catch(() => {
      if (contextGenerationRef.current === generation && contextRef.current === context) {
        setError('Не удалось приостановить звук. Текст ответа сохранён в диалоге.')
      }
    })
  }, [])

  const resume = useCallback(() => {
    captureNodeRef.current?.port.postMessage('resume')
    try {
      clientRef.current?.sendControl('resume')
    } catch {
      setError('Не удалось продолжить голосовой раунд.')
    }
    const context = contextRef.current
    const generation = contextGenerationRef.current
    void context?.resume().catch(() => {
      if (contextGenerationRef.current === generation && contextRef.current === context) {
        setError('Не удалось продолжить звук. Текст ответа сохранён в диалоге.')
      }
    })
  }, [])

  return {
    state,
    partial,
    error,
    isPlaying,
    connect,
    pause,
    resume,
    stop,
  }
}
