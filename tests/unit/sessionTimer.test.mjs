import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatRemainingTime,
  getFirstMessageStartedAt,
  getSessionTimerSnapshot,
} from '../../src/features/arena/sessionTimer.ts'

function message(id, sequence, createdAt) {
  return { id, sequence, speaker: 'user', text: id, createdAt }
}

test('the timer waits for the first persisted message', () => {
  const snapshot = getSessionTimerSnapshot([], 600, Date.parse('2026-09-28T12:00:00Z'))

  assert.deepEqual(snapshot, {
    startedAt: null,
    deadline: null,
    remainingSeconds: 600,
    started: false,
    expired: false,
  })
})

test('the lowest sequence defines the timer start regardless of array order', () => {
  const first = message('first', 1, '2026-09-28T12:00:00Z')
  const second = message('second', 2, '2026-09-28T12:00:05Z')

  assert.equal(getFirstMessageStartedAt([second, first]), first.createdAt)
  assert.equal(
    getSessionTimerSnapshot([second, first], 600, Date.parse('2026-09-28T12:00:10Z')).remainingSeconds,
    590,
  )
})

test('the remaining time is clamped to the configured limit for future timestamps', () => {
  const future = message('future', 1, '2026-09-28T12:01:00Z')
  const snapshot = getSessionTimerSnapshot([future], 600, Date.parse('2026-09-28T12:00:00Z'))

  assert.equal(snapshot.remainingSeconds, 600)
  assert.equal(snapshot.expired, false)
})

test('the timer expires exactly at its deadline and stays at zero after reload', () => {
  const first = message('first', 1, '2026-09-28T12:00:00Z')
  const atDeadline = getSessionTimerSnapshot([first], 600, Date.parse('2026-09-28T12:10:00Z'))
  const afterDeadline = getSessionTimerSnapshot([first], 600, Date.parse('2026-09-28T12:30:00Z'))

  assert.equal(atDeadline.remainingSeconds, 0)
  assert.equal(atDeadline.expired, true)
  assert.equal(afterDeadline.remainingSeconds, 0)
  assert.equal(afterDeadline.expired, true)
})

test('remaining time uses a stable MM:SS representation', () => {
  assert.equal(formatRemainingTime(600), '10:00')
  assert.equal(formatRemainingTime(59), '00:59')
  assert.equal(formatRemainingTime(-1), '00:00')
})
