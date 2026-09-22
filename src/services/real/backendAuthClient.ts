import type { AuthClient } from '@/services/contracts/authClient'
import { AuthClientError, isAuthClientError } from '@/services/contracts/authClient'
import type {
  AuthRegisterResponse,
  AuthTokens,
  TotpEnrollResponse,
} from '@/types/auth'

interface AuthTokensResponse {
  access_token: string
  refresh_token: string
}

interface ValidationIssue {
  loc?: unknown
  msg?: unknown
}

interface BackendAuthClientOptions {
  baseUrl: string
  timeoutMs: number
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  accessToken?: string
  timeoutMs?: number
  keepalive?: boolean
}

const LOGOUT_TIMEOUT_MS = 3_000
const invalidResponseMessage = 'Сервер вернул несовместимый ответ. Попробуйте ещё раз позже.'

const statusMessages: Record<number, string> = {
  0: 'Не удалось связаться с сервером. Проверьте подключение к интернету.',
  401: 'Сервер не смог подтвердить учётные данные.',
  403: 'Для этого действия недостаточно прав.',
  404: 'Запрошенные данные не найдены.',
  409: 'Такие данные уже используются.',
  422: 'Проверьте правильность заполнения полей.',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function parseFieldErrors(payload: unknown): Record<string, string> {
  if (!isRecord(payload) || !Array.isArray(payload.detail)) return {}

  return payload.detail.reduce<Record<string, string>>((errors, value) => {
    if (!isRecord(value)) return errors
    const issue = value as ValidationIssue
    if (!Array.isArray(issue.loc) || typeof issue.msg !== 'string') return errors
    const field = [...issue.loc]
      .reverse()
      .find((part): part is string => typeof part === 'string' && part !== 'body')
    if (field && !errors[field]) errors[field] = issue.msg
    return errors
  }, {})
}

function isAuthTokensResponse(payload: unknown): payload is AuthTokensResponse {
  return isRecord(payload)
    && isNonEmptyString(payload.access_token)
    && isNonEmptyString(payload.refresh_token)
}

function isUserStatus(value: unknown): value is AuthRegisterResponse['status'] {
  return value === 'pending_activation' || value === 'active' || value === 'suspended'
}

function isAuthRegisterResponse(payload: unknown): payload is AuthRegisterResponse {
  return isRecord(payload)
    && typeof payload.user_id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.user_id)
    && isUserStatus(payload.status)
}

function isTotpEnrollResponse(payload: unknown): payload is TotpEnrollResponse {
  return isRecord(payload)
    && isNonEmptyString(payload.secret)
    && isNonEmptyString(payload.otpauth_url)
}

function mapTokens(response: AuthTokensResponse): AuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
  }
}

export class BackendAuthClient implements AuthClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor({ baseUrl, timeoutMs }: BackendAuthClientOptions) {
    this.baseUrl = baseUrl
    this.timeoutMs = timeoutMs
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text()
    if (!text) return undefined

    try {
      return JSON.parse(text) as unknown
    } catch {
      if (response.ok) {
        throw new AuthClientError(response.status, invalidResponseMessage, {}, 'invalid-response')
      }
      return undefined
    }
  }

  private async request(path: string, options: RequestOptions = {}): Promise<unknown> {
    const headers = new Headers({ Accept: 'application/json' })
    if (options.body !== undefined) headers.set('Content-Type', 'application/json')
    if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`)
    const controller = new AbortController()
    let didTimeout = false
    const timeoutId = window.setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, options.timeoutMs ?? this.timeoutMs)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        keepalive: options.keepalive,
      })
      const payload = await this.parseResponse(response)
      if (!response.ok) {
        const fallback = response.status >= 500
          ? 'Сервис временно недоступен. Попробуйте ещё раз позже.'
          : 'Не удалось выполнить запрос.'
        throw new AuthClientError(
          response.status,
          statusMessages[response.status] ?? fallback,
          parseFieldErrors(payload),
        )
      }
      return payload
    } catch (error) {
      if (isAuthClientError(error)) throw error
      if (didTimeout) {
        throw new AuthClientError(0, 'Сервер не ответил вовремя. Попробуйте ещё раз.', {}, 'timeout')
      }
      throw new AuthClientError(0, statusMessages[0], {}, 'network')
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  private invalidResponse(status = 200): AuthClientError {
    return new AuthClientError(status, invalidResponseMessage, {}, 'invalid-response')
  }

  private async requestTokens(path: string, options: RequestOptions): Promise<AuthTokens> {
    const payload = await this.request(path, options)
    if (!isAuthTokensResponse(payload)) throw this.invalidResponse()
    return mapTokens(payload)
  }

  async register(payload: Parameters<AuthClient['register']>[0]): ReturnType<AuthClient['register']> {
    const response = await this.request('/v1/auth/register', { method: 'POST', body: payload })
    if (!isAuthRegisterResponse(response)) throw this.invalidResponse()
    return response
  }

  activate(code: string): Promise<AuthTokens> {
    return this.requestTokens('/v1/auth/register/activate', {
      method: 'POST',
      body: { code },
    })
  }

  login(payload: Parameters<AuthClient['login']>[0]): Promise<AuthTokens> {
    return this.requestTokens('/v1/auth/login', { method: 'POST', body: payload })
  }

  refresh(refreshToken: string, timeoutMs?: number): Promise<AuthTokens> {
    return this.requestTokens('/v1/auth/token/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      timeoutMs,
    })
  }

  async logout(accessToken: string, refreshToken: string): Promise<void> {
    await this.request('/v1/auth/logout', {
      method: 'POST',
      accessToken,
      body: { refresh_token: refreshToken },
      timeoutMs: LOGOUT_TIMEOUT_MS,
      keepalive: true,
    })
  }

  async enrollTotp(accessToken: string): Promise<TotpEnrollResponse> {
    const response = await this.request('/v1/auth/totp/enroll', { method: 'POST', accessToken })
    if (!isTotpEnrollResponse(response)) throw this.invalidResponse()
    return response
  }

  async confirmTotp(accessToken: string, totpToken: string): Promise<void> {
    await this.request('/v1/auth/totp/confirm', {
      method: 'POST',
      accessToken,
      body: { totp_token: totpToken },
    })
  }

  async disableTotp(accessToken: string, password: string): Promise<void> {
    await this.request('/v1/auth/totp', {
      method: 'DELETE',
      accessToken,
      body: { password },
    })
  }
}
