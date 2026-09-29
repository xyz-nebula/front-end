import assert from 'node:assert/strict'
import test from 'node:test'

import { transitionProductTour } from '../../src/features/product-tour/productTourMachine.ts'
import {
  PRODUCT_TOUR_VERSION,
  getProductTourStorageKey,
  readProductTourState,
} from '../../src/features/product-tour/productTourStorage.ts'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

function state(status, overrides = {}) {
  return {
    schemaVersion: 1,
    tourVersion: PRODUCT_TOUR_VERSION,
    status,
    stepId: 'case',
    updatedAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  }
}

test('starting always creates a clean tour at the first step', () => {
  const next = transitionProductTour(state('active', {
    stepId: 'dialogue',
    caseId: 'salary-review',
    roleIndex: 1,
    sessionId: 'old-session',
    dialogueBaseline: { userMessages: 2, aiMessages: 2 },
  }), { type: 'start' }, '2026-09-29T11:00:00.000Z')

  assert.deepEqual(next, state('active', { updatedAt: '2026-09-29T11:00:00.000Z' }))
})

test('dismissing clears progress and prevents another invitation', () => {
  const next = transitionProductTour(state('active', {
    stepId: 'microphone',
    sessionId: 'old-session',
  }), { type: 'dismiss' }, '2026-09-29T11:00:00.000Z')

  assert.deepEqual(next, state('never', { updatedAt: '2026-09-29T11:00:00.000Z' }))
})

test('stored active and paused tours are closed while completed tours and owners remain isolated', () => {
  const localStorage = createStorage()
  globalThis.window = { localStorage }
  const activeOwner = 'active-owner'
  const pausedOwner = 'paused-owner'
  const completedOwner = 'completed-owner'
  localStorage.setItem(getProductTourStorageKey(activeOwner), JSON.stringify(state('active', {
    stepId: 'dialogue', sessionId: 'expired-session',
  })))
  localStorage.setItem(getProductTourStorageKey(pausedOwner), JSON.stringify(state('paused', {
    stepId: 'strategy', caseId: 'salary-review', roleIndex: 1,
  })))
  localStorage.setItem(getProductTourStorageKey(completedOwner), JSON.stringify(state('completed', {
    stepId: 'result', sessionId: 'finished-session',
  })))

  assert.deepEqual(readProductTourState(activeOwner).state?.status, 'never')
  assert.deepEqual(readProductTourState(activeOwner).state?.stepId, 'case')
  assert.equal(readProductTourState(activeOwner).state?.sessionId, undefined)
  assert.deepEqual(readProductTourState(pausedOwner).state?.status, 'never')
  assert.deepEqual(readProductTourState(completedOwner).state, state('completed', {
    stepId: 'result', sessionId: 'finished-session',
  }))
})
