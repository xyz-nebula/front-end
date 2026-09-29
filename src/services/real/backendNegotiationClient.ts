import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import { getCasePresentation } from '@/features/cases/casePresentation'
import type { RunAuthorized } from '@/services/serviceAdapters'
import {
  parseBackendError,
  parseCases,
  parseChat,
  parseChatList,
  parseChatWithMessages,
  parseEvaluateTrigger,
  parseEvaluationResult,
  toActivateChatDto,
  toCreateChatDto,
  type ParsedChat,
  type ParsedChatWithMessages,
} from '@/services/real/targetContract'
import { featureUnavailable, isServiceError, ServiceError } from '@/types/api'
import type {
  NegotiationSession,
  NegotiationSessionSummary,
  NegotiationStatus,
} from '@/types/negotiation'
import type { TrainingCase } from '@/types/case'

interface BackendNegotiationClientOptions {
  baseUrl: string
  timeoutMs: number
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
}

const defaultOptions: BackendNegotiationClientOptions = {
  baseUrl: '/api',
  timeoutMs: 20_000,
}

function mapStatus(status: ParsedChat['status']): NegotiationStatus {
  if (status === 'ongoing') return 'active'
  if (status === 'evaluating') return 'finishing'
  return 'finished'
}

function mapSession(chat: ParsedChatWithMessages): NegotiationSession {
  if (!chat.case) {
    throw new ServiceError('Сервер не вернул кейс переговоров.', {
      reason: 'invalid-response', code: 'INVALID_SERVICE_RESPONSE',
    })
  }
  return {
    id: chat.id,
    caseId: chat.case.id,
    caseSnapshot: {
      id: chat.case.id,
      title: chat.case.name,
      description: chat.case.description,
      goal: chat.case.goal,
      timeLimitSeconds: chat.case.timeLimit,
      roles: [chat.case.firstRole, chat.case.secondRole],
    },
    name: chat.case?.name ?? chat.name,
    mode: 'voice',
    status: mapStatus(chat.status),
    backendStatus: chat.status,
    selectedRole: chat.selectedRole === 0 ? 1 : 0,
    preparations: chat.preparations,
    startedAt: chat.createdAt,
    timeLimitSeconds: chat.case.timeLimit,
    messages: chat.messages,
  }
}

function formatTimeLimit(seconds: number): string {
  return `${Math.ceil(seconds / 60)} мин`
}

function mapCase(item: ReturnType<typeof parseCases>[number]): TrainingCase {
  return {
    id: item.id,
    title: item.name,
    description: item.description,
    goal: item.goal,
    synopsis: item.synopsis,
    category: item.category,
    duration: formatTimeLimit(item.timeLimit),
    timeLimitSeconds: item.timeLimit,
    difficulty: item.difficulty,
    opponent: item.secondRole,
    roles: [item.firstRole, item.secondRole],
    presentation: getCasePresentation({ id: item.id, title: item.name }),
  }
}

function mapSummary(chat: ParsedChat): NegotiationSessionSummary {
  return {
    id: chat.id,
    caseId: chat.name,
    name: chat.name,
    mode: 'voice',
    status: mapStatus(chat.status),
    backendStatus: chat.status,
    startedAt: chat.createdAt,
  }
}

function evaluationSessionStub(sessionId: string): NegotiationSession {
  return {
    id: sessionId,
    caseId: '',
    caseSnapshot: {
      id: '',
      title: '',
      description: '',
      goal: '',
      timeLimitSeconds: 1,
      roles: ['', ''],
    },
    mode: 'voice',
    status: 'finishing',
    startedAt: '',
    timeLimitSeconds: 1,
    messages: [],
  }
}

function isDoneEvaluation(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && 'status' in value
    && value.status === 'done'
}

function evaluationHttpError(error: ServiceError, action: 'start' | 'read'): ServiceError {
  const messages = action === 'start'
    ? {
        404: 'Переговоры не найдены.',
        409: 'Не удалось запустить разбор для текущего состояния переговоров.',
        422: 'Сервис не смог запустить разбор переговоров.',
      }
    : {
        404: 'Переговоры не найдены.',
        409: 'Разбор переговоров пока недоступен.',
        422: 'Сервис не смог получить разбор переговоров.',
      }
  const message = error.status === 404 || error.status === 409 || error.status === 422
    ? messages[error.status]
    : undefined
  if (!message) return error
  return new ServiceError(message, {
    reason: 'http',
    status: error.status,
    code: error.code,
    field: error.field,
    recoverable: true,
    cause: error,
  })
}

export class BackendNegotiationClient implements NegotiationClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(
    private readonly runAuthorized?: RunAuthorized,
    options: BackendNegotiationClientOptions = defaultOptions,
  ) {
    this.baseUrl = options.baseUrl
    this.timeoutMs = options.timeoutMs
  }

  private authorized<T>(operation: (accessToken: string) => Promise<T>): Promise<T> {
    if (!this.runAuthorized) return Promise.reject(featureUnavailable('negotiation'))
    return this.runAuthorized(operation)
  }

  private async request(
    accessToken: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<unknown> {
    const controller = new AbortController()
    let didTimeout = false
    const timer = globalThis.setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, this.timeoutMs)
    const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${accessToken}` })
    if (options.body !== undefined) headers.set('Content-Type', 'application/json')

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      })
      const text = await response.text()
      let payload: unknown
      if (text) {
        try {
          payload = JSON.parse(text) as unknown
        } catch (cause) {
          if (response.ok) {
            throw new ServiceError('Сервер вернул несовместимый ответ.', {
              reason: 'invalid-response', code: 'INVALID_SERVICE_RESPONSE', cause,
            })
          }
        }
      }
      if (!response.ok) {
        try {
          throw parseBackendError(payload, response.status)
        } catch (error) {
          if (isServiceError(error) && error.code !== 'INVALID_SERVICE_RESPONSE') throw error
          throw new ServiceError(
            response.status >= 500
              ? 'Сервис переговоров временно недоступен.'
              : 'Не удалось выполнить запрос к сервису переговоров.',
            { reason: 'http', status: response.status, code: 'CHAT_REQUEST_FAILED' },
          )
        }
      }
      return payload
    } catch (error) {
      if (isServiceError(error)) throw error
      if (didTimeout) {
        throw new ServiceError('Сервис переговоров не ответил вовремя.', {
          reason: 'timeout', code: 'CHAT_REQUEST_TIMEOUT', cause: error,
        })
      }
      throw new ServiceError('Не удалось связаться с сервисом переговоров.', {
        reason: 'network', code: 'CHAT_NETWORK_ERROR', cause: error,
      })
    } finally {
      globalThis.clearTimeout(timer)
    }
  }

  createSession(input: Parameters<NegotiationClient['createSession']>[0]): Promise<NegotiationSession> {
    return this.authorized(async (accessToken) => {
      const created = parseChat(await this.request(accessToken, '/v1/chats/', {
        method: 'POST',
        body: toCreateChatDto(input.caseName ?? input.caseId, input.caseId, input.preparations, input.selectedRole),
      }))
      return {
        id: created.id,
        caseId: input.caseId,
        caseSnapshot: input.caseSnapshot,
        name: input.caseName ?? created.name,
        mode: input.mode,
        status: mapStatus(created.status),
        backendStatus: created.status,
        selectedRole: created.selectedRole === 0 ? 1 : 0,
        preparations: created.preparations,
        startedAt: created.createdAt,
        timeLimitSeconds: input.timeLimitSeconds,
        messages: [],
      }
    })
  }

  listCases(): Promise<TrainingCase[]> {
    return this.authorized(async (accessToken) => parseCases(
      await this.request(accessToken, '/v1/chats/cases'),
    ).map(mapCase))
  }

  getSession(sessionId: string): Promise<NegotiationSession> {
    return this.authorized(async (accessToken) => mapSession(parseChatWithMessages(
      await this.request(accessToken, `/v1/chats/${encodeURIComponent(sessionId)}`),
    )))
  }

  activateSession(sessionId: string): Promise<void> {
    return this.authorized(async (accessToken) => {
      await this.request(accessToken, '/v1/chats/active', {
        method: 'PUT',
        body: toActivateChatDto(sessionId),
      })
    })
  }

  async sendTextTurn(): ReturnType<NegotiationClient['sendTextTurn']> {
    throw featureUnavailable('negotiation')
  }

  async createAudioTicket(): ReturnType<NegotiationClient['createAudioTicket']> {
    throw featureUnavailable('audio')
  }

  async finishSession(input: Parameters<NegotiationClient['finishSession']>[0]): ReturnType<NegotiationClient['finishSession']> {
    return this.authorized(async (accessToken) => {
      try {
        const trigger = parseEvaluateTrigger(await this.request(
          accessToken,
          `/v1/chats/${encodeURIComponent(input.sessionId)}/evaluate`,
          { method: 'POST' },
        ))
        if (trigger.status === 'failed') {
          return { status: 'failed', message: 'Не удалось запустить разбор переговоров.' }
        }
        return { status: 'processing' }
      } catch (error) {
        if (isServiceError(error) && error.status === 409 && error.code === 'already_evaluating') {
          return { status: 'processing' }
        }
        if (isServiceError(error)) throw evaluationHttpError(error, 'start')
        throw error
      }
    })
  }

  async getResult(sessionId: string): ReturnType<NegotiationClient['getResult']> {
    return this.authorized(async (accessToken) => {
      let payload: unknown
      try {
        payload = await this.request(
          accessToken,
          `/v1/chats/${encodeURIComponent(sessionId)}/result`,
        )
      } catch (error) {
        if (isServiceError(error) && error.status === 404 && error.code === 'evaluation_not_found') {
          return { status: 'failed', message: 'Разбор переговоров ещё не запускался.' }
        }
        if (isServiceError(error)) throw evaluationHttpError(error, 'read')
        throw error
      }

      const session = isDoneEvaluation(payload)
        ? mapSession(parseChatWithMessages(await this.request(
            accessToken,
            `/v1/chats/${encodeURIComponent(sessionId)}`,
          )))
        : evaluationSessionStub(sessionId)
      return parseEvaluationResult(payload, session)
    })
  }

  listSessions(): Promise<NegotiationSessionSummary[]> {
    return this.authorized(async (accessToken) => {
      const items = parseChatList(await this.request(accessToken, '/v1/chats/'))
      if (items.length === 0) return []

      const summaries: Array<NegotiationSessionSummary | undefined> = new Array(items.length)
      let nextIndex = 0
      let firstError: unknown
      const worker = async () => {
        while (nextIndex < items.length) {
          const index = nextIndex
          nextIndex += 1
          try {
            const chat = parseChatWithMessages(await this.request(
              accessToken,
              `/v1/chats/${encodeURIComponent(items[index].id)}`,
            ))
            summaries[index] = mapSummary(chat)
          } catch (error) {
            if (isServiceError(error) && error.status === 401) throw error
            firstError ??= error
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker))
      const loaded = summaries.filter((item): item is NegotiationSessionSummary => item !== undefined)
      if (loaded.length === 0 && firstError) throw firstError
      return loaded.sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    })
  }
}
