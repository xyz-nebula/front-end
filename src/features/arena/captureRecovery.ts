import type { AudioConnectionState } from '@/types/audio'

export function shouldRecoverCaptureAfterTransportChange(
  state: AudioConnectionState,
  recoveryPending: boolean,
): boolean {
  return state === 'connected' && recoveryPending
}
