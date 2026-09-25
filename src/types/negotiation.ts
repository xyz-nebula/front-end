export type NegotiationMode = 'text' | 'voice'
export type NegotiationStatus = 'active' | 'finishing' | 'finished'
export type MessageSpeaker = 'user' | 'ai'

export interface NegotiationMessage {
  id: string
  sequence: number
  speaker: MessageSpeaker
  text: string
  createdAt: string
}

export interface NegotiationSession {
  id: string
  caseId: string
  name?: string
  mode: NegotiationMode
  status: NegotiationStatus
  backendStatus?: 'ongoing' | 'victory' | 'defeat'
  startedAt: string
  finishedAt?: string
  messages: NegotiationMessage[]
}

export interface NegotiationResult {
  sessionId: string
  outcome: 'victory' | 'defeat'
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
  recommendations: string[]
}

export interface NegotiationSessionSummary {
  id: string
  caseId: string
  name?: string
  mode: NegotiationMode
  status: NegotiationStatus
  backendStatus?: 'ongoing' | 'victory' | 'defeat'
  startedAt: string
  finishedAt?: string
  score?: number
}

export type NegotiationResultState =
  | { status: 'processing' }
  | { status: 'ready'; result: NegotiationResult }
  | { status: 'failed'; message: string }

export interface TextTurnResult {
  userMessage: NegotiationMessage
  aiMessage: NegotiationMessage
  sessionStatus: NegotiationStatus
}

export interface AudioTicket {
  ticket: string
  expiresAt: string
  protocol: 'audio-engine.v1'
}

export type SessionViewState = 'loading' | 'ready' | 'finishing' | 'finished' | 'error'
export type TurnState = 'idle' | 'sending' | 'thinking' | 'error'

export const MESSAGE_RECONCILIATION = {
  persistedIdentity: 'message.id',
  ordering: 'message.sequence',
  audioEventIdentity: 'eventId-per-connection',
  remoteTranscript: 'append-delta',
  mockPartialTranscript: 'replace-snapshot',
} as const
