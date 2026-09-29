import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldRecoverCaptureAfterTransportChange } from '../../src/features/arena/captureRecovery.ts'

test('pending microphone capture recovers when the transport reconnects', () => {
  assert.equal(shouldRecoverCaptureAfterTransportChange('reconnecting', true), false)
  assert.equal(shouldRecoverCaptureAfterTransportChange('connected', true), true)
})

test('a healthy capture is not restarted on ordinary connected notifications', () => {
  assert.equal(shouldRecoverCaptureAfterTransportChange('connected', false), false)
})

test('pending capture remains deferred while transport is paused or failed', () => {
  assert.equal(shouldRecoverCaptureAfterTransportChange('paused', true), false)
  assert.equal(shouldRecoverCaptureAfterTransportChange('error', true), false)
})
