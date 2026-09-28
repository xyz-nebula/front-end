import type {
  AudioInputMessageDto,
  BackendErrorDto,
  ChatListItemDto,
  ChatWithMessagesResponseDto,
  EvaluateTriggerResponseDto,
  EvaluationResultResponseDto,
} from '../../src/services/real/targetContract'
import type { NegotiationSession } from '../../src/types/negotiation'

const userMessage = {
  uuid: '11111111-1111-4111-8111-111111111111',
  sequence: 1,
  is_ai: false,
  text: 'Предлагаю согласовать срок поставки.',
  created_at: '2026-09-22T08:00:01.000Z',
} as const

const aiMessage = {
  uuid: '22222222-2222-4222-8222-222222222222',
  sequence: 2,
  is_ai: true,
  text: 'Срок важен, но сначала обсудим объём.',
  created_at: '2026-09-22T08:00:02.000Z',
} as const

export const chatFixture = {
  uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Срок поставки',
  status: 'ongoing',
  created_at: '2026-09-22T08:00:00.000Z',
  selected_role: 0,
  preparations: '### Цель\nСогласовать срок поставки.',
  messages: [userMessage, aiMessage],
} satisfies ChatWithMessagesResponseDto

export const chatListFixture = [
  { uuid: chatFixture.uuid, name: chatFixture.name },
  { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Повышение зарплаты' },
] satisfies ChatListItemDto[]

export const backendErrorFixture = {
  code: 'chat_not_found',
  message: 'Chat not found',
} satisfies BackendErrorDto

export const audioInputFixture = { type: 'audio', audio: 'AAECAw==' } satisfies AudioInputMessageDto

export const audioEventFixtures = [
  { type: 'transcript', role: 'user', text: 'Предлагаю согласовать' },
  {
    type: 'audio_frame', sequence: 1, timestamp: 1_795_507_202_000,
    format: { codec: 'pcm_s16le', sample_rate: 24_000, channels: 1, bit_depth: 16 }, payload: 'AAECAw==',
  },
  { type: 'error', code: 'LOCALAI_ERROR', message: 'Voice service failed.' },
  { type: 'auth_error', code: 'expired_token', message: 'Token expired.' },
] as const

export const evaluationSessionFixture: NegotiationSession = {
  id: chatFixture.uuid,
  caseId: 'case-1',
  mode: 'voice',
  status: 'finishing',
  startedAt: chatFixture.created_at,
  messages: [
    { id: userMessage.uuid, sequence: 1, speaker: 'user', text: userMessage.text, createdAt: userMessage.created_at },
    { id: aiMessage.uuid, sequence: 2, speaker: 'ai', text: aiMessage.text, createdAt: aiMessage.created_at },
  ],
}

export const evaluateTriggerFixture = {
  job_uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  status: 'pending',
} satisfies EvaluateTriggerResponseDto

const userEvidence = { message_index: 0, is_ai: false, quote: 'согласовать срок' } as const
const aiEvidence = { message_index: 1, is_ai: true, quote: 'обсудим объём' } as const

export const evaluationResultFixture = {
  status: 'done',
  error: null,
  result: {
    contract_version: '2.0.0-rc.1',
    outcome: {
      basis: 'dialogue_inference',
      status: 'ready',
      assessment: {
        kind: 'partial_agreement',
        summary: 'Стороны обозначили предмет обсуждения.',
        agreed_terms: ['Срок поставки требует согласования.'],
        open_points: ['Объём поставки.'],
        next_step: 'Согласовать объём и затем срок.',
        evidence: [userEvidence, aiEvidence],
      },
      error_code: null,
    },
    judge_verdicts: ([
      ['hiring', 'Надёжность'],
      ['negotiation', 'Движение к цели'],
      ['ownership', 'Ответственность'],
    ] as const).map(([college, decisive_criterion]) => ({
      college,
      status: 'ready' as const,
      verdict: {
        college,
        choice: 'player' as const,
        decisive_criterion,
        evidence: userEvidence,
        observation: 'Игрок предложил конкретный предмет соглашения.',
        effect: 'Разговор получил рабочее направление.',
        comparison: 'Оппонент пока не предложил сопоставимого шага.',
      },
      error_code: null,
    })),
    trainer_feedback: {
      status: 'ready',
      feedback: {
        summary: 'Хорошее начало, которому не хватило уточняющих вопросов.',
        strengths: [{
          evidence: userEvidence,
          action: 'Обозначил предмет соглашения.',
          situation_change: 'Фокус разговора стал понятнее.',
          consequence: 'Появилась основа для обсуждения условий.',
        }],
        mistakes: [],
        next_try: ['Уточнить желаемый объём.', 'Предложить два варианта срока.'],
        plan_vs_reality: {
          summary: 'Цель была использована в разговоре.',
          items: [{
            preparation_text: 'Согласовать срок поставки.',
            status: 'followed',
            evidence: userEvidence,
            observation: 'Игрок прямо предложил обсудить срок.',
          }],
        },
        missed_opportunities: [],
        goal_assessment: {
          status: 'partially_achieved',
          goal_text: 'Согласовать срок поставки.',
          explanation: 'Срок обозначен, но ещё не согласован.',
          evidence: [userEvidence, aiEvidence],
        },
      },
      error_code: null,
    },
  },
} satisfies EvaluationResultResponseDto
