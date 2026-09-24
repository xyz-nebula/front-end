import { getMockAiResponse, getNegotiationScenario } from '@/mocks/negotiation-scenarios'
import type { AudioClient } from '@/services/contracts/audioClient'
import { MockRuntime, type ConsumedAudioTicket } from '@/services/mock/mockRuntime'
import { AUDIO_FORMAT, type AudioConnectionState, type AudioEngineEvent, type AudioInputFrame } from '@/types/audio'
import type { AudioTicket, MessageSpeaker } from '@/types/negotiation'
import { ServiceError, isServiceError } from '@/types/api'

interface MockAudioClientOptions {
  latencyMs: number
  requestMicrophone?: boolean
}

type EventListener = (event: AudioEngineEvent) => void
type StateListener = (state: AudioConnectionState) => void

function splitSnapshots(text: string): string[] {
  const words = text.split(/\s+/)
  const snapshots: string[] = []
  for (let index = 2; index < words.length; index += 3) {
    snapshots.push(words.slice(0, index).join(' '))
  }
  if (snapshots.at(-1) !== text) snapshots.push(text)
  return snapshots
}

function mockAudioPayload(): string {
  const sampleCount = 6_000
  const bytes = new Uint8Array(sampleCount * 2)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < sampleCount; index += 1) {
    const fade = Math.min(1, index / 600, (sampleCount - index) / 600)
    const sample = Math.round(Math.sin(2 * Math.PI * 440 * index / 24_000) * 4500 * fade)
    view.setInt16(index * 2, sample, true)
  }
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export class MockAudioClient implements AudioClient {
  readonly requiresTicket = true
  private state: AudioConnectionState = 'idle'
  private readonly eventListeners = new Set<EventListener>()
  private readonly stateListeners = new Set<StateListener>()
  private readonly timers = new Map<number, (active: boolean) => void>()
  private generation = 0
  private stream: MediaStream | null = null
  private audioSequence = 0

  constructor(
    private readonly runtime: MockRuntime,
    private readonly options: MockAudioClientOptions,
  ) {}

  getState(): AudioConnectionState {
    return this.state
  }

  private setState(state: AudioConnectionState): void {
    if (this.state === state) return
    this.state = state
    for (const listener of this.stateListeners) listener(state)
  }

  private emit(event: AudioEngineEvent): void {
    for (const listener of this.eventListeners) listener(event)
  }

  private clearTimers(): void {
    for (const [timer, resolve] of this.timers) {
      window.clearTimeout(timer)
      resolve(false)
    }
    this.timers.clear()
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }

  private delay(generation: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.timers.delete(timer)
        resolve(this.generation === generation)
      }, this.options.latencyMs)
      this.timers.set(timer, resolve)
    })
  }

  private async requestMicrophone(generation: number): Promise<void> {
    if (!this.options.requestMicrophone) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      this.stream = stream
    } catch (error) {
      throw new ServiceError('Не удалось получить доступ к микрофону.', {
        reason: 'microphone-denied',
        code: 'MICROPHONE_DENIED',
        recoverable: true,
        cause: error,
      })
    }
  }

  async connect(input: { sessionId: string; ticket?: AudioTicket }): Promise<void> {
    const reconnecting = this.state !== 'idle'
    this.generation += 1
    const generation = this.generation
    this.clearTimers()
    this.stopStream()
    if (reconnecting) {
      this.emit({ type: 'transcript_partial', speaker: 'user', text: '' })
      this.emit({ type: 'transcript_partial', speaker: 'ai', text: '' })
    }
    this.setState(reconnecting ? 'reconnecting' : 'connecting')

    try {
      if (!input.ticket) {
        throw new ServiceError('Mock audio ticket не найден.', {
          reason: 'expired-audio-ticket', code: 'MOCK_AUDIO_TICKET_REQUIRED', recoverable: true,
        })
      }
      const connection = await this.runtime.consumeAudioTicket(input.sessionId, input.ticket)
      if (generation !== this.generation) return
      await this.requestMicrophone(generation)
      if (generation !== this.generation) return
      if (!(await this.delay(generation))) return
      this.setState('connected')
      void this.runVoiceFlow(connection, generation)
    } catch (error) {
      if (generation !== this.generation) return
      this.stopStream()
      this.emit({
        type: 'error',
        code: isServiceError(error) ? (error.code ?? 'MOCK_AUDIO_CONNECT_ERROR') : 'MOCK_AUDIO_CONNECT_ERROR',
        message: error instanceof Error ? error.message : 'Не удалось подключить mock audio-engine.',
        recoverable: isServiceError(error) ? error.recoverable : true,
      })
      this.setState('error')
      throw error
    }
  }

  private async waitUntilActive(generation: number): Promise<boolean> {
    while (this.state === 'paused' && generation === this.generation) {
      if (!(await this.delay(generation))) return false
    }
    return generation === this.generation && this.state === 'connected'
  }

  private async emitTranscript(
    speaker: MessageSpeaker,
    text: string,
    generation: number,
  ): Promise<boolean> {
    for (const snapshot of splitSnapshots(text)) {
      if (!(await this.waitUntilActive(generation))) return false
      this.emit({ type: 'transcript_partial', speaker, text: snapshot })
      if (!(await this.delay(generation))) return false
    }
    return this.waitUntilActive(generation)
  }

  private async commit(
    connection: ConsumedAudioTicket,
    speaker: MessageSpeaker,
    text: string,
    generation: number,
  ): Promise<boolean> {
    const eventId = crypto.randomUUID()
    const committed = await this.runtime.commitAudioMessage({
      ownerKey: connection.ownerKey,
      sessionId: connection.sessionId,
      eventId,
      speaker,
      text,
    })
    if (generation !== this.generation) return false
    this.emit({ type: 'transcript_partial', speaker, text: '' })
    this.emit({ type: 'message_committed', eventId, message: committed.message })
    return true
  }

  private async runVoiceFlow(connection: ConsumedAudioTicket, generation: number): Promise<void> {
    try {
      const userText = getNegotiationScenario(connection.caseId).userVoiceLine
      if (!(await this.emitTranscript('user', userText, generation))) return
      if (!(await this.commit(connection, 'user', userText, generation))) return

      const session = this.runtime.getSession(connection.ownerKey, connection.sessionId)
      const turnNumber = session.messages.filter((message) => message.speaker === 'user').length
      const aiText = getMockAiResponse(connection.caseId, turnNumber)
      if (!(await this.emitTranscript('ai', aiText, generation))) return

      this.audioSequence += 1
      this.emit({
        type: 'audio_frame',
        sequence: this.audioSequence,
        timestamp: Date.now(),
        format: AUDIO_FORMAT,
        payload: mockAudioPayload(),
      })
      await this.commit(connection, 'ai', aiText, generation)
    } catch (error) {
      if (generation !== this.generation) return
      this.emit({ type: 'transcript_partial', speaker: 'user', text: '' })
      this.emit({ type: 'transcript_partial', speaker: 'ai', text: '' })
      this.emit({
        type: 'error',
        code: isServiceError(error) ? (error.code ?? 'MOCK_AUDIO_ERROR') : 'MOCK_AUDIO_ERROR',
        message: error instanceof Error ? error.message : 'Ошибка mock audio-engine.',
        recoverable: isServiceError(error) ? error.recoverable : true,
      })
      this.setState('error')
    }
  }

  sendAudio(frame: AudioInputFrame | string): void {
    void frame
    if (this.state !== 'connected' && this.state !== 'paused') {
      throw new ServiceError('Audio connection не установлено.', {
        reason: 'websocket-close',
        code: 'AUDIO_NOT_CONNECTED',
        recoverable: true,
      })
    }
  }

  sendControl(action: 'pause' | 'resume' | 'stop' | 'close'): void {
    if (action === 'pause' && this.state === 'connected') {
      this.setState('paused')
      return
    }
    if (action === 'resume' && this.state === 'paused') {
      this.setState('connected')
      return
    }
    if (action === 'stop') {
      this.endConnection(1000, 'Запись остановлена пользователем.', false, 'stopped')
      return
    }
    if (action === 'close') void this.disconnect()
  }

  private endConnection(
    code: number,
    reason: string,
    reconnectAllowed: boolean,
    state: AudioConnectionState,
  ): void {
    this.generation += 1
    this.clearTimers()
    this.stopStream()
    this.emit({ type: 'transcript_partial', speaker: 'user', text: '' })
    this.emit({ type: 'transcript_partial', speaker: 'ai', text: '' })
    this.emit({ type: 'closed', code, reason, reconnectAllowed })
    this.setState(state)
  }

  subscribe(listener: EventListener): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  async disconnect(): Promise<void> {
    this.generation += 1
    this.clearTimers()
    this.stopStream()
    this.emit({ type: 'transcript_partial', speaker: 'user', text: '' })
    this.emit({ type: 'transcript_partial', speaker: 'ai', text: '' })
    this.setState('idle')
  }
}
