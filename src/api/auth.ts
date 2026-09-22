import type {
  AuthLoginRequest,
  AuthRegisterRequest,
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

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
const API_BASE_URL = configuredBaseUrl.replace(/\/$/, '')
const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS)
const DEFAULT_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0
  ? configuredTimeout
  : 20_000
const LOGOUT_TIMEOUT_MS = 3_000

export type ApiErrorReason = 'http' | 'network' | 'timeout' | 'invalid-response'

const invalidResponseMessage = 'Сервер вернул несовместимый ответ. Попробуйте ещё раз позже.'

const statusMessages: Record<number, string> = {
  0: 'Не удалось связаться с сервером. Проверьте подключение к интернету.',
  401: 'Сервер не смог подтвердить учётные данные.',
  403: 'Для этого действия недостаточно прав.',
  404: 'Запрошенные данные не найдены.',
  409: 'Такие данные уже используются.',
  422: 'Проверьте правильность заполнения полей.',
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>
  readonly reason: ApiErrorReason

  constructor(
    status: number,
    message: string,
    fieldErrors: Record<string, string> = {},
    reason: ApiErrorReason = 'http',
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.reason = reason
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseFieldErrors(payload: unknown): Record<string, string> {
  if (!isRecord(payload) || !Array.isArray(payload.detail)) return {}

  return payload.detail.reduce<Record<string, string>>((errors, value) => {
    if (!isRecord(value)) return errors
    const issue = value as ValidationIssue
    if (!Array.isArray(issue.loc) || typeof issue.msg !== 'string') return errors
    const field = [...issue.loc].reverse().find((part): part is string => typeof part === 'string' && part !== 'body')
    if (field && !errors[field]) errors[field] = issue.msg
    return errors
  }, {})
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text) as unknown
  } catch {
    if (response.ok) {
      throw new ApiError(response.status, invalidResponseMessage, {}, 'invalid-response')
    }
    return undefined
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  accessToken?: string
  timeoutMs?: number
  keepalive?: boolean
}

async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  const headers = new Headers({ Accept: 'application/json' })
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`)
  const controller = new AbortController()
  let didTimeout = false
  const timeoutId = window.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      keepalive: options.keepalive,
    })
    const payload = await parseResponse(response)
    if (!response.ok) {
      const fallback = response.status >= 500
        ? 'Сервис временно недоступен. Попробуйте ещё раз позже.'
        : 'Не удалось выполнить запрос.'
      throw new ApiError(
        response.status,
        statusMessages[response.status] ?? fallback,
        parseFieldErrors(payload),
      )
    }

    return payload
  } catch (error) {
    if (isApiError(error)) throw error
    if (didTimeout) {
      throw new ApiError(0, 'Сервер не ответил вовремя. Попробуйте ещё раз.', {}, 'timeout')
    }
    throw new ApiError(0, statusMessages[0], {}, 'network')
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function invalidResponse(status = 200) {
  return new ApiError(status, invalidResponseMessage, {}, 'invalid-response')
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
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

async function requestTokens(path: string, options: RequestOptions): Promise<AuthTokens> {
  const payload = await request(path, options)
  if (!isAuthTokensResponse(payload)) throw invalidResponse()
  return mapTokens(payload)
}

function mapTokens(response: AuthTokensResponse): AuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
  }
}

export const authApi = {
  async register(payload: AuthRegisterRequest) {
    const response = await request('/v1/auth/register', { method: 'POST', body: payload })
    if (!isAuthRegisterResponse(response)) throw invalidResponse()
    return response
  },

  activate(code: string) {
    return requestTokens('/v1/auth/register/activate', {
      method: 'POST',
      body: { code },
    })
  },

  login(payload: AuthLoginRequest) {
    return requestTokens('/v1/auth/login', { method: 'POST', body: payload })
  },

  refresh(refreshToken: string, timeoutMs?: number) {
    return requestTokens('/v1/auth/token/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      timeoutMs,
    })
  },

  async logout(accessToken: string, refreshToken: string) {
    await request('/v1/auth/logout', {
      method: 'POST',
      accessToken,
      body: { refresh_token: refreshToken },
      timeoutMs: LOGOUT_TIMEOUT_MS,
      keepalive: true,
    })
  },

  async enrollTotp(accessToken: string) {
    const response = await request('/v1/auth/totp/enroll', { method: 'POST', accessToken })
    if (!isTotpEnrollResponse(response)) throw invalidResponse()
    return response
  },

  async confirmTotp(accessToken: string, totpToken: string) {
    await request('/v1/auth/totp/confirm', {
      method: 'POST',
      accessToken,
      body: { totp_token: totpToken },
    })
  },

  async disableTotp(accessToken: string, password: string) {
    await request('/v1/auth/totp', {
      method: 'DELETE',
      accessToken,
      body: { password },
    })
  },
}
