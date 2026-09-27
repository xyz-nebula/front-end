export const PRODUCT_TOUR_VERSION = 'product-tour-v1' as const

export type ProductTourStatus = 'active' | 'paused' | 'never' | 'completed'
export type ProductTourStepId =
  | 'case'
  | 'role'
  | 'voice-format'
  | 'analysis'
  | 'strategy'
  | 'tactics'
  | 'start-duel'
  | 'microphone'
  | 'dialogue'
  | 'finish'
  | 'confirm-finish'
  | 'result'

export interface ProductTourState {
  schemaVersion: 1
  tourVersion: typeof PRODUCT_TOUR_VERSION
  status: ProductTourStatus
  stepId: ProductTourStepId
  caseId?: string
  roleIndex?: 0 | 1
  sessionId?: string
  dialogueBaseline?: {
    userMessages: number
    aiMessages: number
  }
  updatedAt: string
}

export interface ProductTourStorageResult {
  state: ProductTourState | null
  storageAvailable: boolean
}

const STATE_KEY_PREFIX = 'arena.product-tour.v1.'
const PROMPT_KEY_PREFIX = 'arena.product-tour.prompt-session.v1.'
const memoryStates = new Map<string, ProductTourState>()
const memoryPromptDeferrals = new Set<string>()

const statuses: readonly ProductTourStatus[] = ['active', 'paused', 'never', 'completed']
const steps: readonly ProductTourStepId[] = [
  'case', 'role', 'voice-format', 'analysis', 'strategy', 'tactics', 'start-duel',
  'microphone', 'dialogue', 'finish', 'confirm-finish', 'result',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasOptionalString(value: Record<string, unknown>, key: string): boolean {
  return value[key] === undefined || (typeof value[key] === 'string' && value[key].length > 0)
}

function stateKey(ownerKey: string): string {
  return `${STATE_KEY_PREFIX}${encodeURIComponent(ownerKey)}`
}

function promptKey(ownerKey: string): string {
  return `${PROMPT_KEY_PREFIX}${encodeURIComponent(ownerKey)}`
}

export function parseProductTourState(value: unknown): ProductTourState | null {
  if (!isRecord(value)) return null
  if (value.schemaVersion !== 1 || value.tourVersion !== PRODUCT_TOUR_VERSION) return null
  if (!statuses.includes(value.status as ProductTourStatus)) return null
  if (!steps.includes(value.stepId as ProductTourStepId)) return null
  if (!hasOptionalString(value, 'caseId') || !hasOptionalString(value, 'sessionId')) return null
  if (value.roleIndex !== undefined && value.roleIndex !== 0 && value.roleIndex !== 1) return null
  if (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) return null

  let dialogueBaseline: ProductTourState['dialogueBaseline']
  if (value.dialogueBaseline !== undefined) {
    if (!isRecord(value.dialogueBaseline)) return null
    const { userMessages, aiMessages } = value.dialogueBaseline
    if (!Number.isInteger(userMessages) || !Number.isInteger(aiMessages)) return null
    if ((userMessages as number) < 0 || (aiMessages as number) < 0) return null
    dialogueBaseline = { userMessages: userMessages as number, aiMessages: aiMessages as number }
  }

  return {
    schemaVersion: 1,
    tourVersion: PRODUCT_TOUR_VERSION,
    status: value.status as ProductTourStatus,
    stepId: value.stepId as ProductTourStepId,
    updatedAt: value.updatedAt,
    ...(typeof value.caseId === 'string' ? { caseId: value.caseId } : {}),
    ...(value.roleIndex === 0 || value.roleIndex === 1 ? { roleIndex: value.roleIndex } : {}),
    ...(typeof value.sessionId === 'string' ? { sessionId: value.sessionId } : {}),
    ...(dialogueBaseline ? { dialogueBaseline } : {}),
  }
}

export function readProductTourState(ownerKey: string): ProductTourStorageResult {
  const key = stateKey(ownerKey)
  let serialized: string | null
  try {
    serialized = window.localStorage.getItem(key)
  } catch {
    return { state: memoryStates.get(key) ?? null, storageAvailable: false }
  }
  if (!serialized) return { state: memoryStates.get(key) ?? null, storageAvailable: true }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized) as unknown
  } catch {
    parsed = null
  }
  const state = parseProductTourState(parsed)
  if (state) return { state, storageAvailable: true }
  try {
    window.localStorage.removeItem(key)
  } catch {
    return { state: null, storageAvailable: false }
  }
  memoryStates.delete(key)
  return { state: null, storageAvailable: true }
}

export function writeProductTourState(ownerKey: string, state: ProductTourState): boolean {
  const key = stateKey(ownerKey)
  memoryStates.set(key, state)
  try {
    window.localStorage.setItem(key, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function removeProductTourState(ownerKey: string): boolean {
  const key = stateKey(ownerKey)
  memoryStates.delete(key)
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function isProductTourPromptDeferred(ownerKey: string): boolean {
  const key = promptKey(ownerKey)
  if (memoryPromptDeferrals.has(key)) return true
  try {
    return window.sessionStorage.getItem(key) === 'deferred'
  } catch {
    return false
  }
}

export function deferProductTourPrompt(ownerKey: string): boolean {
  const key = promptKey(ownerKey)
  memoryPromptDeferrals.add(key)
  try {
    window.sessionStorage.setItem(key, 'deferred')
    return true
  } catch {
    return false
  }
}

export function clearProductTourPromptDeferral(ownerKey: string): boolean {
  const key = promptKey(ownerKey)
  memoryPromptDeferrals.delete(key)
  try {
    window.sessionStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function getProductTourStorageKey(ownerKey: string): string {
  return stateKey(ownerKey)
}

export function subscribeToProductTourStorage(
  ownerKey: string,
  listener: (state: ProductTourState | null) => void,
): () => void {
  const key = stateKey(ownerKey)
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== key) return
    if (event.newValue === null) {
      listener(null)
      return
    }
    try {
      listener(parseProductTourState(JSON.parse(event.newValue) as unknown))
    } catch {
      listener(null)
    }
  }
  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
}
