import type { MessageSpeaker, NegotiationMessage } from '@/types/negotiation'

export interface AudioFormat {
  codec: 'pcm_s16le'
  sampleRate: 24000
  channels: 1
  bitDepth: 16
}

export const AUDIO_FORMAT: AudioFormat = {
  codec: 'pcm_s16le',
  sampleRate: 24_000,
  channels: 1,
  bitDepth: 16,
}

export interface AudioInputFrame {
  sequence: number
  timestamp: number
  format: AudioFormat
  payload: string
}

export type AudioConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'paused'
  | 'stopped'
  | 'reconnecting'
  | 'error'

export type AudioControlAction = 'pause' | 'resume' | 'stop' | 'close'

export interface AudioTranscriptDraft {
  text: string
  targetText: string
  phase: 'receiving' | 'finishing'
  committedMessageId?: string
}

export interface AudioCaptureMessage {
  buffer: ArrayBuffer
  rms: number
}

export interface AudioTranscriptDrafts {
  user: AudioTranscriptDraft | null
  ai: AudioTranscriptDraft | null
}

export type AudioEngineEvent =
  | {
      type: 'transcript_delta'
      speaker: MessageSpeaker
      text: string
    }
  | {
      type: 'transcript_partial'
      speaker: MessageSpeaker
      text: string
    }
  | {
      type: 'message_committed'
      eventId: string
      message: NegotiationMessage
    }
  | {
      type: 'audio_frame'
      sequence: number
      timestamp: number
      format: AudioFormat
      payload: string
    }
  | {
      type: 'error'
      code: string
      message: string
      recoverable: boolean
    }
  | {
      type: 'auth_error'
      code: 'invalid_protocol' | 'missing_token' | 'expired_token' | 'invalid_token'
      message: string
    }
  | {
      type: 'closed'
      code: number
      reason: string
      reconnectAllowed: boolean
    }
