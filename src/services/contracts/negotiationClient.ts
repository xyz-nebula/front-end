import type {
  AudioTicket,
  NegotiationMode,
  NegotiationResultState,
  NegotiationSession,
  NegotiationSessionSummary,
  TextTurnResult,
} from '@/types/negotiation'

export interface NegotiationClient {
  createSession(input: {
    caseId: string
    mode: NegotiationMode
    clientCommandId: string
  }): Promise<NegotiationSession>

  getSession(sessionId: string): Promise<NegotiationSession>

  sendTextTurn(input: {
    sessionId: string
    text: string
    clientTurnId: string
  }): Promise<TextTurnResult>

  createAudioTicket(sessionId: string): Promise<AudioTicket>

  finishSession(input: {
    sessionId: string
    clientCommandId: string
  }): Promise<NegotiationResultState>

  getResult(sessionId: string): Promise<NegotiationResultState>
  listSessions(): Promise<NegotiationSessionSummary[]>
}
