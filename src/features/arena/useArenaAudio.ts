import { useCallback, useEffect, useRef, useState } from 'react'

import { CaptureAttemptGuard } from '@/features/arena/captureAttemptGuard'
import { shouldRecoverCaptureAfterTransportChange } from '@/features/arena/captureRecovery'
import { useDomainServices } from '@/services/domainServices'
import type { AudioClient } from '@/services/contracts/audioClient'
import type { AudioCaptureMessage, AudioConnectionState, AudioEngineEvent, AudioTranscriptDrafts } from '@/types/audio'
import type { MessageSpeaker, NegotiationMessage } from '@/types/negotiation'
import {
  createCompletedTranscriptDraft,
  reconcileCompletedTranscript,
} from '@/features/arena/messageReconciliation'
import { AdaptiveVoiceLevel } from '@/features/arena/voiceLevel'

const TYPING_INTERVAL_MS = 30
const FINISHING_INTERVAL_MS = 12
const STREAM_SETTLE_MS = 40

interface TranscriptStream {
  targetText: string
  text: string
  phase: 'receiving' | 'finishing'
  committedMessageId?: string
  completionId?: number
  timer?: number
}

function emptyDrafts(): AudioTranscriptDrafts {
  return { user: null, ai: null }
}

interface ArenaAudioState {
  state: AudioConnectionState
  partial: AudioTranscriptDrafts
  error: string | null
  isPlaying: boolean
  getInputLevel: () => number
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
  const [partial, setPartial] = useState<AudioTranscriptDrafts>(emptyDrafts)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const inputLevelRef = useRef(0)
  const voiceLevelRef = useRef(new AdaptiveVoiceLevel())
  const clientRef = useRef<AudioClient | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const captureStreamRef = useRef<MediaStream | null>(null)
  const captureSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const captureNodeRef = useRef<AudioWorkletNode | null>(null)
  const captureMuteRef = useRef<GainNode | null>(null)
  const captureWorkletContextRef = useRef<AudioContext | null>(null)
  const captureAttemptGuardRef = useRef(new CaptureAttemptGuard())
  const sourceRefs = useRef(new Set<AudioBufferSourceNode>())
  const playbackEndRef = useRef(0)
  const playbackGenerationRef = useRef(0)
  const eventIdsRef = useRef(new Set<string>())
  const committedMessageIdsRef = useRef(new Set<string>())
  const persistedMessageIdsRef = useRef(new Set<string>())
  const claimedPersistedMessageIdsRef = useRef(new Set<string>())
  const contextGenerationRef = useRef(0)
  const reconciliationGenerationRef = useRef(0)
  const connectAttemptRef = useRef(0)
  const busyRef = useRef(false)
  const onCommittedRef = useRef(onCommitted)
  const onReconnectRef = useRef(onReconnect)
  const clearStreamsRef = useRef<() => void>(() => undefined)
  const recoverCaptureRef = useRef<() => void>(() => undefined)
  const captureRecoveryPendingRef = useRef(false)

  useEffect(() => { onCommittedRef.current = onCommitted }, [onCommitted])
  useEffect(() => { onReconnectRef.current = onReconnect }, [onReconnect])

  const resetInputLevel = useCallback(() => {
    inputLevelRef.current = 0
    voiceLevelRef.current.reset()
  }, [])

  const getInputLevel = useCallback(() => inputLevelRef.current, [])

  const releaseCapture = useCallback(() => {
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
    resetInputLevel()
  }, [resetInputLevel])

  const stopCapture = useCallback(() => {
    captureAttemptGuardRef.current.invalidate()
    releaseCapture()
  }, [releaseCapture])

  const startCapture = useCallback(async (client: AudioClient, isContextCurrent: () => boolean): Promise<boolean> => {
    if (!client.acceptsAudioInput) return true
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Этот браузер не поддерживает захват звука.')
    }
    releaseCapture()
    const attempt = captureAttemptGuardRef.current.begin(isContextCurrent)
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
      if (!attempt.isCurrent()) return false
      throw new Error(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Разрешите доступ к микрофону и подключитесь снова.'
          : 'Не удалось подключить микрофон. Проверьте выбранное устройство.',
        { cause: error },
      )
    }
    const discardStaleStream = () => attempt.discardIfStale(() => {
      stream.getTracks().forEach((track) => track.stop())
    })
    if (discardStaleStream()) return false

    const context = contextRef.current ?? new AudioContext()
    contextRef.current = context
    let source: MediaStreamAudioSourceNode
    let node: AudioWorkletNode
    let mute: GainNode
    try {
      if (captureWorkletContextRef.current !== context) {
        await context.audioWorklet.addModule('/pcm-capture-worklet.js')
        captureWorkletContextRef.current = context
      }
      if (discardStaleStream()) return false
      await context.resume()
      if (discardStaleStream()) return false
      source = context.createMediaStreamSource(stream)
      node = new AudioWorkletNode(context, 'pcm-capture-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
      })
      mute = context.createGain()
      mute.gain.value = 0
      source.connect(node).connect(mute).connect(context.destination)
    } catch (caught) {
      stream.getTracks().forEach((track) => track.stop())
      if (!attempt.isCurrent()) return false
      throw caught
    }
    node.port.onmessage = (message: MessageEvent<AudioCaptureMessage>) => {
      if (!attempt.isCurrent()) return
      try {
        if (!(message.data?.buffer instanceof ArrayBuffer) || !Number.isFinite(message.data.rms)) {
          throw new Error('Получен некорректный аудиофрейм.')
        }
        inputLevelRef.current = voiceLevelRef.current.push(message.data.rms)
        const bytes = new Uint8Array(message.data.buffer)
        let binary = ''
        for (const byte of bytes) binary += String.fromCharCode(byte)
        client.sendAudio(btoa(binary))
      } catch (caught) {
        captureRecoveryPendingRef.current = true
        stopCapture()
        setError(caught instanceof Error ? caught.message : 'Не удалось передать звук. Подключитесь снова.')
      }
    }
    const handleEnded = () => {
      if (!attempt.isCurrent()) return
      stopCapture()
      setError('Микрофон отключён. Восстанавливаем подключение…')
      recoverCaptureRef.current()
    }
    stream.getAudioTracks().forEach((track) => { track.onended = handleEnded })
    captureSourceRef.current = source
    captureNodeRef.current = node
    captureMuteRef.current = mute
    captureStreamRef.current = stream
    return true
  }, [releaseCapture, stopCapture])

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
    persistedMessageIdsRef.current = new Set<string>()
    claimedPersistedMessageIdsRef.current = new Set<string>()
    const client = createAudioClient()
    clientRef.current = client
    const playbackSources = sourceRefs.current
    const eventIds = eventIdsRef.current
    const committedMessageIds = committedMessageIdsRef.current
    const persistedMessageIds = persistedMessageIdsRef.current
    const claimedPersistedMessageIds = claimedPersistedMessageIdsRef.current
    let nextCompletionId = 0
    const streams: Record<MessageSpeaker, TranscriptStream> = {
      user: { targetText: '', text: '', phase: 'receiving' },
      ai: { targetText: '', text: '', phase: 'receiving' },
    }
    const publishStream = (speaker: MessageSpeaker) => {
      const stream = streams[speaker]
      setPartial((current) => ({
        ...current,
        [speaker]: stream.text || stream.targetText ? {
          text: stream.text,
          targetText: stream.targetText,
          phase: stream.phase,
          ...(stream.committedMessageId ? { committedMessageId: stream.committedMessageId } : {}),
        } : null,
      }))
    }
    const clearStream = (speaker: MessageSpeaker) => {
      const stream = streams[speaker]
      if (stream.timer !== undefined) window.clearTimeout(stream.timer)
      streams[speaker] = { targetText: '', text: '', phase: 'receiving' }
      setPartial((current) => ({ ...current, [speaker]: null }))
    }
    const scheduleTyping = (speaker: MessageSpeaker) => {
      const stream = streams[speaker]
      if (stream.timer !== undefined) return
      const tick = () => {
        if (!isCurrent()) return
        const current = streams[speaker]
        current.timer = undefined
        if (!current.targetText.startsWith(current.text)) {
          const retainedLength = Math.min(current.text.length, current.targetText.length)
          current.text = current.targetText.slice(0, retainedLength)
        }
        const remaining = current.targetText.length - current.text.length
        if (remaining > 0) {
          const step = current.phase === 'finishing' ? Math.max(1, Math.ceil(remaining / 12)) : 1
          current.text = current.targetText.slice(0, current.text.length + step)
          publishStream(speaker)
          current.timer = window.setTimeout(
            tick,
            current.phase === 'finishing' ? FINISHING_INTERVAL_MS : TYPING_INTERVAL_MS,
          )
        } else if (current.committedMessageId) {
          current.timer = window.setTimeout(() => {
            if (isCurrent() && streams[speaker] === current) clearStream(speaker)
          }, STREAM_SETTLE_MS)
        }
      }
      stream.timer = window.setTimeout(tick, 0)
    }
    const updatePartialStream = (speaker: MessageSpeaker, targetText: string) => {
      const stream = streams[speaker]
      stream.targetText = targetText
      if (!stream.targetText) return
      publishStream(speaker)
      scheduleTyping(speaker)
    }
    const beginCompletedStream = (speaker: MessageSpeaker, text: string, completionId: number) => {
      const previous = streams[speaker]
      if (previous.timer !== undefined) window.clearTimeout(previous.timer)
      streams[speaker] = createCompletedTranscriptDraft(text, completionId)
      publishStream(speaker)
      scheduleTyping(speaker)
    }
    const commitStream = (message: NegotiationMessage, completionId?: number) => {
      const stream = streams[message.speaker]
      if (completionId !== undefined && stream.completionId !== completionId) return
      stream.targetText = message.text
      stream.committedMessageId = message.id
      stream.phase = 'finishing'
      publishStream(message.speaker)
      scheduleTyping(message.speaker)
    }
    const clearAllStreams = () => {
      clearStream('user')
      clearStream('ai')
    }
    clearStreamsRef.current = clearAllStreams
    const isCurrent = () => contextGenerationRef.current === generation && clientRef.current === client
    let captureRecoveryInFlight = false
    const recoverCapture = () => {
      if (!isCurrent() || !client.acceptsAudioInput) return
      if (captureStreamRef.current?.getAudioTracks().some((track) => track.readyState === 'live')) {
        captureRecoveryPendingRef.current = false
        return
      }
      if (client.getState() === 'paused') {
        captureRecoveryPendingRef.current = true
        return
      }
      if (busyRef.current) {
        captureRecoveryPendingRef.current = true
        return
      }
      if (client.getState() !== 'connected' || captureRecoveryInFlight) return

      captureRecoveryInFlight = true
      captureRecoveryPendingRef.current = false
      setError('Восстанавливаем подключение к микрофону…')
      const isRecoveryCurrent = () => isCurrent() && client.getState() === 'connected'
      void startCapture(client, isRecoveryCurrent)
        .then((started) => {
          if (started && isRecoveryCurrent()) setError(null)
          else if (isCurrent() && client.getState() === 'paused') captureRecoveryPendingRef.current = true
        })
        .catch((caught) => {
          if (!isRecoveryCurrent()) return
          stopCapture()
          setError(caught instanceof Error
            ? caught.message
            : 'Не удалось восстановить микрофон. Подключите устройство и попробуйте снова.')
        })
        .finally(() => {
          captureRecoveryInFlight = false
          if (captureRecoveryPendingRef.current && client.getState() === 'connected') {
            queueMicrotask(recoverCapture)
          }
        })
    }
    recoverCaptureRef.current = recoverCapture
    queueMicrotask(() => {
      if (!isCurrent()) return
      setState('idle')
      setPartial(emptyDrafts())
      setError(null)
      stopPlayback()
    })
    const unsubscribeEvent = client.subscribe((event) => {
      if (!isCurrent()) return
      if (event.type === 'transcript_completed') {
        const completionId = ++nextCompletionId
        const baselineMessageIds = new Set(persistedMessageIds)
        const reconciliationGeneration = reconciliationGenerationRef.current
        beginCompletedStream(event.speaker, event.text, completionId)
        void (async () => {
          const result = await reconcileCompletedTranscript({
            speaker: event.speaker,
            text: event.text,
            baselineMessageIds,
            claimedMessageIds: claimedPersistedMessageIds,
            persistedMessageIds,
            delays: [250, 500, 1_000, 1_500, 2_000],
            wait: (delay) => new Promise<void>((resolve) => window.setTimeout(resolve, delay)),
            refresh: () => onReconnectRef.current(),
            isCurrent: () => isCurrent()
              && reconciliationGenerationRef.current === reconciliationGeneration,
          })
          if (result.status === 'matched') {
            commitStream(result.message, completionId)
          } else if (result.status === 'not-found' && isCurrent()) {
            setError('Реплика получена, но пока не появилась в истории. Обновите диалог позже.')
          }
        })()
      } else if (event.type === 'transcript_partial') {
        if (event.text) updatePartialStream(event.speaker, event.text)
      } else if (event.type === 'message_committed') {
        if (eventIds.has(event.eventId) || committedMessageIds.has(event.message.id)) return
        eventIds.add(event.eventId)
        committedMessageIds.add(event.message.id)
        commitStream(event.message)
        onCommittedRef.current(event.message)
      } else if (event.type === 'audio_frame') {
        playFrame(event, isCurrent)
      } else if (event.type === 'error') {
        clearAllStreams()
        resetInputLevel()
        setError(event.message)
      } else if (event.type === 'closed') {
        clearAllStreams()
        resetInputLevel()
        stopPlayback()
      } else if (event.type === 'auth_error') {
        setError('Обновляем авторизацию голосового подключения…')
      }
    })
    const unsubscribeState = client.subscribeState((nextState) => {
      if (!isCurrent()) return
      setState(nextState)
      if (shouldRecoverCaptureAfterTransportChange(nextState, captureRecoveryPendingRef.current)) {
        queueMicrotask(recoverCapture)
      }
    })
    return () => {
      contextGenerationRef.current += 1
      reconciliationGenerationRef.current += 1
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
      persistedMessageIds.clear()
      claimedPersistedMessageIds.clear()
      for (const speaker of ['user', 'ai'] as const) {
        const timer = streams[speaker].timer
        if (timer !== undefined) window.clearTimeout(timer)
      }
      if (clearStreamsRef.current === clearAllStreams) clearStreamsRef.current = () => undefined
      if (recoverCaptureRef.current === recoverCapture) recoverCaptureRef.current = () => undefined
      captureRecoveryPendingRef.current = false
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
      captureWorkletContextRef.current = null
    }
  }, [createAudioClient, enabled, negotiationClient, playFrame, resetInputLevel, sessionId, startCapture, stopCapture, stopPlayback])

  useEffect(() => {
    if (!enabled || !navigator.mediaDevices?.addEventListener) return
    const handleDeviceChange = () => {
      const hasLiveInput = captureStreamRef.current
        ?.getAudioTracks()
        .some((track) => track.readyState === 'live')
      if (!hasLiveInput) recoverCaptureRef.current()
    }
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
  }, [enabled])

  const connect = useCallback(async () => {
    const client = clientRef.current
    if (!enabled || !client || busyRef.current) return
    const contextGeneration = contextGenerationRef.current
    const attempt = ++connectAttemptRef.current
    const isCurrent = () => contextGenerationRef.current === contextGeneration
      && connectAttemptRef.current === attempt
      && clientRef.current === client
    stopCapture()
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
    reconciliationGenerationRef.current += 1
    clearStreamsRef.current()
    eventIdsRef.current.clear()
    claimedPersistedMessageIdsRef.current.clear()
    try {
      const synced = await onReconnectRef.current()
      if (!isCurrent()) return
      persistedMessageIdsRef.current.clear()
      synced?.messages.forEach((message) => persistedMessageIdsRef.current.add(message.id))
      await negotiationClient.activateSession(sessionId)
      if (!isCurrent()) return
      const ticket = client.requiresTicket
        ? await negotiationClient.createAudioTicket(sessionId)
        : undefined
      if (!isCurrent()) return
      await client.connect({ sessionId, ...(ticket ? { ticket } : {}) })
      if (!isCurrent()) return
      const captureStarted = await startCapture(client, isCurrent)
      captureRecoveryPendingRef.current = client.acceptsAudioInput === true && !captureStarted
    } catch (caught) {
      if (isCurrent()) {
        stopCapture()
        await client.disconnect().catch(() => undefined)
        setError(caught instanceof Error ? caught.message : 'Не удалось подключить голосовой диалог.')
        setState('error')
      }
    } finally {
      if (isCurrent()) {
        busyRef.current = false
        if (captureRecoveryPendingRef.current) recoverCaptureRef.current()
      }
    }
  }, [enabled, negotiationClient, sessionId, startCapture, stopCapture])

  const stop = useCallback(async () => {
    connectAttemptRef.current += 1
    reconciliationGenerationRef.current += 1
    captureAttemptGuardRef.current.invalidate()
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
      captureRecoveryPendingRef.current = false
      stopCapture()
      stopPlayback()
      clearStreamsRef.current()
      setState('stopped')
      if (transportFailed) {
        setError('Аудиосвязь недоступна. Локальные ресурсы освобождены, тренировку можно завершить.')
      }
    }
  }, [stopCapture, stopPlayback])

  const pause = useCallback(() => {
    resetInputLevel()
    const hasLiveInput = captureStreamRef.current
      ?.getAudioTracks()
      .some((track) => track.readyState === 'live')
    if (!hasLiveInput) {
      captureAttemptGuardRef.current.invalidate()
      captureRecoveryPendingRef.current = true
    }
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
  }, [resetInputLevel])

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
    if (captureRecoveryPendingRef.current || !captureStreamRef.current) {
      recoverCaptureRef.current()
    }
  }, [])

  return {
    state,
    partial,
    error,
    isPlaying,
    getInputLevel,
    connect,
    pause,
    resume,
    stop,
  }
}
