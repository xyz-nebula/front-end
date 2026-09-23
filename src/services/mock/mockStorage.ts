import type { NegotiationMessage, NegotiationMode, NegotiationResult, NegotiationStatus } from '@/types/negotiation'
import { ServiceError } from '@/types/api'

export const MOCK_DATA_STORAGE_KEY = 'arena.mock.data.v1'
const MOCK_LEASE_STORAGE_KEY = `${MOCK_DATA_STORAGE_KEY}.lease`
const MOCK_LOCK_NAME = `${MOCK_DATA_STORAGE_KEY}.mutation`
const LEASE_TTL_MS = 6_000
const LEASE_REFRESH_MS = 2_000

export interface MockUserRecord {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  password: string
  status: 'pending_activation' | 'active' | 'suspended'
  activationCode: string
  refreshTokens: string[]
  totpSecret?: string
  totpEnabled: boolean
}

export interface MockSessionRecord {
  id: string
  ownerKey: string
  caseId: string
  mode: NegotiationMode
  status: NegotiationStatus
  startedAt: string
  finishedAt?: string
  messages: NegotiationMessage[]
  nextSequence: number
  createCommandId: string
  textTurns: Record<string, { userMessageId: string; aiMessageId: string }>
  finishCommands: Record<string, true>
  audioEvents: Record<string, string>
}

export interface MockResultRecord {
  sessionId: string
  status: 'processing' | 'ready' | 'failed'
  readyAt: number
  result?: NegotiationResult
  message?: string
}

export interface MockAudioTicketRecord {
  ticket: string
  ownerKey: string
  sessionId: string
  expiresAt: string
  used: boolean
}

export interface MockData {
  version: 1
  users: MockUserRecord[]
  sessions: MockSessionRecord[]
  results: MockResultRecord[]
  audioTickets: MockAudioTicketRecord[]
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function emptyData(): MockData {
  return { version: 1, users: [], sessions: [], results: [], audioTickets: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isMessage(value: unknown): value is NegotiationMessage {
  return isRecord(value)
    && isString(value.id)
    && Number.isSafeInteger(value.sequence)
    && (value.speaker === 'user' || value.speaker === 'ai')
    && isString(value.text)
    && isString(value.createdAt)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(isString)
}

function isTrueRecord(value: unknown): value is Record<string, true> {
  return isRecord(value) && Object.values(value).every((entry) => entry === true)
}

function isTextTurnRecord(value: unknown): value is MockSessionRecord['textTurns'] {
  return isRecord(value) && Object.values(value).every((entry) => (
    isRecord(entry) && isString(entry.userMessageId) && isString(entry.aiMessageId)
  ))
}

function isNegotiationResult(value: unknown): value is NegotiationResult {
  return isRecord(value)
    && isString(value.sessionId)
    && (value.outcome === 'victory' || value.outcome === 'defeat')
    && typeof value.score === 'number'
    && Number.isFinite(value.score)
    && isString(value.summary)
    && isStringArray(value.strengths)
    && isStringArray(value.improvements)
    && isStringArray(value.recommendations)
}

function isUser(value: unknown): value is MockUserRecord {
  return isRecord(value)
    && ['id', 'email', 'username', 'firstName', 'lastName', 'password', 'activationCode'].every(
      (key) => isString(value[key]),
    )
    && (value.status === 'pending_activation' || value.status === 'active' || value.status === 'suspended')
    && isStringArray(value.refreshTokens)
    && typeof value.totpEnabled === 'boolean'
    && (value.totpSecret === undefined || isString(value.totpSecret))
}

function isSession(value: unknown): value is MockSessionRecord {
  return isRecord(value)
    && ['id', 'ownerKey', 'caseId', 'startedAt', 'createCommandId'].every((key) => isString(value[key]))
    && (value.mode === 'text' || value.mode === 'voice')
    && (value.status === 'active' || value.status === 'finishing' || value.status === 'finished')
    && (value.finishedAt === undefined || isString(value.finishedAt))
    && Array.isArray(value.messages)
    && value.messages.every(isMessage)
    && typeof value.nextSequence === 'number'
    && Number.isSafeInteger(value.nextSequence)
    && value.nextSequence > 0
    && isTextTurnRecord(value.textTurns)
    && isTrueRecord(value.finishCommands)
    && isStringRecord(value.audioEvents)
}

function isResult(value: unknown): value is MockResultRecord {
  return isRecord(value)
    && isString(value.sessionId)
    && (value.status === 'processing' || value.status === 'ready' || value.status === 'failed')
    && typeof value.readyAt === 'number'
    && Number.isFinite(value.readyAt)
    && (value.result === undefined || isNegotiationResult(value.result))
    && (value.message === undefined || isString(value.message))
}

function isTicket(value: unknown): value is MockAudioTicketRecord {
  return isRecord(value)
    && ['ticket', 'ownerKey', 'sessionId', 'expiresAt'].every((key) => isString(value[key]))
    && typeof value.used === 'boolean'
}

function parseData(serialized: string | null): MockData | null {
  if (!serialized) return emptyData()
  try {
    const value: unknown = JSON.parse(serialized)
    if (!isRecord(value) || value.version !== 1) return null
    if (!Array.isArray(value.users) || !value.users.every(isUser)) return null
    if (!Array.isArray(value.sessions) || !value.sessions.every(isSession)) return null
    if (!Array.isArray(value.results) || !value.results.every(isResult)) return null
    if (!Array.isArray(value.audioTickets) || !value.audioTickets.every(isTicket)) return null
    return value as unknown as MockData
  } catch {
    return null
  }
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function copyData(data: MockData): MockData {
  return structuredClone(data)
}

export class MockStorage {
  private readonly storage: StorageLike | null
  private memoryData = emptyData()
  private mutationQueue: Promise<void> = Promise.resolve()
  private readonly tabId = crypto.randomUUID()
  private leaseTimer: number | undefined

  constructor(storage: StorageLike | null = getBrowserStorage()) {
    this.storage = storage
  }

  private load(): MockData {
    if (!this.storage) return copyData(this.memoryData)
    try {
      return parseData(this.storage.getItem(MOCK_DATA_STORAGE_KEY)) ?? emptyData()
    } catch {
      return copyData(this.memoryData)
    }
  }

  private save(data: MockData): void {
    this.memoryData = copyData(data)
    if (!this.storage) return
    try {
      this.storage.setItem(MOCK_DATA_STORAGE_KEY, JSON.stringify(data))
    } catch {
      // The in-memory copy keeps the demo usable when storage is unavailable.
    }
  }

  read<T>(reader: (data: Readonly<MockData>) => T): T {
    return reader(this.load())
  }

  private hasWebLocks(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function'
  }

  private claimFallbackLease(): void {
    if (!this.storage) return
    const now = Date.now()
    try {
      const serialized = this.storage.getItem(MOCK_LEASE_STORAGE_KEY)
      const lease: unknown = serialized ? JSON.parse(serialized) : null
      if (
        isRecord(lease)
        && isString(lease.tabId)
        && typeof lease.updatedAt === 'number'
        && lease.tabId !== this.tabId
        && now - lease.updatedAt < LEASE_TTL_MS
      ) {
        throw new ServiceError('Mock-арена уже открыта в другой вкладке. Закройте её и повторите попытку.', {
          reason: 'feature-unavailable',
          code: 'MOCK_ARENA_TAB_CONFLICT',
        })
      }
      this.storage.setItem(MOCK_LEASE_STORAGE_KEY, JSON.stringify({ tabId: this.tabId, updatedAt: now }))
      const confirmed: unknown = JSON.parse(this.storage.getItem(MOCK_LEASE_STORAGE_KEY) ?? 'null')
      if (!isRecord(confirmed) || confirmed.tabId !== this.tabId) {
        throw new ServiceError('Не удалось закрепить mock-арену за этой вкладкой.', {
          reason: 'feature-unavailable',
          code: 'MOCK_ARENA_TAB_CONFLICT',
        })
      }
      if (this.leaseTimer === undefined && typeof window !== 'undefined') {
        this.leaseTimer = window.setInterval(() => this.refreshFallbackLease(), LEASE_REFRESH_MS)
        window.addEventListener('pagehide', this.releaseFallbackLease, { once: true })
      }
    } catch (error) {
      if (error instanceof ServiceError) throw error
      // Storage failures use the in-memory fallback and cannot coordinate tabs.
    }
  }

  private refreshFallbackLease = (): void => {
    if (!this.storage) return
    try {
      const lease: unknown = JSON.parse(this.storage.getItem(MOCK_LEASE_STORAGE_KEY) ?? 'null')
      if (isRecord(lease) && lease.tabId === this.tabId) {
        this.storage.setItem(MOCK_LEASE_STORAGE_KEY, JSON.stringify({
          tabId: this.tabId,
          updatedAt: Date.now(),
        }))
      }
    } catch {
      // A failed heartbeat will be retried; domain data remains available in memory.
    }
  }

  private releaseFallbackLease = (): void => {
    if (this.leaseTimer !== undefined && typeof window !== 'undefined') {
      window.clearInterval(this.leaseTimer)
      this.leaseTimer = undefined
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.releaseFallbackLease)
    }
    if (!this.storage) return
    try {
      const lease: unknown = JSON.parse(this.storage.getItem(MOCK_LEASE_STORAGE_KEY) ?? 'null')
      if (isRecord(lease) && lease.tabId === this.tabId) this.storage.removeItem(MOCK_LEASE_STORAGE_KEY)
    } catch {
      // Best-effort release; stale leases expire automatically.
    }
  }

  private async runMutation<T>(mutation: (data: MockData) => T | Promise<T>): Promise<T> {
    const execute = async () => {
      const data = this.load()
      const result = await mutation(data)
      this.save(data)
      return result
    }

    if (this.hasWebLocks()) {
      return navigator.locks.request(MOCK_LOCK_NAME, execute)
    }
    this.claimFallbackLease()
    return execute()
  }

  mutate<T>(mutation: (data: MockData) => T | Promise<T>): Promise<T> {
    const operation = this.mutationQueue.then(() => this.runMutation(mutation))
    this.mutationQueue = operation.then(() => undefined, () => undefined)
    return operation
  }

  dispose(): void {
    this.releaseFallbackLease()
  }
}
