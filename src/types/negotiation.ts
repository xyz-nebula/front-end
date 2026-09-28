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
  backendStatus?: 'ongoing' | 'evaluating' | 'evaluated' | 'victory' | 'defeat'
  selectedRole?: 0 | 1
  preparations?: string
  startedAt: string
  timeLimitSeconds: number
  finishedAt?: string
  messages: NegotiationMessage[]
}

export type NegotiationVerdict = 'user' | 'opponent'
export type NegotiationPlanStatus = 'followed' | 'adapted' | 'unused'
export type NegotiationOutcomeKind =
  | 'agreement'
  | 'partial-agreement'
  | 'deferred'
  | 'no-agreement'
  | 'not-assessable'
export type NegotiationJudgeCollege = 'hiring' | 'negotiation' | 'ownership'
export type NegotiationGoalStatus = 'achieved' | 'partially-achieved' | 'not-achieved' | 'not-assessable'

export interface NegotiationEvidence {
  messageIndex: number
  isAi: boolean
  quote: string
}

export type NegotiationOutcome =
  | {
      status: 'ready'
      kind: NegotiationOutcomeKind
      summary: string
      agreedTerms: string[]
      openPoints: string[]
      nextStep: string | null
      evidence: NegotiationEvidence[]
    }
  | {
      status: 'failed'
      reason: 'analysis-unavailable' | 'invalid-analysis'
    }

export interface NegotiationJudgeVerdict {
  choice: NegotiationVerdict
  criterion: string
  evidence: NegotiationEvidence
  observation: string
  effect: string
  comparison: string
}

export type NegotiationJudge =
  | { college: NegotiationJudgeCollege; status: 'ready'; verdict: NegotiationJudgeVerdict }
  | {
      college: NegotiationJudgeCollege
      status: 'failed'
      reason: 'unavailable' | 'invalid-output' | 'retrieval-unavailable' | 'invalid-retrieval' | 'insufficient-evidence'
    }

export interface NegotiationCoachingPoint {
  evidence: NegotiationEvidence
  action: string
  situationChange: string
  consequence: string
}

export interface NegotiationPlanComparison {
  preparationText: string
  status: NegotiationPlanStatus
  evidence: NegotiationEvidence | null
  observation: string
}

export interface NegotiationGoalAssessment {
  status: NegotiationGoalStatus
  goalText: string | null
  explanation: string
  evidence: NegotiationEvidence[]
}

export interface NegotiationTrainerFeedback {
  summary: string
  strengths: NegotiationCoachingPoint[]
  mistakes: NegotiationCoachingPoint[]
  missedOpportunities: NegotiationCoachingPoint[]
  nextTry: string[]
  planVsReality: { summary: string; items: NegotiationPlanComparison[] } | null
  goalAssessment: NegotiationGoalAssessment
}

export type NegotiationTrainer =
  | { status: 'ready'; feedback: NegotiationTrainerFeedback }
  | { status: 'failed'; reason: 'unavailable' | 'invalid-output' | 'insufficient-evidence' }

export interface NegotiationResult {
  sessionId: string
  source: 'mock' | 'server'
  contractVersion?: '2.0.0-rc.1'
  outcome: NegotiationOutcome
  judges: [NegotiationJudge, NegotiationJudge, NegotiationJudge]
  trainer: NegotiationTrainer
}

export interface NegotiationSessionSummary {
  id: string
  caseId: string
  name?: string
  mode: NegotiationMode
  status: NegotiationStatus
  backendStatus?: 'ongoing' | 'evaluating' | 'evaluated' | 'victory' | 'defeat'
  startedAt: string
  finishedAt?: string
  score?: number
}

export type NegotiationResultState<TResult = NegotiationResult> =
  | { status: 'processing' }
  | { status: 'ready'; result: TResult }
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
  remoteTranscript: 'replace-completed',
  mockPartialTranscript: 'replace-snapshot',
} as const
