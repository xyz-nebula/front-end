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

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
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
      throw new ApiError(response.status, 'Сервер вернул ответ в неизвестном формате.')
    }
    return undefined
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  accessToken?: string
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' })
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, statusMessages[0])
  }

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

  return payload as T
}

function mapTokens(response: AuthTokensResponse): AuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
  }
}

export const authApi = {
  register(payload: AuthRegisterRequest) {
    return request<AuthRegisterResponse>('/v1/auth/register', { method: 'POST', body: payload })
  },

  async activate(code: string) {
    return mapTokens(await request<AuthTokensResponse>('/v1/auth/register/activate', {
      method: 'POST',
      body: { code },
    }))
  },

  async login(payload: AuthLoginRequest) {
    return mapTokens(await request<AuthTokensResponse>('/v1/auth/login', { method: 'POST', body: payload }))
  },

  async refresh(refreshToken: string) {
    return mapTokens(await request<AuthTokensResponse>('/v1/auth/token/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
    }))
  },

  logout(accessToken: string, refreshToken: string) {
    return request<void>('/v1/auth/logout', {
      method: 'POST',
      accessToken,
      body: { refresh_token: refreshToken },
    })
  },

  enrollTotp(accessToken: string) {
    return request<TotpEnrollResponse>('/v1/auth/totp/enroll', { method: 'POST', accessToken })
  },

  confirmTotp(accessToken: string, totpToken: string) {
    return request<void>('/v1/auth/totp/confirm', {
      method: 'POST',
      accessToken,
      body: { totp_token: totpToken },
    })
  },

  disableTotp(accessToken: string, password: string) {
    return request<void>('/v1/auth/totp', {
      method: 'DELETE',
      accessToken,
      body: { password },
    })
  },
}
