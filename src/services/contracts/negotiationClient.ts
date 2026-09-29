import type {
  AudioTicket,
  NegotiationMode,
  NegotiationCaseSnapshot,
  NegotiationResultState,
  NegotiationSession,
  NegotiationSessionSummary,
  TextTurnResult,
} from '@/types/negotiation'
import type { TrainingCase } from '@/types/case'

export interface NegotiationClient {
  createSession(input: {
    caseId: string
    caseName?: string
    caseSnapshot: NegotiationCaseSnapshot
    timeLimitSeconds: number
    mode: NegotiationMode
    clientCommandId: string
    preparations: string
    selectedRole: 0 | 1
  }): Promise<NegotiationSession>

  listCases(): Promise<TrainingCase[]>

  getSession(sessionId: string): Promise<NegotiationSession>
  activateSession(sessionId: string): Promise<void>

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
