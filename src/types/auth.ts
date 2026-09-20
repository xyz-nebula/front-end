export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthRegisterRequest {
  email: string
  username: string
  first_name: string
  last_name: string
  password: string
}

export interface AuthRegisterResponse {
  user_id: string
  status: 'pending_activation' | 'active' | 'suspended'
}

export interface AuthLoginRequest {
  email: string
  password: string
  totp_token?: string
}

export interface TotpEnrollResponse {
  secret: string
  otpauth_url: string
}

export type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated' | 'signing-out' | 'restore-error'

export type SessionPersistence = 'persistent' | 'memory'
