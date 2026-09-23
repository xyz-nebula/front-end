import { expect, test } from '@playwright/test'

import {
  executeAuthorizedOperation,
  StaleAuthorizedOperationError,
} from '../../src/auth/authorizedOperation'
import { AuthClientError } from '../../src/services/contracts/authClient'
import { parseBackendError } from '../../src/services/real/targetContract'
import { ServiceError } from '../../src/types/api'

interface TestAdapterOptions {
  operation: (accessToken: string) => Promise<string>
  onRefresh?: () => void
  onClear?: () => void
  getGeneration?: () => number
}

function runWithTestAdapter(options: TestAdapterOptions) {
  return executeAuthorizedOperation(options.operation, {
    accessToken: 'initial-access',
    sessionGeneration: 1,
    getSessionGeneration: options.getGeneration ?? (() => 1),
    getSessionVersion: () => 2,
    refreshSession: async () => {
      options.onRefresh?.()
      return { accessToken: 'refreshed-access' }
    },
    clearSession: () => options.onClear?.(),
  })
}

test('retries a parsed ServiceError 401 once with the same command identity', async () => {
  let refreshes = 0
  const calls: Array<{ accessToken: string; commandId: string }> = []
  const commandId = 'stable-command-id'

  const result = await runWithTestAdapter({
    onRefresh: () => { refreshes += 1 },
    operation: async (accessToken) => {
      calls.push({ accessToken, commandId })
      if (calls.length === 1) {
        throw parseBackendError({
          code: 'UNAUTHORIZED',
          message: 'expired',
          field: 'access_token',
        }, 401)
      }
      return 'ok'
    },
  })

  expect(result).toBe('ok')
  expect(refreshes).toBe(1)
  expect(calls).toEqual([
    { accessToken: 'initial-access', commandId },
    { accessToken: 'refreshed-access', commandId },
  ])
})

test('clears the current session after a second HTTP 401', async () => {
  let refreshes = 0
  let clears = 0

  await expect(runWithTestAdapter({
    onRefresh: () => { refreshes += 1 },
    onClear: () => { clears += 1 },
    operation: async () => {
      throw new AuthClientError(401, 'expired')
    },
  })).rejects.toMatchObject({ status: 401, reason: 'http' })

  expect(refreshes).toBe(1)
  expect(clears).toBe(1)
})

test('does not refresh or clear for transient errors and domain 403', async () => {
  const failures = [
    new ServiceError('network', { reason: 'network' }),
    new ServiceError('timeout', { reason: 'timeout' }),
    new ServiceError('invalid', { reason: 'invalid-response' }),
    parseBackendError({ code: 'FORBIDDEN', message: 'forbidden' }, 403),
  ]

  for (const failure of failures) {
    let refreshes = 0
    let clears = 0
    await expect(runWithTestAdapter({
      onRefresh: () => { refreshes += 1 },
      onClear: () => { clears += 1 },
      operation: async () => { throw failure },
    })).rejects.toBe(failure)
    expect(refreshes).toBe(0)
    expect(clears).toBe(0)
  }
})

test('does not retry after the auth session changes while an operation is pending', async () => {
  let generation = 1
  let refreshes = 0
  let releaseOperation = () => undefined
  const operationReleased = new Promise<void>((resolve) => { releaseOperation = resolve })

  const result = runWithTestAdapter({
    getGeneration: () => generation,
    onRefresh: () => { refreshes += 1 },
    operation: async () => {
      await operationReleased
      throw parseBackendError({ code: 'UNAUTHORIZED', message: 'expired' }, 401)
    },
  })

  generation = 2
  releaseOperation()

  await expect(result).rejects.toBeInstanceOf(StaleAuthorizedOperationError)
  expect(refreshes).toBe(0)
})
