import type {
  AudioConnectionState,
  AudioControlAction,
  AudioEngineEvent,
  AudioInputFrame,
} from '@/types/audio'
import type { AudioTicket } from '@/types/negotiation'

export interface AudioClient {
  readonly requiresTicket?: boolean
  getState(): AudioConnectionState
  connect(input: { sessionId: string; ticket?: AudioTicket }): Promise<void>
  sendAudio(frame: AudioInputFrame | string): void
  sendControl(action: AudioControlAction): void
  subscribe(listener: (event: AudioEngineEvent) => void): () => void
  subscribeState(listener: (state: AudioConnectionState) => void): () => void
  disconnect(): Promise<void>
}
