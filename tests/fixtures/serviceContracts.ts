import type {
  AudioEngineEventDto,
  AudioTicketDto,
  BackendErrorDto,
  NegotiationResultStateDto,
  NegotiationSessionDto,
  NegotiationSessionSummaryDto,
  TextTurnResultDto,
  TranscriptCommitRequestDto,
} from '../../src/services/real/targetContract'

const userMessage = {
  id: 'msg-user-1',
  sequence: 1,
  speaker: 'user',
  text: 'Предлагаю согласовать срок поставки.',
  created_at: '2026-09-22T08:00:01.000Z',
} as const

const aiMessage = {
  id: 'msg-ai-1',
  sequence: 2,
  speaker: 'ai',
  text: 'Срок важен, но сначала обсудим объём.',
  created_at: '2026-09-22T08:00:02.000Z',
} as const

export const sessionFixture = {
  id: 'session-1',
  case_id: 'supplier-deadline',
  mode: 'text',
  status: 'active',
  started_at: '2026-09-22T08:00:00.000Z',
  messages: [userMessage, aiMessage],
} satisfies NegotiationSessionDto

export const textTurnFixture = {
  user_message: userMessage,
  ai_message: aiMessage,
  session_status: 'active',
} satisfies TextTurnResultDto

export const audioTicketFixture = {
  ticket: 'short-lived-single-use-ticket',
  expires_at: '2026-09-22T08:01:00.000Z',
  protocol: 'audio-engine.v1',
} satisfies AudioTicketDto

export const backendErrorFixture = {
  code: 'SESSION_ALREADY_FINISHED',
  message: 'Сессия уже завершена.',
  field: 'session_id',
} satisfies BackendErrorDto

export const transcriptCommitFixture = {
  event_id: 'audio-event-1',
  speaker: 'user',
  text: 'Предлагаю согласовать срок поставки.',
  created_at: '2026-09-22T08:00:01.000Z',
} satisfies TranscriptCommitRequestDto

export const resultFixtures = [
  { status: 'processing' },
  {
    status: 'ready',
    result: {
      session_id: 'session-1',
      outcome: 'victory',
      score: 84,
      summary: 'Удалось согласовать ключевые условия.',
      strengths: ['Чёткая аргументация'],
      improvements: ['Раньше обозначать ограничения'],
      recommendations: ['Подготовить альтернативное предложение'],
    },
  },
  { status: 'failed', message: 'Не удалось сформировать разбор.' },
] satisfies NegotiationResultStateDto[]

export const sessionListFixture = [
  {
    id: 'session-1',
    case_id: 'supplier-deadline',
    mode: 'text',
    status: 'finished',
    started_at: '2026-09-22T08:00:00.000Z',
    finished_at: '2026-09-22T08:15:00.000Z',
    score: 84,
  },
] satisfies NegotiationSessionSummaryDto[]

export const audioEventFixtures = [
  {
    type: 'transcript_partial',
    speaker: 'user',
    text: 'Предлагаю согласовать',
  },
  {
    type: 'message_committed',
    event_id: 'audio-event-1',
    message: userMessage,
  },
  {
    type: 'audio_frame',
    sequence: 1,
    timestamp: 1_795_507_202_000,
    format: { codec: 'pcm_s16le', sample_rate: 24_000, channels: 1, bit_depth: 16 },
    payload: 'AAECAw==',
  },
  {
    type: 'error',
    code: 'LOCALAI_UNAVAILABLE',
    message: 'Голосовой сервис временно недоступен.',
    recoverable: true,
  },
  {
    type: 'closed',
    code: 1012,
    reason: 'service_restart',
    reconnect_allowed: true,
  },
] satisfies AudioEngineEventDto[]
