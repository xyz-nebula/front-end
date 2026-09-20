import { createContext, useContext } from 'react'

import type {
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthStatus,
  TotpEnrollResponse,
} from '@/types/auth'

export interface AuthContextValue {
  status: AuthStatus
  logoutRequested: boolean
  register: (payload: AuthRegisterRequest) => Promise<AuthRegisterResponse>
  activate: (code: string) => Promise<void>
  login: (payload: AuthLoginRequest) => Promise<void>
  logout: () => Promise<void>
  enrollTotp: () => Promise<TotpEnrollResponse>
  confirmTotp: (totpToken: string) => Promise<void>
  disableTotp: (password: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
