import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import type { RunAuthorized } from '@/services/serviceAdapters'
import {
  parseBackendError,
  parseChat,
  parseChatList,
  parseChatWithMessages,
  toActivateChatDto,
  toCreateChatDto,
  type ParsedChat,
  type ParsedChatWithMessages,
} from '@/services/real/targetContract'
import { featureUnavailable, isServiceError, ServiceError } from '@/types/api'
import type {
  NegotiationResultState,
  NegotiationSession,
  NegotiationSessionSummary,
  NegotiationStatus,
} from '@/types/negotiation'

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
  return status === 'ongoing' ? 'active' : 'finished'
}

function mapSession(chat: ParsedChatWithMessages): NegotiationSession {
  return {
    id: chat.id,
    caseId: chat.name,
    name: chat.name,
    mode: 'voice',
    status: mapStatus(chat.status),
    backendStatus: chat.status,
    startedAt: chat.createdAt,
    messages: chat.messages,
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
        body: toCreateChatDto(input.caseName ?? input.caseId),
      }))
      return mapSession({ ...created, messages: [] })
    })
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
    return this.demoResult(input.sessionId)
  }

  async getResult(sessionId: string): ReturnType<NegotiationClient['getResult']> {
    return this.demoResult(sessionId)
  }

  private demoResult(sessionId: string): NegotiationResultState {
    return {
      status: 'ready',
      result: {
        sessionId,
        outcome: 'victory',
        score: 74,
        summary: 'Демонстрационный разбор показывает будущий формат обратной связи и не является ответом сервиса.',
        strengths: ['Вы обозначили позицию и поддерживали диалог', 'Разговор сохранён в истории чата'],
        improvements: ['Задавайте больше открытых вопросов', 'Фиксируйте конкретные следующие шаги'],
        recommendations: ['Просмотрите сохранённые реплики и подготовьте альтернативный вариант предложения'],
      },
    }
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
