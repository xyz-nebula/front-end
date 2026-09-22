import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  AUTH_STORAGE_KEY,
  createStoredSession,
  parseStoredSession,
  readStoredSession,
  removeStoredSession,
  removeStoredSessionIfRefreshTokenMatches,
  writeStoredSession,
  type StoredAuthSession,
} from '@/auth/storage'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import { AuthRuntimeContext, type AuthRuntimeContextValue } from '@/auth/runtime'
import { AuthClientError, isAuthClientError } from '@/services/contracts/authClient'
import { useServiceAdapters } from '@/services/serviceAdapters'
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
  return isAuthClientError(error)
    && error.reason === 'http'
    && (error.status === 401 || error.status === 403)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { authClient, config } = useServiceAdapters()
  const [initialSession] = useState(() => readStoredSession(config.authSource))
  const [status, setStatus] = useState<AuthStatus>(initialSession.session ? 'booting' : 'unauthenticated')
  const [logoutRequested, setLogoutRequested] = useState(false)
  const [persistence, setPersistence] = useState<SessionPersistence>(
    initialSession.storageAvailable ? 'persistent' : 'memory',
  )
  const [showMemorySessionNotice, setShowMemorySessionNotice] = useState(false)
  const [externalSessionVersion, setExternalSessionVersion] = useState(0)
  const tokensRef = useRef<AuthTokens | null>(initialSession.session?.tokens ?? null)
  const mockOwnerKeyRef = useRef<string | null>(initialSession.session?.mockOwnerKey ?? null)
  const [mockOwnerKey, setMockOwnerKey] = useState<string | null>(
    initialSession.session?.mockOwnerKey ?? null,
  )
  const persistenceRef = useRef<SessionPersistence>(
    initialSession.storageAvailable ? 'persistent' : 'memory',
  )
  const sessionVersionRef = useRef(0)
  const sessionGenerationRef = useRef(0)
  const sessionCreationGenerationRef = useRef(0)
  const refreshOperationRef = useRef<RefreshOperation | null>(null)
  const didBootstrapRef = useRef(false)
  const memoryNoticeShownRef = useRef(false)

  const saveSession = useCallback((session: StoredAuthSession, replacesSession = true) => {
    const wasPersisted = writeStoredSession(session)
    if (!wasPersisted) removeStoredSession()
    if (replacesSession) sessionGenerationRef.current += 1
    sessionVersionRef.current += 1
    tokensRef.current = session.tokens
    mockOwnerKeyRef.current = session.mockOwnerKey
    setMockOwnerKey(session.mockOwnerKey)
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

  const adoptExternalSession = useCallback((session: StoredAuthSession) => {
    sessionCreationGenerationRef.current += 1
    sessionGenerationRef.current += 1
    sessionVersionRef.current += 1
    tokensRef.current = session.tokens
    mockOwnerKeyRef.current = session.mockOwnerKey
    setMockOwnerKey(session.mockOwnerKey)
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
    mockOwnerKeyRef.current = null
    setMockOwnerKey(null)
    if (options.removeStored !== false && !removeStoredSession()) {
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

    saveSession(createStoredSession(tokens, config.authSource))
  }, [config.authSource, saveSession])

  const refreshSession = useCallback((): Promise<AuthTokens> => {
    const version = sessionVersionRef.current
    const activeRefresh = refreshOperationRef.current
    if (activeRefresh?.version === version) return activeRefresh.promise

    const refreshToken = tokensRef.current?.refreshToken
    if (!refreshToken) return Promise.reject(new AuthClientError(401, 'Сессия не найдена.'))

    const performRefresh = () => authClient.refresh(refreshToken)
      .then((tokens): AuthTokens => {
        if (sessionVersionRef.current !== version || tokensRef.current?.refreshToken !== refreshToken) {
          const currentTokens = tokensRef.current
          if (currentTokens) return currentTokens
          throw new AuthClientError(401, 'Сессия уже завершена.')
        }
        const ownerKey = mockOwnerKeyRef.current
        if (!ownerKey) throw new AuthClientError(401, 'Сессия уже завершена.')
        saveSession({ tokens, source: config.authSource, mockOwnerKey: ownerKey }, false)
        return tokens
      })
      .catch((error: unknown): AuthTokens => {
        if (sessionVersionRef.current !== version) {
          const currentTokens = tokensRef.current
          if (currentTokens) return currentTokens
          throw error
        }
        if (isDefinitiveAuthError(error)) {
          const removalResult = removeStoredSessionIfRefreshTokenMatches(
            refreshToken,
            config.authSource,
          )
          if (removalResult === 'changed') {
            const externalSession = readStoredSession(config.authSource)
            if (externalSession.session) {
              adoptExternalSession(externalSession.session)
              return externalSession.session.tokens
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
          throw new AuthClientError(401, 'Сессия уже завершена.')
        }

        const storedSession = readStoredSession(config.authSource)
        if (!storedSession.storageAvailable) {
          persistenceRef.current = 'memory'
          setPersistence('memory')
          return performRefresh()
        }

        if (!storedSession.session) {
          clearSession({ removeStored: false })
          throw new AuthClientError(401, 'Сессия уже завершена.')
        }

        if (storedSession.session.tokens.refreshToken !== refreshToken) {
          adoptExternalSession(storedSession.session)
          return storedSession.session.tokens
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
  }, [adoptExternalSession, authClient, clearSession, config.authSource, saveSession])

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
      throw new AuthClientError(401, 'Войдите, чтобы продолжить.')
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
      if (!isAuthClientError(error) || error.status !== 401) throw error
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
      if (
        isAuthClientError(error)
        && error.status === 401
        && sessionVersionRef.current === retryVersion
      ) {
        clearSession()
      }
      throw error
    }
  }, [clearSession, refreshSession])

  const revokeRemoteSession = useCallback(async (tokens: AuthTokens) => {
    try {
      await authClient.logout(tokens.accessToken, tokens.refreshToken)
    } catch (error) {
      if (!isAuthClientError(error) || error.status !== 401) return
      try {
        const refreshedTokens = await authClient.refresh(tokens.refreshToken, 3_000)
        await authClient.logout(refreshedTokens.accessToken, refreshedTokens.refreshToken)
      } catch {
        // Remote revocation is best-effort after the local session has already ended.
      }
    }
  }, [authClient])

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

      const externalSession = parseStoredSession(event.newValue, config.authSource)
      if (externalSession) adoptExternalSession(externalSession)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [adoptExternalSession, clearSession, config.authSource])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    logoutRequested,
    persistence,
    externalSessionVersion,
    showMemorySessionNotice,
    dismissMemorySessionNotice: () => setShowMemorySessionNotice(false),
    retrySession: restoreSession,
    register: (payload) => authClient.register(payload),
    activate: (code) => createSession(() => authClient.activate(code)),
    login: (payload) => createSession(() => authClient.login(payload)),
    logout: () => {
      const tokens = tokensRef.current
      setStatus('signing-out')
      clearSession({ requestedByLogout: true })
      if (tokens) void revokeRemoteSession(tokens)
      return Promise.resolve()
    },
    enrollTotp: () => runAuthorized((accessToken) => authClient.enrollTotp(accessToken)),
    confirmTotp: (totpToken) => runAuthorized(
      (accessToken) => authClient.confirmTotp(accessToken, totpToken),
    ),
    disableTotp: (password) => runAuthorized(
      (accessToken) => authClient.disableTotp(accessToken, password),
    ),
  }), [
    authClient,
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

  const runtimeValue = useMemo<AuthRuntimeContextValue>(() => ({
    mockOwnerKey,
    runAuthorized,
  }), [mockOwnerKey, runAuthorized])

  return (
    <AuthRuntimeContext.Provider value={runtimeValue}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </AuthRuntimeContext.Provider>
  )
}
