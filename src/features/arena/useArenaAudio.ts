import { useCallback, useEffect, useRef, useState } from 'react'

import { useDomainServices } from '@/services/domainServices'
import type { AudioClient } from '@/services/contracts/audioClient'
import type { AudioConnectionState, AudioEngineEvent } from '@/types/audio'
import type { NegotiationMessage } from '@/types/negotiation'

interface ArenaAudioState {
  state: AudioConnectionState
  partial: { user: string; ai: string }
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
  onReconnect: () => Promise<void>,
): ArenaAudioState {
  const { createAudioClient, negotiationClient } = useDomainServices()
  const [state, setState] = useState<AudioConnectionState>('idle')
  const [partial, setPartial] = useState({ user: '', ai: '' })
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const clientRef = useRef<AudioClient | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
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

  useEffect(() => { onCommittedRef.current = onCommitted }, [onCommitted])
  useEffect(() => { onReconnectRef.current = onReconnect }, [onReconnect])

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
      if (event.type === 'transcript_partial') {
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
      }
    })
    const unsubscribeState = client.subscribeState((nextState) => {
      if (isCurrent()) setState(nextState)
    })
    return () => {
      contextGenerationRef.current += 1
      connectAttemptRef.current += 1
      busyRef.current = false
      unsubscribeEvent()
      unsubscribeState()
      void client.disconnect()
      if (clientRef.current === client) clientRef.current = null
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
  }, [createAudioClient, enabled, negotiationClient, playFrame, sessionId, stopPlayback])

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
      const ticket = await negotiationClient.createAudioTicket(sessionId)
      if (!isCurrent()) return
      await client.connect({ sessionId, ticket })
    } catch (caught) {
      if (isCurrent()) {
        setError(caught instanceof Error ? caught.message : 'Не удалось подключить голосовой диалог.')
        setState('error')
      }
    } finally {
      if (isCurrent()) busyRef.current = false
    }
  }, [enabled, negotiationClient, sessionId])

  const stop = useCallback(async () => {
    connectAttemptRef.current += 1
    busyRef.current = false
    const client = clientRef.current
    client?.sendControl('stop')
    await client?.disconnect()
    stopPlayback()
    setPartial({ user: '', ai: '' })
    setState('stopped')
  }, [stopPlayback])

  const pause = useCallback(() => {
    clientRef.current?.sendControl('pause')
    const context = contextRef.current
    const generation = contextGenerationRef.current
    void context?.suspend().catch(() => {
      if (contextGenerationRef.current === generation && contextRef.current === context) {
        setError('Не удалось приостановить звук. Текст ответа сохранён в диалоге.')
      }
    })
  }, [])

  const resume = useCallback(() => {
    clientRef.current?.sendControl('resume')
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
