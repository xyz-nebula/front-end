import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { ApiError, authApi, isApiError } from '@/api/auth'
import { readStoredTokens, removeStoredTokens, writeStoredTokens } from '@/auth/storage'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import type { AuthStatus, AuthTokens } from '@/types/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialTokens] = useState<AuthTokens | null>(() => readStoredTokens())
  const [status, setStatus] = useState<AuthStatus>(initialTokens ? 'booting' : 'unauthenticated')
  const [logoutRequested, setLogoutRequested] = useState(false)
  const tokensRef = useRef<AuthTokens | null>(initialTokens)
  const refreshPromiseRef = useRef<Promise<AuthTokens> | null>(null)
  const didBootstrapRef = useRef(false)

  const saveSession = useCallback((tokens: AuthTokens) => {
    tokensRef.current = tokens
    writeStoredTokens(tokens)
    setStatus('authenticated')
  }, [])

  const clearSession = useCallback(() => {
    tokensRef.current = null
    removeStoredTokens()
    setStatus('unauthenticated')
  }, [])

  const refreshSession = useCallback(() => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current
    const refreshToken = tokensRef.current?.refreshToken
    if (!refreshToken) return Promise.reject(new ApiError(401, 'Сессия не найдена.'))

    const refreshPromise = authApi.refresh(refreshToken)
      .then((tokens) => {
        saveSession(tokens)
        return tokens
      })
      .catch((error: unknown) => {
        clearSession()
        throw error
      })
      .finally(() => {
        refreshPromiseRef.current = null
      })

    refreshPromiseRef.current = refreshPromise
    return refreshPromise
  }, [clearSession, saveSession])

  const runAuthorized = useCallback(async <T,>(operation: (accessToken: string) => Promise<T>): Promise<T> => {
    const currentTokens = tokensRef.current
    if (!currentTokens) {
      clearSession()
      throw new ApiError(401, 'Войдите, чтобы продолжить.')
    }

    try {
      return await operation(currentTokens.accessToken)
    } catch (error) {
      if (!isApiError(error) || error.status !== 401) throw error
    }

    const refreshedTokens = await refreshSession()
    try {
      return await operation(refreshedTokens.accessToken)
    } catch (error) {
      if (isApiError(error) && error.status === 401) clearSession()
      throw error
    }
  }, [clearSession, refreshSession])

  useEffect(() => {
    if (didBootstrapRef.current) return
    didBootstrapRef.current = true

    if (!tokensRef.current) return
    void refreshSession().catch(() => undefined)
  }, [refreshSession])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    logoutRequested,
    register: authApi.register,
    activate: async (code) => {
      setLogoutRequested(false)
      saveSession(await authApi.activate(code))
    },
    login: async (payload) => {
      setLogoutRequested(false)
      saveSession(await authApi.login(payload))
    },
    logout: async () => {
      setLogoutRequested(true)
      setStatus('signing-out')
      try {
        await runAuthorized((accessToken) => {
          const refreshToken = tokensRef.current?.refreshToken
          if (!refreshToken) throw new ApiError(401, 'Сессия не найдена.')
          return authApi.logout(accessToken, refreshToken)
        })
      } finally {
        clearSession()
      }
    },
    enrollTotp: () => runAuthorized(authApi.enrollTotp),
    confirmTotp: (totpToken) => runAuthorized((accessToken) => authApi.confirmTotp(accessToken, totpToken)),
    disableTotp: (password) => runAuthorized((accessToken) => authApi.disableTotp(accessToken, password)),
  }), [clearSession, logoutRequested, runAuthorized, saveSession, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
