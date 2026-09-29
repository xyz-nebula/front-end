import type { NegotiationMode } from '@/types/negotiation'
import type { PreparationDraft, SessionPreparationSnapshot } from '@/types/preparation'

export type RecentPreparationSectionId = 'analysis' | 'strategy' | 'tactics'

export interface RecentPreparation {
  caseId: string
  roleIndex: 0 | 1
  mode: NegotiationMode
  sectionId: RecentPreparationSectionId
  updatedAt: string
}

export type RecentPreparationIdentity = Pick<RecentPreparation, 'caseId' | 'roleIndex' | 'mode'>

export type PreparationStepId =
  | 'root-conflict'
  | 'strategic-goal'
  | 'proposals'
  | 'layers'
  | 'swot'
  | 'negotiation-goal'
  | 'bargaining'
  | 'batna'
  | 'scenario'
  | 'opening'

export const PREPARATION_STEP_IDS: PreparationStepId[] = [
  'root-conflict', 'strategic-goal', 'proposals', 'layers', 'swot',
  'negotiation-goal', 'bargaining', 'batna', 'scenario', 'opening',
]

export function createEmptyPreparation(): PreparationDraft {
  return {
    rootConflict: '', strategicGoal: '', proposals: '',
    layers: { economic: '', legal: '', technical: '', technological: '', emotional: '', psychological: '', aesthetic: '', ethical: '' },
    swot: { strengths: '', weaknesses: '', opportunities: '', threats: '' },
    negotiationGoal: '',
    bargaining: { declared: '', desired: '', redLine: '' },
    batna: '', scenario: '', opening: '',
  }
}

function hasText(value: string): boolean { return value.trim().length > 0 }
function hasSome(values: Record<string, string>): boolean { return Object.values(values).some(hasText) }

export function completedPreparationSteps(draft: PreparationDraft): PreparationStepId[] {
  return PREPARATION_STEP_IDS.filter((step) => {
    if (step === 'root-conflict') return hasText(draft.rootConflict)
    if (step === 'strategic-goal') return hasText(draft.strategicGoal)
    if (step === 'proposals') return hasText(draft.proposals)
    if (step === 'layers') return hasSome(draft.layers)
    if (step === 'swot') return hasSome(draft.swot)
    if (step === 'negotiation-goal') return hasText(draft.negotiationGoal)
    if (step === 'bargaining') return hasSome(draft.bargaining)
    return hasText(draft[step])
  })
}

export function preparationProgressPercent(draft: PreparationDraft): number {
  return completedPreparationSteps(draft).length * 10
}

type MarkdownField = [label: string, value: string]

function block(title: string, fields: MarkdownField[]): string | null {
  const content = fields
    .map(([label, value]) => [label, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `### ${label}\n${value}`)
  return content.length > 0 ? `# ${title}\n\n${content.join('\n\n')}` : null
}

export function serializePreparation(draft: PreparationDraft): string {
  const blocks = [
    block('Анализ ситуации', [
      ['Корневой конфликт', draft.rootConflict],
      ['Стратегическая цель ситуации', draft.strategicGoal],
      ['Предложения, решающие конфликт', draft.proposals],
      ['Экономический слой', draft.layers.economic],
      ['Юридический слой', draft.layers.legal],
      ['Технический слой', draft.layers.technical],
      ['Технологический слой', draft.layers.technological],
      ['Эмоциональный слой', draft.layers.emotional],
      ['Психологический слой', draft.layers.psychological],
      ['Эстетический слой', draft.layers.aesthetic],
      ['Этический слой', draft.layers.ethical],
    ]),
    block('Стратегия', [
      ['Сильные стороны', draft.swot.strengths],
      ['Слабые стороны', draft.swot.weaknesses],
      ['Возможности', draft.swot.opportunities],
      ['Угрозы', draft.swot.threats],
      ['Цель на переговоры', draft.negotiationGoal],
      ['Заявляемая позиция', draft.bargaining.declared],
      ['Желаемая позиция', draft.bargaining.desired],
      ['Красная черта', draft.bargaining.redLine],
      ['BATNA', draft.batna],
    ]),
    block('Тактика', [
      ['Сценарий', draft.scenario],
      ['Загрузка', draft.opening],
    ]),
  ].filter((value): value is string => value !== null)

  return blocks.length > 0
    ? blocks.join('\n\n')
    : '# Подготовка\n\nПользователь не заполнял карточку подготовки.'
}

function isStringRecord(value: unknown, keys: string[]): value is Record<string, string> {
  return typeof value === 'object' && value !== null && keys.every((key) => typeof (value as Record<string, unknown>)[key] === 'string')
}

export function parsePreparationDraft(value: unknown): PreparationDraft | null {
  if (!isStringRecord(value, ['rootConflict', 'strategicGoal', 'proposals', 'negotiationGoal', 'batna', 'scenario', 'opening'])) return null
  const source = value as Record<string, unknown>
  if (!isStringRecord(source.layers, ['economic', 'legal', 'technical', 'technological', 'emotional', 'psychological', 'aesthetic', 'ethical'])) return null
  if (!isStringRecord(source.swot, ['strengths', 'weaknesses', 'opportunities', 'threats'])) return null
  if (!isStringRecord(source.bargaining, ['declared', 'desired', 'redLine'])) return null
  return value as unknown as PreparationDraft
}

const DRAFT_PREFIX = 'arena.preparation-draft.v2'
const SNAPSHOT_PREFIX = 'arena.session-preparation.v2'
const RECENT_PREPARATION_PREFIX = 'arena.recent-preparation.v1'
const PREPARATION_STORAGE_PREFIXES = [DRAFT_PREFIX, SNAPSHOT_PREFIX] as const
const memoryStorage = new Map<string, string>()

function scopedStorageKey(prefix: string, ownerKey: string, entityId: string): string {
  if (!ownerKey) throw new Error('Preparation storage requires an authenticated owner.')
  return `${prefix}.${encodeURIComponent(ownerKey)}.${encodeURIComponent(entityId)}`
}

function readStoredValue(key: string): string | null {
  const memoryValue = memoryStorage.get(key)
  if (memoryValue !== undefined) return memoryValue
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStoredValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
    memoryStorage.delete(key)
  } catch {
    memoryStorage.set(key, value)
  }
}

function removeStoredValue(key: string): void {
  memoryStorage.delete(key)
  try {
    window.localStorage.removeItem(key)
  } catch {
    // The in-memory value was already removed.
  }
}

export function draftStorageKey(ownerKey: string, caseId: string, roleIndex: 0 | 1): string {
  return `${scopedStorageKey(DRAFT_PREFIX, ownerKey, caseId)}.${roleIndex}`
}

export function sessionPreparationStorageKey(ownerKey: string, sessionId: string): string {
  return scopedStorageKey(SNAPSHOT_PREFIX, ownerKey, sessionId)
}

export function recentPreparationStorageKey(ownerKey: string): string {
  if (!ownerKey) throw new Error('Preparation storage requires an authenticated owner.')
  return `${RECENT_PREPARATION_PREFIX}.${encodeURIComponent(ownerKey)}`
}

export function migratePreparationStorageOwner(sourceOwnerKey: string, targetOwnerKey: string): void {
  if (!sourceOwnerKey || !targetOwnerKey || sourceOwnerKey === targetOwnerKey) return

  const sourcePrefixes = PREPARATION_STORAGE_PREFIXES.map((prefix) => (
    `${prefix}.${encodeURIComponent(sourceOwnerKey)}.`
  ))
  const keys = new Set(memoryStorage.keys())

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (key) keys.add(key)
    }
  } catch {
    // The in-memory fallback can still be migrated when localStorage is unavailable.
  }

  for (const key of keys) {
    const sourcePrefix = sourcePrefixes.find((prefix) => key.startsWith(prefix))
    if (!sourcePrefix) continue
    const storagePrefix = PREPARATION_STORAGE_PREFIXES[sourcePrefixes.indexOf(sourcePrefix)]
    const targetKey = `${storagePrefix}.${encodeURIComponent(targetOwnerKey)}.${key.slice(sourcePrefix.length)}`
    if (readStoredValue(targetKey) !== null) continue
    const value = readStoredValue(key)
    if (value !== null) writeStoredValue(targetKey, value)
  }

  const sourceRecentKey = recentPreparationStorageKey(sourceOwnerKey)
  const targetRecentKey = recentPreparationStorageKey(targetOwnerKey)
  if (readStoredValue(targetRecentKey) === null) {
    const recentValue = readStoredValue(sourceRecentKey)
    if (recentValue !== null) writeStoredValue(targetRecentKey, recentValue)
  }
}

export function readPreparationDraft(ownerKey: string, caseId: string, roleIndex: 0 | 1): PreparationDraft {
  try {
    const serialized = readStoredValue(draftStorageKey(ownerKey, caseId, roleIndex))
    if (!serialized) return createEmptyPreparation()
    return parsePreparationDraft(JSON.parse(serialized) as unknown) ?? createEmptyPreparation()
  } catch {
    return createEmptyPreparation()
  }
}

export function savePreparationDraft(ownerKey: string, caseId: string, roleIndex: 0 | 1, draft: PreparationDraft): void {
  writeStoredValue(draftStorageKey(ownerKey, caseId, roleIndex), JSON.stringify(draft))
}

function parseRecentPreparation(value: unknown): RecentPreparation | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  if (typeof source.caseId !== 'string' || source.caseId.length === 0) return null
  if (source.roleIndex !== 0 && source.roleIndex !== 1) return null
  if (source.mode !== 'text' && source.mode !== 'voice') return null
  if (source.sectionId !== 'analysis' && source.sectionId !== 'strategy' && source.sectionId !== 'tactics') return null
  if (typeof source.updatedAt !== 'string' || !Number.isFinite(Date.parse(source.updatedAt))) return null
  return {
    caseId: source.caseId,
    roleIndex: source.roleIndex,
    mode: source.mode,
    sectionId: source.sectionId,
    updatedAt: source.updatedAt,
  }
}

export function readRecentPreparation(ownerKey: string): RecentPreparation | null {
  const key = recentPreparationStorageKey(ownerKey)
  try {
    const serialized = readStoredValue(key)
    if (!serialized) return null
    const recent = parseRecentPreparation(JSON.parse(serialized) as unknown)
    if (recent) return recent
  } catch {
    // Invalid storage is removed below.
  }
  removeStoredValue(key)
  return null
}

export function saveRecentPreparation(ownerKey: string, recent: RecentPreparation): void {
  writeStoredValue(recentPreparationStorageKey(ownerKey), JSON.stringify(recent))
}

export function clearRecentPreparation(ownerKey: string, expected?: RecentPreparationIdentity): void {
  if (expected) {
    const recent = readRecentPreparation(ownerKey)
    if (
      !recent
      || recent.caseId !== expected.caseId
      || recent.roleIndex !== expected.roleIndex
      || recent.mode !== expected.mode
    ) return
  }
  removeStoredValue(recentPreparationStorageKey(ownerKey))
}

export function saveSessionPreparation(ownerKey: string, sessionId: string, snapshot: SessionPreparationSnapshot): void {
  writeStoredValue(sessionPreparationStorageKey(ownerKey, sessionId), JSON.stringify(snapshot))
}

export function readSessionPreparation(ownerKey: string, sessionId: string): SessionPreparationSnapshot | null {
  try {
    const serialized = readStoredValue(sessionPreparationStorageKey(ownerKey, sessionId))
    if (!serialized) return null
    const value: unknown = JSON.parse(serialized)
    if (typeof value !== 'object' || value === null) return null
    const source = value as Record<string, unknown>
    const draft = parsePreparationDraft(source.draft)
    if (!draft || !['caseId', 'caseTitle', 'userRole', 'opponentRole'].every((key) => typeof source[key] === 'string')) return null
    const selectedRole = source.selectedRole === 1 ? 1 : 0
    return { caseId: source.caseId as string, caseTitle: source.caseTitle as string, userRole: source.userRole as string, opponentRole: source.opponentRole as string, selectedRole, draft }
  } catch {
    return null
  }
}
