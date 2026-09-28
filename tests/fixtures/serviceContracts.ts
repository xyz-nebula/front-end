import type {
  AudioInputMessageDto,
  BackendErrorDto,
  ChatListItemDto,
  ChatWithMessagesResponseDto,
} from '../../src/services/real/targetContract'

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
