import type { AudioFormat } from '@/types/audio'
import { ServiceError } from '@/types/api'
import type { MessageSpeaker, NegotiationMessage } from '@/types/negotiation'

export type ChatStatusDto = 'victory' | 'defeat' | 'ongoing'

export interface ChatCreateRequestDto { name: string; case_uuid: string; preparations: string; selected_role: 0 | 1 }
export interface ChatActivateRequestDto { uuid: string }
export interface ChatListItemDto { uuid: string; name: string }
export interface ChatResponseDto extends ChatListItemDto { status: ChatStatusDto; created_at: string }
export interface MessageResponseDto {
  uuid: string
  sequence: number
  is_ai: boolean
  text: string
  created_at: string
}
export interface CaseResponseDto {
  uuid: string
  created_at: string
  name: string
  description: string
  category: string
  difficulty: string
  time_limit: number
  first_role_preparations: string
  second_role_preparations: string
  goal: string
  synopsis: string
  first_role: string
  second_role: string
}
export interface ChatWithMessagesResponseDto extends ChatResponseDto { case?: CaseResponseDto; messages: MessageResponseDto[] }

export interface ParsedChatListItem { id: string; name: string }
export interface ParsedChat extends ParsedChatListItem { status: ChatStatusDto; createdAt: string }
export interface ParsedCase {
  id: string
  name: string
  description: string
  category: string
  difficulty: string
  timeLimit: number
  synopsis: string
  firstRole: string
  secondRole: string
}
export interface ParsedChatWithMessages extends ParsedChat { case?: ParsedCase; messages: NegotiationMessage[] }

export interface AudioFormatDto {
  codec: 'pcm_s16le'
  sample_rate: 24000
  channels: 1
  bit_depth: 16
}

export type RemoteAudioEngineEvent =
  | { type: 'transcript_delta'; speaker: MessageSpeaker; text: string }
  | { type: 'audio_frame'; sequence: number; timestamp: number; format: AudioFormat; payload: string }
  | { type: 'error'; code: string; message: string }
  | {
      type: 'auth_error'
      code: 'invalid_protocol' | 'missing_token' | 'expired_token' | 'invalid_token'
      message: string
    }

export interface AudioInputMessageDto { type: 'audio'; audio: string }
export interface AudioControlDto { type: 'control'; action: 'pause' | 'resume' | 'stop' | 'close' }
export interface BackendErrorDto { code: string; message: string; field?: string }

function invalidResponse(path: string): never {
  throw new ServiceError(`Некорректный ответ сервиса: ${path}.`, {
    reason: 'invalid-response',
    code: 'INVALID_SERVICE_RESPONSE',
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function record(value: unknown, path: string): Record<string, unknown> {
  return isRecord(value) ? value : invalidResponse(path)
}

function nonEmptyString(value: unknown, path: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : invalidResponse(path)
}

function nonEmptyChunk(value: unknown, path: string): string {
  return typeof value === 'string' && value.length > 0 ? value : invalidResponse(path)
}

function stringValue(value: unknown, path: string): string {
  return typeof value === 'string' ? value : invalidResponse(path)
}

function uuid(value: unknown, path: string): string {
  const parsed = nonEmptyString(value, path)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)
    ? parsed
    : invalidResponse(path)
}

function isoDate(value: unknown, path: string): string {
  const parsed = nonEmptyString(value, path)
  return Number.isNaN(Date.parse(parsed)) ? invalidResponse(path) : parsed
}

function positiveInteger(value: unknown, path: string): number {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : invalidResponse(path)
}

function oneOf<T extends string>(value: unknown, values: readonly T[], path: string): T {
  return typeof value === 'string' && values.includes(value as T) ? value as T : invalidResponse(path)
}

function parseFormat(value: unknown, path: string): AudioFormat {
  const dto = record(value, path)
  if (dto.codec !== 'pcm_s16le' || dto.sample_rate !== 24_000 || dto.channels !== 1 || dto.bit_depth !== 16) {
    return invalidResponse(path)
  }
  return { codec: 'pcm_s16le', sampleRate: 24_000, channels: 1, bitDepth: 16 }
}

function parseMessage(value: unknown, path: string): NegotiationMessage {
  const dto = record(value, path)
  return {
    id: uuid(dto.uuid, `${path}.uuid`),
    sequence: positiveInteger(dto.sequence, `${path}.sequence`),
    speaker: dto.is_ai === true ? 'ai' : dto.is_ai === false ? 'user' : invalidResponse(`${path}.is_ai`),
    text: nonEmptyString(dto.text, `${path}.text`),
    createdAt: isoDate(dto.created_at, `${path}.created_at`),
  }
}

function parseChatBase(value: unknown, path: string): ParsedChat {
  const dto = record(value, path)
  return {
    id: uuid(dto.uuid, `${path}.uuid`),
    name: nonEmptyString(dto.name, `${path}.name`),
    status: oneOf(dto.status, ['victory', 'defeat', 'ongoing'], `${path}.status`),
    createdAt: isoDate(dto.created_at, `${path}.created_at`),
  }
}

export function parseChatList(value: unknown): ParsedChatListItem[] {
  if (!Array.isArray(value)) return invalidResponse('chats')
  return value.map((item, index) => {
    const path = `chats[${index}]`
    const dto = record(item, path)
    return { id: uuid(dto.uuid, `${path}.uuid`), name: nonEmptyString(dto.name, `${path}.name`) }
  })
}

export function parseChat(value: unknown): ParsedChat {
  return parseChatBase(value, 'chat')
}

export function parseChatWithMessages(value: unknown): ParsedChatWithMessages {
  const dto = record(value, 'chat')
  if (!Array.isArray(dto.messages)) return invalidResponse('chat.messages')
  const messages = dto.messages.map((message, index) => parseMessage(message, `chat.messages[${index}]`))
  const uniqueMessages = [...new Map(messages.map((message) => [message.id, message])).values()]
  return {
    ...parseChatBase(dto, 'chat'),
    ...(dto.case === undefined ? {} : { case: parseCase(dto.case, 'chat.case') }),
    messages: uniqueMessages.sort((left, right) => left.sequence - right.sequence),
  }
}

function parseCase(value: unknown, path: string): ParsedCase {
  const dto = record(value, path)
  // Role preparations are deliberately validated but not exposed: they contain
  // hidden scenario context intended for the corresponding negotiation role.
  stringValue(dto.first_role_preparations, `${path}.first_role_preparations`)
  stringValue(dto.second_role_preparations, `${path}.second_role_preparations`)
  return {
    id: uuid(dto.uuid, `${path}.uuid`),
    name: nonEmptyString(dto.name, `${path}.name`),
    description: stringValue(dto.description, `${path}.description`),
    category: nonEmptyString(dto.category, `${path}.category`),
    difficulty: nonEmptyString(dto.difficulty, `${path}.difficulty`),
    timeLimit: positiveInteger(dto.time_limit, `${path}.time_limit`),
    synopsis: stringValue(dto.synopsis, `${path}.synopsis`),
    firstRole: nonEmptyString(dto.first_role, `${path}.first_role`),
    secondRole: nonEmptyString(dto.second_role, `${path}.second_role`),
  }
}

export function parseCases(value: unknown): ParsedCase[] {
  if (!Array.isArray(value)) return invalidResponse('cases')
  return value.map((item, index) => parseCase(item, `cases[${index}]`))
}

export function parseAudioEngineEvent(value: unknown): RemoteAudioEngineEvent {
  const dto = record(value, 'audioEvent')
  const type = oneOf(dto.type, ['transcript', 'audio_frame', 'error', 'auth_error'], 'audioEvent.type')
  if (type === 'transcript') {
    const role = oneOf(dto.role, ['user', 'assistant'], 'audioEvent.role')
    return {
      type: 'transcript_delta',
      speaker: role === 'assistant' ? 'ai' : 'user',
      text: nonEmptyChunk(dto.text, 'audioEvent.text'),
    }
  }
  if (type === 'audio_frame') {
    return {
      type,
      sequence: positiveInteger(dto.sequence, 'audioEvent.sequence'),
      timestamp: positiveInteger(dto.timestamp, 'audioEvent.timestamp'),
      format: parseFormat(dto.format, 'audioEvent.format'),
      payload: nonEmptyString(dto.payload, 'audioEvent.payload'),
    }
  }
  if (type === 'auth_error') {
    return {
      type,
      code: oneOf(dto.code, ['invalid_protocol', 'missing_token', 'expired_token', 'invalid_token'], 'audioEvent.code'),
      message: nonEmptyString(dto.message, 'audioEvent.message'),
    }
  }
  return { type, code: nonEmptyString(dto.code, 'audioEvent.code'), message: nonEmptyString(dto.message, 'audioEvent.message') }
}

export function parseBackendError(value: unknown, status: number): ServiceError {
  const dto = record(value, 'error')
  return new ServiceError(nonEmptyString(dto.message, 'error.message'), {
    reason: 'http',
    status,
    code: nonEmptyString(dto.code, 'error.code'),
    field: dto.field === undefined ? undefined : nonEmptyString(dto.field, 'error.field'),
  })
}

export function toCreateChatDto(name: string, caseId: string, preparations: string, selectedRole: 0 | 1): ChatCreateRequestDto {
  return { name, case_uuid: caseId, preparations, selected_role: selectedRole }
}
export function toActivateChatDto(id: string): ChatActivateRequestDto { return { uuid: id } }
export function toAudioInputDto(audio: string): AudioInputMessageDto { return { type: 'audio', audio } }
export function toAudioControlDto(action: AudioControlDto['action']): AudioControlDto { return { type: 'control', action } }
