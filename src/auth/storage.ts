import type { AuthTokens } from '@/types/auth'

export const AUTH_STORAGE_KEY = 'arena.auth.tokens.v1'

function isAuthTokens(value: unknown): value is AuthTokens {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.accessToken === 'string'
    && candidate.accessToken.length > 0
    && typeof candidate.refreshToken === 'string'
    && candidate.refreshToken.length > 0
}

export function readStoredTokens(): AuthTokens | null {
  try {
    const serialized = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!serialized) return null
    const parsed: unknown = JSON.parse(serialized)
    if (isAuthTokens(parsed)) return parsed
  } catch {
    // A damaged or inaccessible storage entry is treated as a signed-out session.
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  return null
}

export function writeStoredTokens(tokens: AuthTokens) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens))
}

export function removeStoredTokens() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}
