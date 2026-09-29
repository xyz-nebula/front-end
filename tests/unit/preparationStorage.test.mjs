import assert from 'node:assert/strict'
import test from 'node:test'

import {
  readSessionPreparation,
  saveSessionPreparation,
  sessionPreparationStorageKey,
} from '../../src/features/preparation/preparation.ts'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

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
