import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { ApiError, authApi, isApiError } from '@/api/auth'
import {
  AUTH_STORAGE_KEY,
  parseStoredTokens,
  readStoredSession,
  removeStoredTokens,
  writeStoredTokens,
} from '@/auth/storage'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import type { AuthStatus, AuthTokens, SessionPersistence } from '@/types/auth'

interface RefreshOperation {
  version: number
  promise: Promise<AuthTokens>
}

interface ClearSessionOptions {
  removeStored?: boolean
  requestedByLogout?: boolean
}

function isDefinitiveAuthError(error: unknown) {
  return isApiError(error)
    && error.reason === 'http'
    && (error.status === 401 || error.status === 403)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialSession] = useState(() => readStoredSession())
  const [status, setStatus] = useState<AuthStatus>(initialSession.tokens ? 'booting' : 'unauthenticated')
  const [logoutRequested, setLogoutRequested] = useState(false)
  const [persistence, setPersistence] = useState<SessionPersistence>(
    initialSession.storageAvailable ? 'persistent' : 'memory',
  )
  const [showMemorySessionNotice, setShowMemorySessionNotice] = useState(false)
  const tokensRef = useRef<AuthTokens | null>(initialSession.tokens)
  const sessionVersionRef = useRef(0)
  const refreshOperationRef = useRef<RefreshOperation | null>(null)
  const didBootstrapRef = useRef(false)
  const memoryNoticeShownRef = useRef(false)

  const saveSession = useCallback((tokens: AuthTokens) => {
    const wasPersisted = writeStoredTokens(tokens)
    if (!wasPersisted) removeStoredTokens()
    sessionVersionRef.current += 1
    tokensRef.current = tokens
    setPersistence(wasPersisted ? 'persistent' : 'memory')
    if (wasPersisted) {
      memoryNoticeShownRef.current = false
      setShowMemorySessionNotice(false)
    } else if (!memoryNoticeShownRef.current) {
      memoryNoticeShownRef.current = true
      setShowMemorySessionNotice(true)
    }
    setLogoutRequested(false)
    setStatus('authenticated')
    return wasPersisted ? 'persistent' as const : 'memory' as const
  }, [])

  const adoptExternalSession = useCallback((tokens: AuthTokens) => {
    sessionVersionRef.current += 1
    tokensRef.current = tokens
    setPersistence('persistent')
    memoryNoticeShownRef.current = false
    setShowMemorySessionNotice(false)
    setLogoutRequested(false)
    setStatus('authenticated')
  }, [])

  const clearSession = useCallback((options: ClearSessionOptions = {}) => {
    sessionVersionRef.current += 1
    tokensRef.current = null
    if (options.removeStored !== false && !removeStoredTokens()) setPersistence('memory')
    memoryNoticeShownRef.current = false
    setShowMemorySessionNotice(false)
    setLogoutRequested(options.requestedByLogout ?? false)
    setStatus('unauthenticated')
  }, [])

  const refreshSession = useCallback((): Promise<AuthTokens> => {
    const version = sessionVersionRef.current
    const activeRefresh = refreshOperationRef.current
    if (activeRefresh?.version === version) return activeRefresh.promise

    const refreshToken = tokensRef.current?.refreshToken
    if (!refreshToken) return Promise.reject(new ApiError(401, 'Сессия не найдена.'))

    const promise = authApi.refresh(refreshToken)
      .then((tokens) => {
        if (sessionVersionRef.current !== version || tokensRef.current?.refreshToken !== refreshToken) {
          const currentTokens = tokensRef.current
          if (currentTokens) return currentTokens
          throw new ApiError(401, 'Сессия уже завершена.')
        }
        saveSession(tokens)
        return tokens
      })
      .catch((error: unknown) => {
        if (sessionVersionRef.current !== version) {
          const currentTokens = tokensRef.current
          if (currentTokens) return currentTokens
          throw error
        }
        if (isDefinitiveAuthError(error)) clearSession()
        throw error
      })
      .finally(() => {
        if (refreshOperationRef.current === operation) refreshOperationRef.current = null
      })

    const operation: RefreshOperation = { version, promise }
    refreshOperationRef.current = operation
    return promise
  }, [clearSession, saveSession])

  const restoreSession = useCallback(async () => {
    if (!tokensRef.current) {
      clearSession()
      return
    }

    const version = sessionVersionRef.current
    setStatus('booting')
    try {
      await refreshSession()
    } catch (error) {
      if (
        sessionVersionRef.current === version
        && tokensRef.current
        && !isDefinitiveAuthError(error)
      ) {
        setStatus('restore-error')
      }
    }
  }, [clearSession, refreshSession])

  const runAuthorized = useCallback(async <T,>(operation: (accessToken: string) => Promise<T>): Promise<T> => {
    const initialTokens = tokensRef.current
    const initialVersion = sessionVersionRef.current
    if (!initialTokens) {
      clearSession()
      throw new ApiError(401, 'Войдите, чтобы продолжить.')
    }

    try {
      return await operation(initialTokens.accessToken)
    } catch (error) {
      if (!isApiError(error) || error.status !== 401) throw error
    }

    let retryTokens: AuthTokens
    if (sessionVersionRef.current !== initialVersion && tokensRef.current) {
      retryTokens = tokensRef.current
    } else {
      retryTokens = await refreshSession()
    }

    const retryVersion = sessionVersionRef.current
    try {
      return await operation(retryTokens.accessToken)
    } catch (error) {
      if (isApiError(error) && error.status === 401 && sessionVersionRef.current === retryVersion) {
        clearSession()
      }
      throw error
    }
  }, [clearSession, refreshSession])

  const revokeRemoteSession = useCallback(async (tokens: AuthTokens) => {
    try {
      await authApi.logout(tokens.accessToken, tokens.refreshToken)
    } catch (error) {
      if (!isApiError(error) || error.status !== 401) return
      try {
        const refreshedTokens = await authApi.refresh(tokens.refreshToken, 3_000)
        await authApi.logout(refreshedTokens.accessToken, refreshedTokens.refreshToken)
      } catch {
        // Remote revocation is best-effort after the local session has already ended.
      }
    }
  }, [])

  useEffect(() => {
    if (didBootstrapRef.current) return
    didBootstrapRef.current = true
    if (!tokensRef.current) return
    void restoreSession()
  }, [restoreSession])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_STORAGE_KEY && event.key !== null) return
      if (event.newValue === null) {
        clearSession({ removeStored: false })
        return
      }

      const externalTokens = parseStoredTokens(event.newValue)
      if (externalTokens) adoptExternalSession(externalTokens)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [adoptExternalSession, clearSession])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    logoutRequested,
    persistence,
    showMemorySessionNotice,
    dismissMemorySessionNotice: () => setShowMemorySessionNotice(false),
    retrySession: restoreSession,
    register: authApi.register,
    activate: async (code) => {
      saveSession(await authApi.activate(code))
    },
    login: async (payload) => {
      saveSession(await authApi.login(payload))
    },
    logout: () => {
      const tokens = tokensRef.current
      setStatus('signing-out')
      clearSession({ requestedByLogout: true })
      if (tokens) void revokeRemoteSession(tokens)
      return Promise.resolve()
    },
    enrollTotp: () => runAuthorized(authApi.enrollTotp),
    confirmTotp: (totpToken) => runAuthorized((accessToken) => authApi.confirmTotp(accessToken, totpToken)),
    disableTotp: (password) => runAuthorized((accessToken) => authApi.disableTotp(accessToken, password)),
  }), [
    clearSession,
    logoutRequested,
    persistence,
    restoreSession,
    revokeRemoteSession,
    runAuthorized,
    saveSession,
    showMemorySessionNotice,
    status,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
