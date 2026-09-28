import type { ServiceSource } from '@/services/config'
import type { AuthTokens } from '@/types/auth'

export const AUTH_STORAGE_KEY = 'arena.auth.tokens.v1'

export interface StoredAuthSession {
  tokens: AuthTokens
  source: ServiceSource
  mockOwnerKey: string
  tourOwnerKey?: string
}

export interface StoredSessionResult {
  session: StoredAuthSession | null
  storageAvailable: boolean
}

export type ConditionalTokenRemovalResult = 'removed' | 'changed' | 'missing' | 'unavailable'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAuthTokens(value: unknown): value is AuthTokens {
  if (!isRecord(value)) return false
  return typeof value.accessToken === 'string'
    && value.accessToken.length > 0
    && typeof value.refreshToken === 'string'
    && value.refreshToken.length > 0
}

function isServiceSource(value: unknown): value is ServiceSource {
  return value === 'mock' || value === 'real'
}

function createMockOwnerKey(): string {
  return crypto.randomUUID()
}

function parseStoredValue(serialized: string | null): StoredAuthSession | null {
  if (!serialized) return null
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (isRecord(parsed) && isAuthTokens(parsed.tokens) && isServiceSource(parsed.source)) {
      if (typeof parsed.mockOwnerKey !== 'string' || parsed.mockOwnerKey.length === 0) return null
      return {
        tokens: parsed.tokens,
        source: parsed.source,
        mockOwnerKey: parsed.mockOwnerKey,
        ...(typeof parsed.tourOwnerKey === 'string' && parsed.tourOwnerKey.length > 0
          ? { tourOwnerKey: parsed.tourOwnerKey }
          : {}),
      }
    }

    // Versions before composition-root support stored only tokens and always used real auth.
    if (isAuthTokens(parsed)) {
      return {
        tokens: parsed,
        source: 'real',
        mockOwnerKey: createMockOwnerKey(),
      }
    }
  } catch {
    // Invalid external data is ignored and never promoted to an in-memory session.
  }

  return null
}

export function parseStoredSession(
  serialized: string | null,
  expectedSource: ServiceSource,
): StoredAuthSession | null {
  const session = parseStoredValue(serialized)
  return session?.source === expectedSource ? session : null
}

export function readStoredSession(source: ServiceSource): StoredSessionResult {
  let serialized: string | null
  try {
    serialized = window.localStorage.getItem(AUTH_STORAGE_KEY)
  } catch {
    return { session: null, storageAvailable: false }
  }

  if (!serialized) return { session: null, storageAvailable: true }
  const parsedSession = parseStoredValue(serialized)
  if (!parsedSession) {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      return { session: null, storageAvailable: true }
    } catch {
      return { session: null, storageAvailable: false }
    }
  }

  if (parsedSession.source !== source) {
    return { session: null, storageAvailable: true }
  }

  // Persist the source-aware envelope when reading the legacy token-only shape.
  const rawValue: unknown = JSON.parse(serialized)
  if (isAuthTokens(rawValue)) {
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsedSession))
    } catch {
      return { session: parsedSession, storageAvailable: false }
    }
  }

  return { session: parsedSession, storageAvailable: true }
}

export function writeStoredSession(session: StoredAuthSession): boolean {
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    return true
  } catch {
    return false
  }
}

export function removeStoredSession(): boolean {
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function removeStoredSessionIfRefreshTokenMatches(
  expectedRefreshToken: string,
  expectedSource: ServiceSource,
): ConditionalTokenRemovalResult {
  try {
    const serialized = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!serialized) return 'missing'

    const session = parseStoredSession(serialized, expectedSource)
    if (!session || session.tokens.refreshToken !== expectedRefreshToken) return 'changed'

    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return 'removed'
  } catch {
    return 'unavailable'
  }
}

export function createStoredSession(
  tokens: AuthTokens,
  source: ServiceSource,
  tourOwnerKey?: string,
): StoredAuthSession {
  return {
    tokens,
    source,
    mockOwnerKey: createMockOwnerKey(),
    ...(tourOwnerKey ? { tourOwnerKey } : {}),
  }
}
