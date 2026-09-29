import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createEmptyPreparation,
  clearRecentPreparation,
  draftStorageKey,
  migratePreparationStorageOwner,
  preparationProgressPercent,
  readPreparationDraft,
  readRecentPreparation,
  readSessionPreparation,
  recentPreparationStorageKey,
  savePreparationDraft,
  saveRecentPreparation,
  saveSessionPreparation,
  sessionPreparationStorageKey,
} from '../../src/features/preparation/preparation.ts'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size },
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

test('preparation progress uses ten equally weighted sections', () => {
  const empty = createEmptyPreparation()
  assert.equal(preparationProgressPercent(empty), 0)
  assert.equal(preparationProgressPercent({
    ...empty,
    rootConflict: 'Conflict',
    layers: { ...empty.layers, economic: 'Cost' },
    bargaining: { ...empty.bargaining, desired: 'Target' },
  }), 30)
  assert.equal(preparationProgressPercent({
    rootConflict: 'Conflict',
    strategicGoal: 'Goal',
    proposals: 'Proposal',
    layers: { ...empty.layers, economic: 'Cost' },
    swot: { ...empty.swot, strengths: 'Strength' },
    negotiationGoal: 'Agreement',
    bargaining: { ...empty.bargaining, desired: 'Target' },
    batna: 'Alternative',
    scenario: 'Scenario',
    opening: 'Opening',
  }), 100)
})

test('recent preparation is validated, owner-scoped, and conditionally cleared', () => {
  globalThis.window = { localStorage: createStorage() }
  const recent = {
    caseId: 'case-id',
    roleIndex: 1,
    mode: 'voice',
    sectionId: 'strategy',
    updatedAt: '2026-09-29T12:00:00.000Z',
  }

  saveRecentPreparation('owner-a', recent)
  assert.deepEqual(readRecentPreparation('owner-a'), recent)
  assert.equal(readRecentPreparation('owner-b'), null)

  clearRecentPreparation('owner-a', { caseId: 'another-case', roleIndex: 1, mode: 'voice' })
  assert.deepEqual(readRecentPreparation('owner-a'), recent)
  clearRecentPreparation('owner-a', { caseId: 'case-id', roleIndex: 1, mode: 'voice' })
  assert.equal(readRecentPreparation('owner-a'), null)

  const invalidKey = recentPreparationStorageKey('invalid-owner')
  globalThis.window.localStorage.setItem(invalidKey, JSON.stringify({ ...recent, sectionId: 'unknown' }))
  assert.equal(readRecentPreparation('invalid-owner'), null)
  assert.equal(globalThis.window.localStorage.getItem(invalidKey), null)
})

test('session preparation remains isolated by owner', () => {
  globalThis.window = { localStorage: createStorage() }
  const snapshot = {
    caseId: 'case-id',
    caseTitle: 'Case',
    userRole: 'Buyer',
    opponentRole: 'Seller',
    selectedRole: 0,
    draft: {
      rootConflict: '', strategicGoal: '', proposals: '',
      layers: { economic: '', legal: '', technical: '', technological: '', emotional: '', psychological: '', aesthetic: '', ethical: '' },
      swot: { strengths: '', weaknesses: '', opportunities: '', threats: '' },
      negotiationGoal: 'Agree',
      bargaining: { declared: '', desired: '', redLine: '' },
      batna: '', scenario: '', opening: '',
    },
  }

  saveSessionPreparation('owner-a', 'session-id', snapshot)

  assert.deepEqual(readSessionPreparation('owner-a', 'session-id'), snapshot)
  assert.equal(readSessionPreparation('owner-b', 'session-id'), null)
  assert.notEqual(
    sessionPreparationStorageKey('owner-a', 'session-id'),
    sessionPreparationStorageKey('owner-b', 'session-id'),
  )
})

test('preparation storage migration copies drafts and snapshots without overwriting target data', () => {
  globalThis.window = { localStorage: createStorage() }
  const sourceDraft = { ...createEmptyPreparation(), strategicGoal: 'Source goal' }
  const targetDraft = { ...createEmptyPreparation(), strategicGoal: 'Target goal' }
  const snapshot = {
    caseId: 'case-id',
    caseTitle: 'Case',
    userRole: 'Buyer',
    opponentRole: 'Seller',
    selectedRole: 1,
    draft: sourceDraft,
  }

  savePreparationDraft('legacy-owner', 'case-id', 0, sourceDraft)
  savePreparationDraft('stable-owner', 'case-id', 0, targetDraft)
  saveSessionPreparation('legacy-owner', 'session-id', snapshot)
  const sourceRecent = {
    caseId: 'case-id',
    roleIndex: 0,
    mode: 'voice',
    sectionId: 'analysis',
    updatedAt: '2026-09-29T12:00:00.000Z',
  }
  saveRecentPreparation('legacy-owner', sourceRecent)

  migratePreparationStorageOwner('legacy-owner', 'stable-owner')
  migratePreparationStorageOwner('legacy-owner', 'stable-owner')

  assert.deepEqual(readPreparationDraft('stable-owner', 'case-id', 0), targetDraft)
  assert.deepEqual(readSessionPreparation('stable-owner', 'session-id'), snapshot)
  assert.deepEqual(readRecentPreparation('stable-owner'), sourceRecent)
  assert.deepEqual(readPreparationDraft('legacy-owner', 'case-id', 0), sourceDraft)
  assert.notEqual(
    draftStorageKey('legacy-owner', 'case-id', 0),
    draftStorageKey('stable-owner', 'case-id', 0),
  )

  const targetRecent = { ...sourceRecent, caseId: 'target-case' }
  saveRecentPreparation('occupied-owner', targetRecent)
  migratePreparationStorageOwner('legacy-owner', 'occupied-owner')
  assert.deepEqual(readRecentPreparation('occupied-owner'), targetRecent)
})
