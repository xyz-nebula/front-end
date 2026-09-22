import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { ApiError, authApi, isApiError } from '@/api/auth'
import {
  AUTH_STORAGE_KEY,
  parseStoredTokens,
  readStoredSession,
  removeStoredTokens,
  removeStoredTokensIfRefreshTokenMatches,
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

const AUTH_REFRESH_LOCK_NAME = `${AUTH_STORAGE_KEY}.refresh`

class StaleSessionCreationError extends Error {
  constructor() {
    super('Операция входа больше не актуальна.')
    this.name = 'StaleSessionCreationError'
  }
}

class StaleAuthorizedOperationError extends Error {
  constructor() {
    super('Сессия изменилась во время выполнения операции.')
    this.name = 'StaleAuthorizedOperationError'
  }
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
  const [externalSessionVersion, setExternalSessionVersion] = useState(0)
  const tokensRef = useRef<AuthTokens | null>(initialSession.tokens)
  const persistenceRef = useRef<SessionPersistence>(
    initialSession.storageAvailable ? 'persistent' : 'memory',
  )
  const sessionVersionRef = useRef(0)
  const sessionGenerationRef = useRef(0)
  const sessionCreationGenerationRef = useRef(0)
  const refreshOperationRef = useRef<RefreshOperation | null>(null)
  const didBootstrapRef = useRef(false)
  const memoryNoticeShownRef = useRef(false)

  const saveSession = useCallback((tokens: AuthTokens, replacesSession = true) => {
    const wasPersisted = writeStoredTokens(tokens)
    if (!wasPersisted) removeStoredTokens()
    if (replacesSession) sessionGenerationRef.current += 1
    sessionVersionRef.current += 1
    tokensRef.current = tokens
    const nextPersistence = wasPersisted ? 'persistent' : 'memory'
    persistenceRef.current = nextPersistence
    setPersistence(nextPersistence)
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
    sessionCreationGenerationRef.current += 1
    sessionGenerationRef.current += 1
    sessionVersionRef.current += 1
    tokensRef.current = tokens
    persistenceRef.current = 'persistent'
    setPersistence('persistent')
    memoryNoticeShownRef.current = false
    setShowMemorySessionNotice(false)
    setLogoutRequested(false)
    setStatus('authenticated')
    setExternalSessionVersion((version) => version + 1)
  }, [])

  const clearSession = useCallback((options: ClearSessionOptions = {}) => {
    sessionCreationGenerationRef.current += 1
    sessionGenerationRef.current += 1
    sessionVersionRef.current += 1
    tokensRef.current = null
    if (options.removeStored !== false && !removeStoredTokens()) {
      persistenceRef.current = 'memory'
      setPersistence('memory')
    }
    memoryNoticeShownRef.current = false
    setShowMemorySessionNotice(false)
    setLogoutRequested(options.requestedByLogout ?? false)
    setStatus('unauthenticated')
  }, [])

  const createSession = useCallback(async (requestTokens: () => Promise<AuthTokens>) => {
    const generation = sessionCreationGenerationRef.current + 1
    sessionCreationGenerationRef.current = generation
    const tokens = await requestTokens()

    if (sessionCreationGenerationRef.current !== generation) {
      throw new StaleSessionCreationError()
    }

    saveSession(tokens)
  }, [saveSession])

  const refreshSession = useCallback((): Promise<AuthTokens> => {
    const version = sessionVersionRef.current
    const activeRefresh = refreshOperationRef.current
    if (activeRefresh?.version === version) return activeRefresh.promise

    const refreshToken = tokensRef.current?.refreshToken
    if (!refreshToken) return Promise.reject(new ApiError(401, 'Сессия не найдена.'))

    const performRefresh = () => authApi.refresh(refreshToken)
      .then((tokens): AuthTokens => {
        if (sessionVersionRef.current !== version || tokensRef.current?.refreshToken !== refreshToken) {
          const currentTokens = tokensRef.current
          if (currentTokens) return currentTokens
          throw new ApiError(401, 'Сессия уже завершена.')
        }
        saveSession(tokens, false)
        return tokens
      })
      .catch((error: unknown): AuthTokens => {
        if (sessionVersionRef.current !== version) {
          const currentTokens = tokensRef.current
          if (currentTokens) return currentTokens
          throw error
        }
        if (isDefinitiveAuthError(error)) {
          const removalResult = removeStoredTokensIfRefreshTokenMatches(refreshToken)
          if (removalResult === 'changed') {
            const externalSession = readStoredSession()
            if (externalSession.tokens) {
              adoptExternalSession(externalSession.tokens)
              return externalSession.tokens
            }
          }

          clearSession({ removeStored: false })
        }
        throw error
      })

    const runCoordinatedRefresh = async (): Promise<AuthTokens> => {
      if (persistenceRef.current !== 'persistent' || !('locks' in navigator)) {
        return performRefresh()
      }

      return navigator.locks.request(AUTH_REFRESH_LOCK_NAME, async () => {
        if (sessionVersionRef.current !== version || tokensRef.current?.refreshToken !== refreshToken) {
          const currentTokens = tokensRef.current
          if (currentTokens) return currentTokens
          throw new ApiError(401, 'Сессия уже завершена.')
        }

        const storedSession = readStoredSession()
        if (!storedSession.storageAvailable) {
          persistenceRef.current = 'memory'
          setPersistence('memory')
          return performRefresh()
        }

        if (!storedSession.tokens) {
          clearSession({ removeStored: false })
          throw new ApiError(401, 'Сессия уже завершена.')
        }

        if (storedSession.tokens.refreshToken !== refreshToken) {
          adoptExternalSession(storedSession.tokens)
          return storedSession.tokens
        }

        return performRefresh()
      })
    }

    const promise = runCoordinatedRefresh()
      .finally(() => {
        if (refreshOperationRef.current === operation) refreshOperationRef.current = null
      })

    const operation: RefreshOperation = { version, promise }
    refreshOperationRef.current = operation
    return promise
  }, [adoptExternalSession, clearSession, saveSession])

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
    const sessionGeneration = sessionGenerationRef.current
    if (!initialTokens) {
      clearSession()
      throw new ApiError(401, 'Войдите, чтобы продолжить.')
    }

    const assertSessionIsCurrent = () => {
      if (sessionGenerationRef.current !== sessionGeneration) {
        throw new StaleAuthorizedOperationError()
      }
    }

    try {
      assertSessionIsCurrent()
      const result = await operation(initialTokens.accessToken)
      assertSessionIsCurrent()
      return result
    } catch (error) {
      assertSessionIsCurrent()
      if (!isApiError(error) || error.status !== 401) throw error
    }

    assertSessionIsCurrent()
    const retryTokens = await refreshSession()
    assertSessionIsCurrent()

    const retryVersion = sessionVersionRef.current
    try {
      assertSessionIsCurrent()
      const result = await operation(retryTokens.accessToken)
      assertSessionIsCurrent()
      return result
    } catch (error) {
      assertSessionIsCurrent()
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
    externalSessionVersion,
    showMemorySessionNotice,
    dismissMemorySessionNotice: () => setShowMemorySessionNotice(false),
    retrySession: restoreSession,
    register: authApi.register,
    activate: (code) => createSession(() => authApi.activate(code)),
    login: (payload) => createSession(() => authApi.login(payload)),
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
    createSession,
    externalSessionVersion,
    logoutRequested,
    persistence,
    restoreSession,
    revokeRemoteSession,
    runAuthorized,
    showMemorySessionNotice,
    status,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
