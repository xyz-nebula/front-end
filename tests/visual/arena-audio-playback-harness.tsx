import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'

import { useArenaAudio } from '@/features/arena/useArenaAudio'
import type { AudioClient } from '@/services/contracts/audioClient'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import { DomainServicesContext } from '@/services/domainServices'
import { AUDIO_FORMAT, type AudioConnectionState, type AudioEngineEvent, type AudioInputFrame } from '@/types/audio'
import type { AudioTicket, NegotiationMessage } from '@/types/negotiation'

type AudioValue = ReturnType<typeof useArenaAudio>

class PlaybackAudioClient implements AudioClient {
  private readonly listeners = new Set<(event: AudioEngineEvent) => void>()
  disconnectCalls = 0
  controls: string[] = []

  getState(): AudioConnectionState { return 'connected' }
  async connect(input: { sessionId: string; ticket: AudioTicket }) { void input }
  sendAudio(frame: AudioInputFrame) { void frame }
  sendControl(action: 'pause' | 'resume' | 'stop' | 'close') { this.controls.push(action) }
  subscribe(listener: (event: AudioEngineEvent) => void) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  subscribeState(listener: (state: AudioConnectionState) => void) {
    void listener
    return () => undefined
  }
  async disconnect() { this.disconnectCalls += 1 }
  emit(event: AudioEngineEvent) { this.listeners.forEach((listener) => listener(event)) }
}

class FakeSource {
  buffer: AudioBuffer | null = null
  onended: ((event: Event) => void) | null = null
  startAt: number | null = null
  stopCalls = 0
  private lateOnEnded: ((event: Event) => void) | null = null

  connect(destination: AudioNode) { void destination }
  start(when = 0) {
    this.startAt = when
    this.lateOnEnded = this.onended
  }
  stop() { this.stopCalls += 1 }
  finish() { this.onended?.(new Event('ended')) }
  finishLate() { this.lateOnEnded?.(new Event('ended')) }
}

class FakeAudioContext {
  readonly currentTime = 10
  readonly destination = {} as AudioDestinationNode
  readonly sources: FakeSource[] = []
  resumeCalls = 0
  suspendCalls = 0
  closeCalls = 0
  failCreateBuffer = false

  createBuffer(_channels: number, length: number, sampleRate: number) {
    if (this.failCreateBuffer) throw new Error('decode failed')
    return {
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
    } as AudioBuffer
  }
  createBufferSource() {
    const source = new FakeSource()
    this.sources.push(source)
    return source as unknown as AudioBufferSourceNode
  }
  async resume() { this.resumeCalls += 1 }
  async suspend() { this.suspendCalls += 1 }
  async close() { this.closeCalls += 1 }
}

function negotiationClient(): NegotiationClient {
  const unavailable = async (): Promise<never> => { throw new Error('Unexpected negotiation call') }
  return {
    createSession: unavailable,
    getSession: unavailable,
    sendTextTurn: unavailable,
    createAudioTicket: unavailable,
    finishSession: unavailable,
    getResult: unavailable,
    listSessions: unavailable,
  }
}

function frame(sequence: number): Extract<AudioEngineEvent, { type: 'audio_frame' }> {
  const bytes = new Uint8Array(480)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return {
    type: 'audio_frame',
    sequence,
    timestamp: sequence,
    format: AUDIO_FORMAT,
    payload: btoa(binary),
  }
}

function committedMessage(): Extract<AudioEngineEvent, { type: 'message_committed' }> {
  const message: NegotiationMessage = {
    id: 'saved-message',
    sequence: 1,
    speaker: 'ai',
    text: 'Сохранённый ответ',
    createdAt: '2026-09-23T08:00:00.000Z',
  }
  return { type: 'message_committed', eventId: 'saved-event', message }
}

export async function runAudioPlaybackScenario() {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const originalAudioContext = window.AudioContext
  const contexts: FakeAudioContext[] = []
  class TestAudioContext extends FakeAudioContext {
    constructor() {
      super()
      contexts.push(this)
    }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: TestAudioContext })

  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const service = negotiationClient()
  const clientA = new PlaybackAudioClient()
  const clientB = new PlaybackAudioClient()
  const committed: string[] = []
  let latest: AudioValue | null = null

  function Probe({ sessionId, client }: { sessionId: string; client: PlaybackAudioClient }) {
    const value = useArenaAudio(
      sessionId,
      true,
      (message) => { committed.push(message.id) },
      () => Promise.resolve(),
    )
    useLayoutEffect(() => { latest = value }, [value])
    return (
      <DomainServicesContext.Provider value={{
        negotiationClient: service,
        createAudioClient: () => client,
      }}>
        {null}
      </DomainServicesContext.Provider>
    )
  }

  const render = async (sessionId: string, client: PlaybackAudioClient) => {
    await act(async () => {
      root.render(
        <DomainServicesContext.Provider value={{
          negotiationClient: service,
          createAudioClient: () => client,
        }}>
          <Probe sessionId={sessionId} client={client} />
        </DomainServicesContext.Provider>,
      )
    })
  }
  const value = () => {
    if (!latest) throw new Error('Audio playback harness has not rendered')
    return latest
  }

  try {
    await render('arena-a', clientA)
    await act(async () => {
      clientA.emit(frame(1))
      clientA.emit(frame(2))
      await Promise.resolve()
    })
    const contextA = contexts[0]
    const queued = {
      startTimes: contextA.sources.map((source) => source.startAt),
      stopCalls: contextA.sources.map((source) => source.stopCalls),
      isPlaying: value().isPlaying,
    }

    const resumeCallsBeforeManualResume = contextA.resumeCalls
    await act(async () => {
      value().pause()
      value().resume()
      await Promise.resolve()
    })
    const pausedAndResumed = {
      suspendCalls: contextA.suspendCalls,
      manualResumeCalls: contextA.resumeCalls - resumeCallsBeforeManualResume,
      stopCalls: contextA.sources.map((source) => source.stopCalls),
    }

    await act(async () => { contextA.sources[0].finish() })
    const playingAfterFirstEnd = value().isPlaying
    await act(async () => { contextA.sources[1].finish() })
    const playingAfterQueueEnd = value().isPlaying

    await act(async () => {
      clientA.emit(committedMessage())
      contextA.failCreateBuffer = true
      clientA.emit(frame(3))
    })
    const decodeFailure = { committed: [...committed], hasError: Boolean(value().error) }
    contextA.failCreateBuffer = false

    await act(async () => {
      clientA.emit(frame(4))
      clientA.emit(frame(5))
      await Promise.resolve()
    })
    const oldSources = contextA.sources.slice(2)
    await render('arena-b', clientB)
    await act(async () => { oldSources.forEach((source) => source.finishLate()) })
    const afterArenaChange = {
      stops: oldSources.map((source) => source.stopCalls),
      oldContextClosed: contextA.closeCalls,
      isPlaying: value().isPlaying,
    }

    await act(async () => {
      clientB.emit(frame(6))
      clientB.emit(frame(7))
      await Promise.resolve()
    })
    const contextB = contexts[1]
    const stoppedSources = [...contextB.sources]
    await act(async () => { await value().stop() })
    await act(async () => { stoppedSources.forEach((source) => source.finishLate()) })
    const afterStop = {
      stops: stoppedSources.map((source) => source.stopCalls),
      isPlaying: value().isPlaying,
      controls: [...clientB.controls],
    }

    await act(async () => {
      clientB.emit(frame(8))
      await Promise.resolve()
    })
    const unmountSource = contextB.sources.at(-1)
    await act(async () => root.unmount())

    return {
      queued,
      pausedAndResumed,
      playingAfterFirstEnd,
      playingAfterQueueEnd,
      decodeFailure,
      afterArenaChange,
      afterStop,
      unmountStopCalls: unmountSource?.stopCalls ?? 0,
    }
  } finally {
    try { root.unmount() } catch { /* Already unmounted. */ }
    host.remove()
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: originalAudioContext })
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  }
}
