import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createEmptyPreparation,
  draftStorageKey,
  migratePreparationStorageOwner,
  preparationProgressPercent,
  readPreparationDraft,
  readSessionPreparation,
  savePreparationDraft,
  saveSessionPreparation,
  sessionPreparationStorageKey,
} from '../../src/features/preparation/preparation.ts'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size },
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

  migratePreparationStorageOwner('legacy-owner', 'stable-owner')
  migratePreparationStorageOwner('legacy-owner', 'stable-owner')

  assert.deepEqual(readPreparationDraft('stable-owner', 'case-id', 0), targetDraft)
  assert.deepEqual(readSessionPreparation('stable-owner', 'session-id'), snapshot)
  assert.deepEqual(readPreparationDraft('legacy-owner', 'case-id', 0), sourceDraft)
  assert.notEqual(
    draftStorageKey('legacy-owner', 'case-id', 0),
    draftStorageKey('stable-owner', 'case-id', 0),
  )
})
