import type { AuthTokens } from '@/types/auth'

export const AUTH_STORAGE_KEY = 'arena.auth.tokens.v1'

export interface StoredSessionResult {
  tokens: AuthTokens | null
  storageAvailable: boolean
}

export type ConditionalTokenRemovalResult = 'removed' | 'changed' | 'missing' | 'unavailable'

function isAuthTokens(value: unknown): value is AuthTokens {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.accessToken === 'string'
    && candidate.accessToken.length > 0
    && typeof candidate.refreshToken === 'string'
    && candidate.refreshToken.length > 0
}

export function parseStoredTokens(serialized: string | null): AuthTokens | null {
  if (!serialized) return null
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (isAuthTokens(parsed)) return parsed
  } catch {
    // Invalid external data is ignored and never promoted to an in-memory session.
  }

  return null
}

export function readStoredSession(): StoredSessionResult {
  let serialized: string | null
  try {
    serialized = window.localStorage.getItem(AUTH_STORAGE_KEY)
  } catch {
    return { tokens: null, storageAvailable: false }
  }

  if (!serialized) return { tokens: null, storageAvailable: true }
  const tokens = parseStoredTokens(serialized)
  if (tokens) return { tokens, storageAvailable: true }

  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return { tokens: null, storageAvailable: true }
  } catch {
    return { tokens: null, storageAvailable: false }
  }
}

export function writeStoredTokens(tokens: AuthTokens): boolean {
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens))
    return true
  } catch {
    return false
  }
}

export function removeStoredTokens(): boolean {
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function removeStoredTokensIfRefreshTokenMatches(
  expectedRefreshToken: string,
): ConditionalTokenRemovalResult {
  try {
    const serialized = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!serialized) return 'missing'

    const tokens = parseStoredTokens(serialized)
    if (!tokens || tokens.refreshToken !== expectedRefreshToken) return 'changed'

    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return 'removed'
  } catch {
    return 'unavailable'
  }
}
