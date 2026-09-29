import assert from 'node:assert/strict'
import test from 'node:test'

import { CaptureAttemptGuard } from '../../src/features/arena/captureAttemptGuard.ts'

test('starting a new capture invalidates the previous attempt', () => {
  const guard = new CaptureAttemptGuard()
  const first = guard.begin(() => true)
  const second = guard.begin(() => true)

  assert.equal(first.isCurrent(), false)
  assert.equal(second.isCurrent(), true)
})

test('stopping capture invalidates an in-flight attempt', () => {
  const guard = new CaptureAttemptGuard()
  const attempt = guard.begin(() => true)

  guard.invalidate()

  assert.equal(attempt.isCurrent(), false)
})

test('a stale acquired stream is disposed before it can be published', () => {
  const guard = new CaptureAttemptGuard()
  const attempt = guard.begin(() => true)
  let stoppedTracks = 0
  guard.invalidate()

  const discarded = attempt.discardIfStale(() => { stoppedTracks += 2 })

  assert.equal(discarded, true)
  assert.equal(stoppedTracks, 2)
})

test('a current acquired stream is retained', () => {
  const guard = new CaptureAttemptGuard()
  const attempt = guard.begin(() => true)
  let disposed = false

  const discarded = attempt.discardIfStale(() => { disposed = true })

  assert.equal(discarded, false)
  assert.equal(disposed, false)
})

test('an attempt also follows its session and connection context', () => {
  const guard = new CaptureAttemptGuard()
  let contextCurrent = true
  const attempt = guard.begin(() => contextCurrent)

  assert.equal(attempt.isCurrent(), true)
  contextCurrent = false
  assert.equal(attempt.isCurrent(), false)
})
