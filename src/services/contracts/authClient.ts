import type {
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthTokens,
  TotpEnrollResponse,
} from '@/types/auth'

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
