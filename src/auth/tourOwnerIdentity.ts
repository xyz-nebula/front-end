import type { ServiceSource } from '@/services/config'

const OWNER_SALT_STORAGE_KEY = 'arena.product-tour.owner-salt.v1'
const PENDING_OWNER_SESSION_KEY = 'arena.product-tour.pending-owner.v1'

let memorySalt: string | null = null
let memoryPendingOwnerKey: string | null = null

function randomHex(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

function getOwnerSalt(): string {
  try {
    const stored = window.localStorage.getItem(OWNER_SALT_STORAGE_KEY)
    if (stored) return stored
    const created = randomHex()
    window.localStorage.setItem(OWNER_SALT_STORAGE_KEY, created)
    return created
  } catch {
    memorySalt ??= randomHex()
    return memorySalt
  }
}

export function normalizeTourOwnerEmail(email: string): string {
  return email.trim().toLocaleLowerCase('ru-RU')
}

export async function createTourOwnerKey(source: ServiceSource, email: string): Promise<string> {
  const identity = `${source}:${normalizeTourOwnerEmail(email)}:${getOwnerSalt()}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

export function storePendingTourOwnerKey(ownerKey: string): void {
  memoryPendingOwnerKey = ownerKey
  try {
    window.sessionStorage.setItem(PENDING_OWNER_SESSION_KEY, ownerKey)
  } catch {
    // The in-memory copy keeps activation working in the current tab.
  }
}

export function consumePendingTourOwnerKey(): string | undefined {
  let stored: string | null = null
  try {
    stored = window.sessionStorage.getItem(PENDING_OWNER_SESSION_KEY)
    window.sessionStorage.removeItem(PENDING_OWNER_SESSION_KEY)
  } catch {
    // Fall back to the in-memory copy below.
  }
  const ownerKey = stored || memoryPendingOwnerKey || undefined
  memoryPendingOwnerKey = null
  return ownerKey
}

export function clearPendingTourOwnerKey(): void {
  memoryPendingOwnerKey = null
  try {
    window.sessionStorage.removeItem(PENDING_OWNER_SESSION_KEY)
  } catch {
    // There is no persistent pending identity to clear.
  }
}
