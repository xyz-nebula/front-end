import type {
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthTokens,
  TotpEnrollResponse,
} from '@/types/auth'

import type { ApiErrorReason } from '@/types/api'

export class AuthClientError extends Error {
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
    this.name = 'AuthClientError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.reason = reason
  }
}

export function isAuthClientError(error: unknown): error is AuthClientError {
  return error instanceof AuthClientError
}

export interface AuthClient {
  register(payload: AuthRegisterRequest): Promise<AuthRegisterResponse>
  activate(code: string): Promise<AuthTokens>
  login(payload: AuthLoginRequest): Promise<AuthTokens>
  refresh(refreshToken: string, timeoutMs?: number): Promise<AuthTokens>
  logout(accessToken: string, refreshToken: string): Promise<void>
  enrollTotp(accessToken: string): Promise<TotpEnrollResponse>
  confirmTotp(accessToken: string, totpToken: string): Promise<void>
  disableTotp(accessToken: string, password: string): Promise<void>
}
