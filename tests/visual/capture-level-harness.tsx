import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'

import { useArenaAudio } from '@/features/arena/useArenaAudio'
import type { AudioClient } from '@/services/contracts/audioClient'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import { DomainServicesContext } from '@/services/domainServices'
import type { AudioCaptureMessage, AudioConnectionState, AudioControlAction, AudioEngineEvent, AudioInputFrame } from '@/types/audio'

type AudioValue = ReturnType<typeof useArenaAudio>

class CaptureClient implements AudioClient {
  readonly acceptsAudioInput = true
  sent: Array<AudioInputFrame | string> = []
  controls: AudioControlAction[] = []
  private readonly stateListeners = new Set<(state: AudioConnectionState) => void>()

  getState(): AudioConnectionState { return 'idle' }
  async connect() { this.stateListeners.forEach((listener) => listener('connected')) }
  sendAudio(frame: AudioInputFrame | string) { this.sent.push(frame) }
  sendControl(action: AudioControlAction) { this.controls.push(action) }
  subscribe(listener: (event: AudioEngineEvent) => void) {
    void listener
    return () => undefined
  }
  subscribeState(listener: (state: AudioConnectionState) => void) {
    this.stateListeners.add(listener)
    return () => { this.stateListeners.delete(listener) }
  }
  async disconnect() { this.stateListeners.forEach((listener) => listener('idle')) }
}

class FakeCaptureNode {
  static latest: FakeCaptureNode | null = null
  port = {
    onmessage: null as ((event: MessageEvent<AudioCaptureMessage>) => void) | null,
    messages: [] as string[],
    postMessage: (message: string) => { this.port.messages.push(message) },
  }
  constructor() { FakeCaptureNode.latest = this }
  connect(node: AudioNode) { return node }
  disconnect() { return undefined }
  emit(message: AudioCaptureMessage) { this.port.onmessage?.({ data: message } as MessageEvent<AudioCaptureMessage>) }
}

export async function runCaptureLevelScenario() {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const originalAudioContext = window.AudioContext
  const originalAudioWorkletNode = window.AudioWorkletNode
  const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
  let stoppedTracks = 0
  const source = { connect: (node: AudioNode) => node, disconnect: () => undefined }
  const gain = { gain: { value: 1 }, connect: (node: AudioNode) => node, disconnect: () => undefined }
  class CaptureAudioContext {
    destination = {} as AudioDestinationNode
    audioWorklet = { addModule: async () => undefined }
    createMediaStreamSource() { return source as unknown as MediaStreamAudioSourceNode }
    createGain() { return gain as unknown as GainNode }
    async resume() { return undefined }
    async suspend() { return undefined }
    async close() { return undefined }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: CaptureAudioContext })
  Object.defineProperty(window, 'AudioWorkletNode', { configurable: true, value: FakeCaptureNode })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop: () => { stoppedTracks += 1 }, onended: null }],
        getAudioTracks: () => [{ stop: () => { stoppedTracks += 1 }, onended: null }],
      }),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
  })

  const unavailable = async (): Promise<never> => { throw new Error('Unexpected negotiation call') }
  const negotiationClient: NegotiationClient = {
    createSession: unavailable,
    getSession: unavailable,
    activateSession: async () => undefined,
    sendTextTurn: unavailable,
    createAudioTicket: unavailable,
    finishSession: unavailable,
    getResult: unavailable,
    listSessions: unavailable,
  }
  const client = new CaptureClient()
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let latest: AudioValue | null = null
  function Probe() {
    const value = useArenaAudio('capture-arena', true, () => undefined, async () => null)
    useLayoutEffect(() => { latest = value }, [value])
    return null
  }
  const value = () => {
    if (!latest) throw new Error('Capture harness has not rendered')
    return latest
  }

  try {
    await act(async () => {
      root.render(
        <DomainServicesContext.Provider value={{ negotiationClient, createAudioClient: () => client }}>
          <Probe />
        </DomainServicesContext.Provider>,
      )
    })
    await act(async () => { await value().connect() })
    const node = FakeCaptureNode.latest
    if (!node) throw new Error('Capture worklet was not created')
    const buffer = new Uint8Array([0, 1, 2, 3]).buffer
    await act(async () => { node.emit({ buffer, rms: 0.25 }) })
    const activeLevel = value().getInputLevel()
    value().pause()
    const pausedLevel = value().getInputLevel()
    await act(async () => { await value().stop() })
    return {
      activeLevel,
      pausedLevel,
      sent: client.sent,
      portMessages: node.port.messages,
      controls: client.controls,
      stoppedTracks,
    }
  } finally {
    await act(async () => root.unmount())
    host.remove()
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: originalAudioContext })
    Object.defineProperty(window, 'AudioWorkletNode', { configurable: true, value: originalAudioWorkletNode })
    if (originalMediaDevices) Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices)
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  }
}
