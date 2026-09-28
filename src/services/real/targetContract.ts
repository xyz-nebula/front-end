import type { AudioFormat } from '@/types/audio'
import { ServiceError } from '@/types/api'
import type {
  MessageSpeaker,
  NegotiationCoachingPoint,
  NegotiationEvidence,
  NegotiationGoalStatus,
  NegotiationJudge,
  NegotiationOutcome,
  NegotiationOutcomeKind,
  NegotiationPlanStatus,
  NegotiationResult,
  NegotiationMessage,
  NegotiationResultState,
  NegotiationSession,
  NegotiationTrainer,
} from '@/types/negotiation'

export type ChatStatusDto = 'ongoing' | 'evaluating' | 'evaluated' | 'victory' | 'defeat'

export interface ChatCreateRequestDto { name: string; case_uuid: string; preparations: string; selected_role: 0 | 1 }
export interface ChatActivateRequestDto { uuid: string }
export interface ChatListItemDto { uuid: string; name: string }
export interface ChatResponseDto extends ChatListItemDto {
  status: ChatStatusDto
  created_at: string
  selected_role: 0 | 1
  preparations: string
}
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
export interface ParsedChat extends ParsedChatListItem {
  status: ChatStatusDto
  createdAt: string
  selectedRole: 0 | 1
  preparations: string
}
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

export const EVALUATION_CONTRACT_VERSION = '2.0.0-rc.1' as const

export type EvaluationJobStatusDto = 'pending' | 'processing' | 'done' | 'failed'
export type EvaluationSlotStatusDto = 'ready' | 'failed'
export type EvaluationOutcomeKindDto =
  | 'agreement'
  | 'partial_agreement'
  | 'deferred'
  | 'no_agreement'
  | 'not_assessable'
export type EvaluationOutcomeErrorCodeDto =
  | 'outcome_analysis_unavailable'
  | 'invalid_outcome_analysis'
export type EvaluationJudgeCollegeDto = 'hiring' | 'negotiation' | 'ownership'
export type EvaluationJudgeChoiceDto = 'player' | 'opponent'
export type EvaluationJudgeCriterionDto =
  | 'Надёжность'
  | 'Отношение к людям'
  | 'Управленческая твёрдость'
  | 'Забота о команде'
  | 'Долгосрочные последствия управления'
  | 'Движение к цели'
  | 'Управление другой стороной'
  | 'Работа с картиной мира'
  | 'Управление ролями'
  | 'Сохранение отношений'
  | 'Качество решений'
  | 'Компетентность'
  | 'Ответственность'
  | 'Управление рисками'
  | 'Последствия для ресурсов'
export type EvaluationJudgeErrorCodeDto =
  | 'judge_unavailable'
  | 'invalid_judge_output'
  | 'judge_retrieval_unavailable'
  | 'invalid_judge_retrieval'
  | 'insufficient_evidence'
export type EvaluationPreparationStatusDto = 'followed' | 'adapted' | 'not_observed'
export type EvaluationGoalStatusDto =
  | 'achieved'
  | 'partially_achieved'
  | 'not_achieved'
  | 'not_assessable'
export type EvaluationTrainerErrorCodeDto =
  | 'trainer_unavailable'
  | 'invalid_trainer_output'
  | 'insufficient_evidence'

export interface EvaluationEvidenceDto {
  message_index: number
  is_ai: boolean
  quote: string
}

export interface EvaluationOutcomeAssessmentDto {
  kind: EvaluationOutcomeKindDto
  summary: string
  agreed_terms: string[]
  open_points: string[]
  next_step: string | null
  evidence: EvaluationEvidenceDto[]
}

export interface EvaluationOutcomeSlotDto {
  basis: 'dialogue_inference'
  status: EvaluationSlotStatusDto
  assessment: EvaluationOutcomeAssessmentDto | null
  error_code: EvaluationOutcomeErrorCodeDto | null
}

export interface EvaluationJudgeVerdictDto {
  college: EvaluationJudgeCollegeDto
  choice: EvaluationJudgeChoiceDto
  decisive_criterion: EvaluationJudgeCriterionDto
  evidence: EvaluationEvidenceDto
  observation: string
  effect: string
  comparison: string
}

export interface EvaluationJudgeSlotDto {
  college: EvaluationJudgeCollegeDto
  status: EvaluationSlotStatusDto
  verdict: EvaluationJudgeVerdictDto | null
  error_code: EvaluationJudgeErrorCodeDto | null
}

export interface EvaluationCoachingPointDto {
  evidence: EvaluationEvidenceDto
  action: string
  situation_change: string
  consequence: string
}

export interface EvaluationPreparationItemDto {
  preparation_text: string
  status: EvaluationPreparationStatusDto
  evidence: EvaluationEvidenceDto | null
  observation: string
}

export interface EvaluationPreparationComparisonDto {
  summary: string
  items: EvaluationPreparationItemDto[]
}

export interface EvaluationGoalAssessmentDto {
  status: EvaluationGoalStatusDto
  goal_text: string | null
  explanation: string
  evidence: EvaluationEvidenceDto[]
}

export interface EvaluationTrainerFeedbackDto {
  summary: string
  strengths: EvaluationCoachingPointDto[]
  mistakes: EvaluationCoachingPointDto[]
  next_try: string[]
  plan_vs_reality: EvaluationPreparationComparisonDto | null
  missed_opportunities: EvaluationCoachingPointDto[]
  goal_assessment: EvaluationGoalAssessmentDto
}

export interface EvaluationTrainerSlotDto {
  status: EvaluationSlotStatusDto
  feedback: EvaluationTrainerFeedbackDto | null
  error_code: EvaluationTrainerErrorCodeDto | null
}

export interface EvaluationResponseDto {
  contract_version: typeof EVALUATION_CONTRACT_VERSION
  outcome: EvaluationOutcomeSlotDto
  judge_verdicts: EvaluationJudgeSlotDto[]
  trainer_feedback: EvaluationTrainerSlotDto
}

export interface EvaluateTriggerResponseDto {
  job_uuid: string
  status: EvaluationJobStatusDto
}

export interface EvaluationResultResponseDto {
  status: EvaluationJobStatusDto
  result: EvaluationResponseDto | null
  error: string | null
}

export interface ParsedEvaluateTrigger {
  jobId: string
  status: EvaluationJobStatusDto
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

function exactRecord(value: unknown, fields: readonly string[], path: string): Record<string, unknown> {
  const dto = record(value, path)
  const actual = Object.keys(dto)
  if (actual.length !== fields.length || actual.some((field) => !fields.includes(field))) {
    return invalidResponse(path)
  }
  return dto
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

function nullableNonEmptyString(value: unknown, path: string): string | null {
  return value === null ? null : nonEmptyString(value, path)
}

function booleanValue(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : invalidResponse(path)
}

function nonNegativeInteger(value: unknown, path: string): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : invalidResponse(path)
}

function arrayOf<T>(
  value: unknown,
  path: string,
  parse: (item: unknown, itemPath: string) => T,
): T[] {
  if (!Array.isArray(value)) return invalidResponse(path)
  return value.map((item, index) => parse(item, `${path}[${index}]`))
}

function nonEmptyStrings(value: unknown, path: string): string[] {
  return arrayOf(value, path, nonEmptyString)
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
    status: oneOf(dto.status, ['ongoing', 'evaluating', 'evaluated', 'victory', 'defeat'], `${path}.status`),
    createdAt: isoDate(dto.created_at, `${path}.created_at`),
    selectedRole: dto.selected_role === 0 || dto.selected_role === 1
      ? dto.selected_role
      : invalidResponse(`${path}.selected_role`),
    preparations: stringValue(dto.preparations, `${path}.preparations`),
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

const evaluationJobStatuses = ['pending', 'processing', 'done', 'failed'] as const
const evaluationSlotStatuses = ['ready', 'failed'] as const
const outcomeKinds = ['agreement', 'partial_agreement', 'deferred', 'no_agreement', 'not_assessable'] as const
const outcomeErrorCodes = ['outcome_analysis_unavailable', 'invalid_outcome_analysis'] as const
const judgeColleges = ['hiring', 'negotiation', 'ownership'] as const
const judgeChoices = ['player', 'opponent'] as const
const judgeCriteria = [
  'Надёжность',
  'Отношение к людям',
  'Управленческая твёрдость',
  'Забота о команде',
  'Долгосрочные последствия управления',
  'Движение к цели',
  'Управление другой стороной',
  'Работа с картиной мира',
  'Управление ролями',
  'Сохранение отношений',
  'Качество решений',
  'Компетентность',
  'Ответственность',
  'Управление рисками',
  'Последствия для ресурсов',
] as const
const judgeErrorCodes = [
  'judge_unavailable',
  'invalid_judge_output',
  'judge_retrieval_unavailable',
  'invalid_judge_retrieval',
  'insufficient_evidence',
] as const
const preparationStatuses = ['followed', 'adapted', 'not_observed'] as const
const goalStatuses = ['achieved', 'partially_achieved', 'not_achieved', 'not_assessable'] as const
const trainerErrorCodes = ['trainer_unavailable', 'invalid_trainer_output', 'insufficient_evidence'] as const

function parseEvidence(
  value: unknown,
  path: string,
  session: NegotiationSession,
): EvaluationEvidenceDto {
  const dto = exactRecord(value, ['message_index', 'is_ai', 'quote'], path)
  const messageIndex = nonNegativeInteger(dto.message_index, `${path}.message_index`)
  const message = session.messages[messageIndex]
  if (!message) return invalidResponse(`${path}.message_index`)
  const isAi = booleanValue(dto.is_ai, `${path}.is_ai`)
  if (isAi !== (message.speaker === 'ai')) return invalidResponse(`${path}.is_ai`)
  const quote = nonEmptyString(dto.quote, `${path}.quote`)
  if (!message.text.includes(quote)) return invalidResponse(`${path}.quote`)
  return { message_index: messageIndex, is_ai: isAi, quote }
}

function parseOutcomeAssessment(
  value: unknown,
  path: string,
  session: NegotiationSession,
): EvaluationOutcomeAssessmentDto {
  const dto = exactRecord(
    value,
    ['kind', 'summary', 'agreed_terms', 'open_points', 'next_step', 'evidence'],
    path,
  )
  const evidence = arrayOf(dto.evidence, `${path}.evidence`, (item, itemPath) => (
    parseEvidence(item, itemPath, session)
  ))
  if (evidence.length === 0) return invalidResponse(`${path}.evidence`)
  return {
    kind: oneOf(dto.kind, outcomeKinds, `${path}.kind`),
    summary: nonEmptyString(dto.summary, `${path}.summary`),
    agreed_terms: nonEmptyStrings(dto.agreed_terms, `${path}.agreed_terms`),
    open_points: nonEmptyStrings(dto.open_points, `${path}.open_points`),
    next_step: nullableNonEmptyString(dto.next_step, `${path}.next_step`),
    evidence,
  }
}

function parseOutcomeSlot(
  value: unknown,
  path: string,
  session: NegotiationSession,
): EvaluationOutcomeSlotDto {
  const dto = exactRecord(value, ['basis', 'status', 'assessment', 'error_code'], path)
  const status = oneOf(dto.status, evaluationSlotStatuses, `${path}.status`)
  if (dto.basis !== 'dialogue_inference') return invalidResponse(`${path}.basis`)
  if (status === 'ready') {
    if (dto.error_code !== null) return invalidResponse(`${path}.error_code`)
    return {
      basis: 'dialogue_inference',
      status,
      assessment: parseOutcomeAssessment(dto.assessment, `${path}.assessment`, session),
      error_code: null,
    }
  }
  if (dto.assessment !== null) return invalidResponse(`${path}.assessment`)
  return {
    basis: 'dialogue_inference',
    status,
    assessment: null,
    error_code: oneOf(dto.error_code, outcomeErrorCodes, `${path}.error_code`),
  }
}

function parseJudgeVerdict(
  value: unknown,
  path: string,
  session: NegotiationSession,
): EvaluationJudgeVerdictDto {
  const dto = exactRecord(
    value,
    ['college', 'choice', 'decisive_criterion', 'evidence', 'observation', 'effect', 'comparison'],
    path,
  )
  return {
    college: oneOf(dto.college, judgeColleges, `${path}.college`),
    choice: oneOf(dto.choice, judgeChoices, `${path}.choice`),
    decisive_criterion: oneOf(dto.decisive_criterion, judgeCriteria, `${path}.decisive_criterion`),
    evidence: parseEvidence(dto.evidence, `${path}.evidence`, session),
    observation: nonEmptyString(dto.observation, `${path}.observation`),
    effect: nonEmptyString(dto.effect, `${path}.effect`),
    comparison: nonEmptyString(dto.comparison, `${path}.comparison`),
  }
}

function parseJudgeSlot(
  value: unknown,
  path: string,
  session: NegotiationSession,
): EvaluationJudgeSlotDto {
  const dto = exactRecord(value, ['college', 'status', 'verdict', 'error_code'], path)
  const college = oneOf(dto.college, judgeColleges, `${path}.college`)
  const status = oneOf(dto.status, evaluationSlotStatuses, `${path}.status`)
  if (status === 'ready') {
    if (dto.error_code !== null) return invalidResponse(`${path}.error_code`)
    const verdict = parseJudgeVerdict(dto.verdict, `${path}.verdict`, session)
    if (verdict.college !== college) return invalidResponse(`${path}.verdict.college`)
    return { college, status, verdict, error_code: null }
  }
  if (dto.verdict !== null) return invalidResponse(`${path}.verdict`)
  return {
    college,
    status,
    verdict: null,
    error_code: oneOf(dto.error_code, judgeErrorCodes, `${path}.error_code`),
  }
}

function parseCoachingPoint(
  value: unknown,
  path: string,
  session: NegotiationSession,
): EvaluationCoachingPointDto {
  const dto = exactRecord(value, ['evidence', 'action', 'situation_change', 'consequence'], path)
  return {
    evidence: parseEvidence(dto.evidence, `${path}.evidence`, session),
    action: nonEmptyString(dto.action, `${path}.action`),
    situation_change: nonEmptyString(dto.situation_change, `${path}.situation_change`),
    consequence: nonEmptyString(dto.consequence, `${path}.consequence`),
  }
}

function parsePreparationComparison(
  value: unknown,
  path: string,
  session: NegotiationSession,
): EvaluationPreparationComparisonDto {
  const dto = exactRecord(value, ['summary', 'items'], path)
  const items = arrayOf(dto.items, `${path}.items`, (item, itemPath): EvaluationPreparationItemDto => {
    const itemDto = exactRecord(
      item,
      ['preparation_text', 'status', 'evidence', 'observation'],
      itemPath,
    )
    const status = oneOf(itemDto.status, preparationStatuses, `${itemPath}.status`)
    if (status === 'not_observed') {
      if (itemDto.evidence !== null) return invalidResponse(`${itemPath}.evidence`)
      return {
        preparation_text: nonEmptyString(itemDto.preparation_text, `${itemPath}.preparation_text`),
        status,
        evidence: null,
        observation: nonEmptyString(itemDto.observation, `${itemPath}.observation`),
      }
    }
    const evidence = parseEvidence(itemDto.evidence, `${itemPath}.evidence`, session)
    if (evidence.is_ai) return invalidResponse(`${itemPath}.evidence.is_ai`)
    return {
      preparation_text: nonEmptyString(itemDto.preparation_text, `${itemPath}.preparation_text`),
      status,
      evidence,
      observation: nonEmptyString(itemDto.observation, `${itemPath}.observation`),
    }
  })
  if (items.length === 0) return invalidResponse(`${path}.items`)
  return { summary: nonEmptyString(dto.summary, `${path}.summary`), items }
}

function parseGoalAssessment(
  value: unknown,
  path: string,
  session: NegotiationSession,
): EvaluationGoalAssessmentDto {
  const dto = exactRecord(value, ['status', 'goal_text', 'explanation', 'evidence'], path)
  const status = oneOf(dto.status, goalStatuses, `${path}.status`)
  const goalText = nullableNonEmptyString(dto.goal_text, `${path}.goal_text`)
  return {
    status,
    goal_text: goalText,
    explanation: nonEmptyString(dto.explanation, `${path}.explanation`),
    evidence: arrayOf(dto.evidence, `${path}.evidence`, (item, itemPath) => (
      parseEvidence(item, itemPath, session)
    )),
  }
}

function parseTrainerFeedback(
  value: unknown,
  path: string,
  session: NegotiationSession,
): EvaluationTrainerFeedbackDto {
  const dto = exactRecord(
    value,
    ['summary', 'strengths', 'mistakes', 'next_try', 'plan_vs_reality', 'missed_opportunities', 'goal_assessment'],
    path,
  )
  const coachingPoints = (items: unknown, field: string) => arrayOf(
    items,
    `${path}.${field}`,
    (item, itemPath) => parseCoachingPoint(item, itemPath, session),
  )
  const nextTry = nonEmptyStrings(dto.next_try, `${path}.next_try`)
  if (nextTry.length < 2 || nextTry.length > 3) return invalidResponse(`${path}.next_try`)
  return {
    summary: nonEmptyString(dto.summary, `${path}.summary`),
    strengths: coachingPoints(dto.strengths, 'strengths'),
    mistakes: coachingPoints(dto.mistakes, 'mistakes'),
    next_try: nextTry,
    plan_vs_reality: dto.plan_vs_reality === null
      ? null
      : parsePreparationComparison(dto.plan_vs_reality, `${path}.plan_vs_reality`, session),
    missed_opportunities: coachingPoints(dto.missed_opportunities, 'missed_opportunities'),
    goal_assessment: parseGoalAssessment(dto.goal_assessment, `${path}.goal_assessment`, session),
  }
}

function parseTrainerSlot(
  value: unknown,
  path: string,
  session: NegotiationSession,
): EvaluationTrainerSlotDto {
  const dto = exactRecord(value, ['status', 'feedback', 'error_code'], path)
  const status = oneOf(dto.status, evaluationSlotStatuses, `${path}.status`)
  if (status === 'ready') {
    if (dto.error_code !== null) return invalidResponse(`${path}.error_code`)
    return {
      status,
      feedback: parseTrainerFeedback(dto.feedback, `${path}.feedback`, session),
      error_code: null,
    }
  }
  if (dto.feedback !== null) return invalidResponse(`${path}.feedback`)
  return {
    status,
    feedback: null,
    error_code: oneOf(dto.error_code, trainerErrorCodes, `${path}.error_code`),
  }
}

function parseEvaluationResponse(
  value: unknown,
  path: string,
  session: NegotiationSession,
): EvaluationResponseDto {
  const dto = exactRecord(value, ['contract_version', 'outcome', 'judge_verdicts', 'trainer_feedback'], path)
  if (dto.contract_version !== EVALUATION_CONTRACT_VERSION) {
    return invalidResponse(`${path}.contract_version`)
  }
  const judgeVerdicts = arrayOf(dto.judge_verdicts, `${path}.judge_verdicts`, (item, itemPath) => (
    parseJudgeSlot(item, itemPath, session)
  ))
  if (
    judgeVerdicts.length !== judgeColleges.length
    || new Set(judgeVerdicts.map((slot) => slot.college)).size !== judgeColleges.length
    || judgeColleges.some((college) => !judgeVerdicts.some((slot) => slot.college === college))
  ) {
    return invalidResponse(`${path}.judge_verdicts`)
  }
  return {
    contract_version: EVALUATION_CONTRACT_VERSION,
    outcome: parseOutcomeSlot(dto.outcome, `${path}.outcome`, session),
    judge_verdicts: judgeVerdicts,
    trainer_feedback: parseTrainerSlot(dto.trainer_feedback, `${path}.trainer_feedback`, session),
  }
}

export function parseEvaluateTrigger(value: unknown): ParsedEvaluateTrigger {
  const dto = exactRecord(value, ['job_uuid', 'status'], 'evaluationTrigger')
  return {
    jobId: uuid(dto.job_uuid, 'evaluationTrigger.job_uuid'),
    status: oneOf(dto.status, evaluationJobStatuses, 'evaluationTrigger.status'),
  }
}

export function parseEvaluationResult(
  value: unknown,
  session: NegotiationSession,
): NegotiationResultState {
  const dto = exactRecord(value, ['status', 'result', 'error'], 'evaluationResult')
  const status = oneOf(dto.status, evaluationJobStatuses, 'evaluationResult.status')
  if (status === 'pending' || status === 'processing') {
    if (dto.result !== null || dto.error !== null) return invalidResponse('evaluationResult')
    return { status: 'processing' }
  }
  if (status === 'done') {
    if (dto.error !== null) return invalidResponse('evaluationResult.error')
    return {
      status: 'ready',
      result: toNegotiationResult(
        parseEvaluationResponse(dto.result, 'evaluationResult.result', session),
        session.id,
      ),
    }
  }
  if (dto.result !== null) return invalidResponse('evaluationResult.result')
  nonEmptyString(dto.error, 'evaluationResult.error')
  return { status: 'failed', message: 'Не удалось подготовить разбор переговоров.' }
}

function toEvidence(evidence: EvaluationEvidenceDto): NegotiationEvidence {
  return {
    messageIndex: evidence.message_index,
    isAi: evidence.is_ai,
    quote: evidence.quote,
  }
}

function toOutcome(slot: EvaluationOutcomeSlotDto): NegotiationOutcome {
  if (slot.status === 'failed') {
    return {
      status: 'failed',
      reason: slot.error_code === 'outcome_analysis_unavailable'
        ? 'analysis-unavailable'
        : 'invalid-analysis',
    }
  }
  if (slot.assessment === null) return invalidResponse('evaluationResult.result.outcome.assessment')
  return {
    status: 'ready',
    kind: slot.assessment.kind.replaceAll('_', '-') as NegotiationOutcomeKind,
    summary: slot.assessment.summary,
    agreedTerms: slot.assessment.agreed_terms,
    openPoints: slot.assessment.open_points,
    nextStep: slot.assessment.next_step,
    evidence: slot.assessment.evidence.map(toEvidence),
  }
}

function toJudge(slot: EvaluationJudgeSlotDto): NegotiationJudge {
  if (slot.status === 'failed') {
    const reasons: Record<EvaluationJudgeErrorCodeDto, Extract<NegotiationJudge, { status: 'failed' }>['reason']> = {
      judge_unavailable: 'unavailable',
      invalid_judge_output: 'invalid-output',
      judge_retrieval_unavailable: 'retrieval-unavailable',
      invalid_judge_retrieval: 'invalid-retrieval',
      insufficient_evidence: 'insufficient-evidence',
    }
    if (slot.error_code === null) return invalidResponse('evaluationResult.result.judge_verdicts.error_code')
    return { college: slot.college, status: 'failed', reason: reasons[slot.error_code] }
  }
  if (slot.verdict === null) return invalidResponse('evaluationResult.result.judge_verdicts.verdict')
  return {
    college: slot.college,
    status: 'ready',
    verdict: {
      choice: slot.verdict.choice === 'player' ? 'user' : 'opponent',
      criterion: slot.verdict.decisive_criterion,
      evidence: toEvidence(slot.verdict.evidence),
      observation: slot.verdict.observation,
      effect: slot.verdict.effect,
      comparison: slot.verdict.comparison,
    },
  }
}

function toCoachingPoint(point: EvaluationCoachingPointDto): NegotiationCoachingPoint {
  return {
    evidence: toEvidence(point.evidence),
    action: point.action,
    situationChange: point.situation_change,
    consequence: point.consequence,
  }
}

function toTrainer(slot: EvaluationTrainerSlotDto): NegotiationTrainer {
  if (slot.status === 'failed') {
    const reasons: Record<EvaluationTrainerErrorCodeDto, Extract<NegotiationTrainer, { status: 'failed' }>['reason']> = {
      trainer_unavailable: 'unavailable',
      invalid_trainer_output: 'invalid-output',
      insufficient_evidence: 'insufficient-evidence',
    }
    if (slot.error_code === null) return invalidResponse('evaluationResult.result.trainer_feedback.error_code')
    return { status: 'failed', reason: reasons[slot.error_code] }
  }
  const feedback = slot.feedback
  if (feedback === null) return invalidResponse('evaluationResult.result.trainer_feedback.feedback')
  return {
    status: 'ready',
    feedback: {
      summary: feedback.summary,
      strengths: feedback.strengths.map(toCoachingPoint),
      mistakes: feedback.mistakes.map(toCoachingPoint),
      missedOpportunities: feedback.missed_opportunities.map(toCoachingPoint),
      nextTry: feedback.next_try,
      planVsReality: feedback.plan_vs_reality === null ? null : {
        summary: feedback.plan_vs_reality.summary,
        items: feedback.plan_vs_reality.items.map((item) => ({
          preparationText: item.preparation_text,
          status: (item.status === 'not_observed' ? 'unused' : item.status) as NegotiationPlanStatus,
          evidence: item.evidence === null ? null : toEvidence(item.evidence),
          observation: item.observation,
        })),
      },
      goalAssessment: {
        status: feedback.goal_assessment.status.replaceAll('_', '-') as NegotiationGoalStatus,
        goalText: feedback.goal_assessment.goal_text,
        explanation: feedback.goal_assessment.explanation,
        evidence: feedback.goal_assessment.evidence.map(toEvidence),
      },
    },
  }
}

function toNegotiationResult(response: EvaluationResponseDto, sessionId: string): NegotiationResult {
  return {
    sessionId,
    source: 'server',
    contractVersion: response.contract_version,
    outcome: toOutcome(response.outcome),
    judges: [
      toJudge(response.judge_verdicts[0]),
      toJudge(response.judge_verdicts[1]),
      toJudge(response.judge_verdicts[2]),
    ],
    trainer: toTrainer(response.trainer_feedback),
  }
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

export function toCreateChatDto(name: string, caseId: string, preparations: string, userSelectedRole: 0 | 1): ChatCreateRequestDto {
  return { name, case_uuid: caseId, preparations, selected_role: userSelectedRole === 0 ? 1 : 0 }
}
export function toActivateChatDto(id: string): ChatActivateRequestDto { return { uuid: id } }
export function toAudioInputDto(audio: string): AudioInputMessageDto { return { type: 'audio', audio } }
export function toAudioControlDto(action: AudioControlDto['action']): AudioControlDto { return { type: 'control', action } }
