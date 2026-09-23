import type { AudioEngineEvent, AudioFormat, AudioInputFrame } from '@/types/audio'
import { ServiceError } from '@/types/api'
import type {
  AudioTicket,
  MessageSpeaker,
  NegotiationMessage,
  NegotiationMode,
  NegotiationResult,
  NegotiationResultState,
  NegotiationSession,
  NegotiationSessionSummary,
  NegotiationStatus,
  TextTurnResult,
} from '@/types/negotiation'

export interface NegotiationMessageDto {
  id: string
  sequence: number
  speaker: MessageSpeaker
  text: string
  created_at: string
}

export interface NegotiationSessionDto {
  id: string
  case_id: string
  mode: NegotiationMode
  status: NegotiationStatus
  started_at: string
  finished_at?: string
  messages: NegotiationMessageDto[]
}

export interface NegotiationResultDto {
  session_id: string
  outcome: 'victory' | 'defeat'
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
  recommendations: string[]
}

export type NegotiationResultStateDto =
  | { status: 'processing' }
  | { status: 'ready'; result: NegotiationResultDto }
  | { status: 'failed'; message: string }

export interface NegotiationSessionSummaryDto {
  id: string
  case_id: string
  mode: NegotiationMode
  status: NegotiationStatus
  started_at: string
  finished_at?: string
  score?: number
}

export interface TextTurnResultDto {
  user_message: NegotiationMessageDto
  ai_message: NegotiationMessageDto
  session_status: NegotiationStatus
}

export interface AudioTicketDto {
  ticket: string
  expires_at: string
  protocol: 'audio-engine.v1'
}

export interface AudioFormatDto {
  codec: 'pcm_s16le'
  sample_rate: 24000
  channels: 1
  bit_depth: 16
}

export type AudioEngineEventDto =
  | { type: 'transcript_partial'; speaker: MessageSpeaker; text: string }
  | { type: 'message_committed'; event_id: string; message: NegotiationMessageDto }
  | {
      type: 'audio_frame'
      sequence: number
      timestamp: number
      format: AudioFormatDto
      payload: string
    }
  | { type: 'error'; code: string; message: string; recoverable: boolean }
  | { type: 'closed'; code: number; reason: string; reconnect_allowed: boolean }

export interface CreateSessionRequestDto {
  case_id: string
  mode: NegotiationMode
}

export interface TextTurnRequestDto {
  text: string
}

export interface TranscriptCommitRequestDto {
  event_id: string
  speaker: MessageSpeaker
  text: string
  created_at: string
}

export interface AudioInputFrameDto {
  type: 'audio_input'
  sequence: number
  timestamp: number
  format: AudioFormatDto
  payload: string
}

export interface AudioControlDto {
  type: 'control'
  action: 'pause' | 'resume' | 'stop' | 'close'
}

export interface BackendErrorDto {
  code: string
  message: string
  field?: string
}

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

function string(value: unknown, path: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : invalidResponse(path)
}

function isoDate(value: unknown, path: string): string {
  const parsed = string(value, path)
  return Number.isNaN(Date.parse(parsed)) ? invalidResponse(path) : parsed
}

function optionalIsoDate(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : isoDate(value, path)
}

function positiveInteger(value: unknown, path: string): number {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : invalidResponse(path)
}

function finiteNumber(value: unknown, path: string): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : invalidResponse(path)
}

function boolean(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : invalidResponse(path)
}

function oneOf<T extends string>(value: unknown, values: readonly T[], path: string): T {
  return typeof value === 'string' && values.includes(value as T)
    ? value as T
    : invalidResponse(path)
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) return invalidResponse(path)
  return value.map((item, index) => string(item, `${path}[${index}]`))
}

function parseMessage(value: unknown, path: string): NegotiationMessage {
  const dto = record(value, path)
  return {
    id: string(dto.id, `${path}.id`),
    sequence: positiveInteger(dto.sequence, `${path}.sequence`),
    speaker: oneOf(dto.speaker, ['user', 'ai'], `${path}.speaker`),
    text: string(dto.text, `${path}.text`),
    createdAt: isoDate(dto.created_at, `${path}.created_at`),
  }
}

function parseStatus(value: unknown, path: string): NegotiationStatus {
  return oneOf(value, ['active', 'finishing', 'finished'], path)
}

function parseMode(value: unknown, path: string): NegotiationMode {
  return oneOf(value, ['text', 'voice'], path)
}

function parseResult(value: unknown, path: string): NegotiationResult {
  const dto = record(value, path)
  const score = finiteNumber(dto.score, `${path}.score`)
  if (score < 0 || score > 100) return invalidResponse(`${path}.score`)
  return {
    sessionId: string(dto.session_id, `${path}.session_id`),
    outcome: oneOf(dto.outcome, ['victory', 'defeat'], `${path}.outcome`),
    score,
    summary: string(dto.summary, `${path}.summary`),
    strengths: stringArray(dto.strengths, `${path}.strengths`),
    improvements: stringArray(dto.improvements, `${path}.improvements`),
    recommendations: stringArray(dto.recommendations, `${path}.recommendations`),
  }
}

function parseFormat(value: unknown, path: string): AudioFormat {
  const dto = record(value, path)
  if (
    dto.codec !== 'pcm_s16le'
    || dto.sample_rate !== 24_000
    || dto.channels !== 1
    || dto.bit_depth !== 16
  ) return invalidResponse(path)
  return { codec: 'pcm_s16le', sampleRate: 24_000, channels: 1, bitDepth: 16 }
}

export function parseNegotiationSession(value: unknown): NegotiationSession {
  const dto = record(value, 'session')
  if (!Array.isArray(dto.messages)) return invalidResponse('session.messages')
  return {
    id: string(dto.id, 'session.id'),
    caseId: string(dto.case_id, 'session.case_id'),
    mode: parseMode(dto.mode, 'session.mode'),
    status: parseStatus(dto.status, 'session.status'),
    startedAt: isoDate(dto.started_at, 'session.started_at'),
    finishedAt: optionalIsoDate(dto.finished_at, 'session.finished_at'),
    messages: dto.messages.map((message, index) => parseMessage(message, `session.messages[${index}]`)),
  }
}

export function parseTextTurnResult(value: unknown): TextTurnResult {
  const dto = record(value, 'textTurn')
  return {
    userMessage: parseMessage(dto.user_message, 'textTurn.user_message'),
    aiMessage: parseMessage(dto.ai_message, 'textTurn.ai_message'),
    sessionStatus: parseStatus(dto.session_status, 'textTurn.session_status'),
  }
}

export function parseAudioTicket(value: unknown): AudioTicket {
  const dto = record(value, 'audioTicket')
  if (dto.protocol !== 'audio-engine.v1') return invalidResponse('audioTicket.protocol')
  return {
    ticket: string(dto.ticket, 'audioTicket.ticket'),
    expiresAt: isoDate(dto.expires_at, 'audioTicket.expires_at'),
    protocol: 'audio-engine.v1',
  }
}

export function parseNegotiationResultState(value: unknown): NegotiationResultState {
  const dto = record(value, 'resultState')
  const status = oneOf(dto.status, ['processing', 'ready', 'failed'], 'resultState.status')
  if (status === 'processing') return { status }
  if (status === 'failed') return { status, message: string(dto.message, 'resultState.message') }
  return { status, result: parseResult(dto.result, 'resultState.result') }
}

export function parseSessionList(value: unknown): NegotiationSessionSummary[] {
  if (!Array.isArray(value)) return invalidResponse('sessions')
  return value.map((item, index) => {
    const path = `sessions[${index}]`
    const dto = record(item, path)
    const score = dto.score === undefined ? undefined : finiteNumber(dto.score, `${path}.score`)
    if (score !== undefined && (score < 0 || score > 100)) return invalidResponse(`${path}.score`)
    return {
      id: string(dto.id, `${path}.id`),
      caseId: string(dto.case_id, `${path}.case_id`),
      mode: parseMode(dto.mode, `${path}.mode`),
      status: parseStatus(dto.status, `${path}.status`),
      startedAt: isoDate(dto.started_at, `${path}.started_at`),
      finishedAt: optionalIsoDate(dto.finished_at, `${path}.finished_at`),
      score,
    }
  })
}

export function parseAudioEngineEvent(value: unknown): AudioEngineEvent {
  const dto = record(value, 'audioEvent')
  const type = oneOf(
    dto.type,
    ['transcript_partial', 'message_committed', 'audio_frame', 'error', 'closed'],
    'audioEvent.type',
  )
  if (type === 'transcript_partial') {
    return {
      type,
      speaker: oneOf(dto.speaker, ['user', 'ai'], 'audioEvent.speaker'),
      text: string(dto.text, 'audioEvent.text'),
    }
  }
  if (type === 'message_committed') {
    return {
      type,
      eventId: string(dto.event_id, 'audioEvent.event_id'),
      message: parseMessage(dto.message, 'audioEvent.message'),
    }
  }
  if (type === 'audio_frame') {
    return {
      type,
      sequence: positiveInteger(dto.sequence, 'audioEvent.sequence'),
      timestamp: positiveInteger(dto.timestamp, 'audioEvent.timestamp'),
      format: parseFormat(dto.format, 'audioEvent.format'),
      payload: string(dto.payload, 'audioEvent.payload'),
    }
  }
  if (type === 'error') {
    return {
      type,
      code: string(dto.code, 'audioEvent.code'),
      message: string(dto.message, 'audioEvent.message'),
      recoverable: boolean(dto.recoverable, 'audioEvent.recoverable'),
    }
  }
  return {
    type,
    code: positiveInteger(dto.code, 'audioEvent.code'),
    reason: string(dto.reason, 'audioEvent.reason'),
    reconnectAllowed: boolean(dto.reconnect_allowed, 'audioEvent.reconnect_allowed'),
  }
}

export function parseBackendError(value: unknown, status: number): ServiceError {
  const dto = record(value, 'error')
  return new ServiceError(string(dto.message, 'error.message'), {
    reason: 'http',
    status,
    code: string(dto.code, 'error.code'),
    field: dto.field === undefined ? undefined : string(dto.field, 'error.field'),
  })
}

export function toCreateSessionDto(input: {
  caseId: string
  mode: NegotiationMode
}): CreateSessionRequestDto {
  return { case_id: input.caseId, mode: input.mode }
}

export function toTextTurnDto(text: string): TextTurnRequestDto {
  return { text }
}

export function toAudioInputFrameDto(frame: AudioInputFrame): AudioInputFrameDto {
  return {
    type: 'audio_input',
    sequence: frame.sequence,
    timestamp: frame.timestamp,
    format: {
      codec: frame.format.codec,
      sample_rate: frame.format.sampleRate,
      channels: frame.format.channels,
      bit_depth: frame.format.bitDepth,
    },
    payload: frame.payload,
  }
}
