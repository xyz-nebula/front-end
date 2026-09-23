import type { AudioClient } from '@/services/contracts/audioClient'
import type { AudioConnectionState, AudioEngineEvent } from '@/types/audio'
import { featureUnavailable } from '@/types/api'

export class AudioEngineClient implements AudioClient {
  getState(): AudioConnectionState {
    return 'idle'
  }

  async connect(): Promise<void> {
    throw featureUnavailable('audio')
  }

  sendAudio(): void {
    throw featureUnavailable('audio')
  }

  sendControl(): void {
    throw featureUnavailable('audio')
  }

  subscribe(listener: (event: AudioEngineEvent) => void): () => void {
    void listener
    return () => undefined
  }

  subscribeState(listener: (state: AudioConnectionState) => void): () => void {
    void listener
    return () => undefined
  }

  async disconnect(): Promise<void> {
    // A no-op is intentional: the real adapter never acquired a resource.
  }
}
