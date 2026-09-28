import { expect, test } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
})

test('late load from an old session or client cannot replace the current arena', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { runLateLoadScenario } = await import('/tests/visual/arena-session-harness.tsx')
    return runLateLoadScenario()
  })

  expect(result).toEqual({
    afterSessionChange: { sessionId: 'arena-b', draft: '', viewState: 'ready' },
    afterClientChange: { sessionId: 'shared-arena', caseId: 'supplier-deadline' },
  })
})

test('late text turn errors and finally blocks do not mutate or unlock the new arena', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { runLateTurnScenario } = await import('/tests/visual/arena-session-harness.tsx')
    return runLateTurnScenario()
  })

  expect(result.callsBeforeBCompletes.map((call) => call.sessionId)).toEqual(['arena-a', 'arena-b'])
  expect(result.sessionId).toBe('arena-b')
  expect(result.messageIds).toEqual(['arena-b-user', 'arena-b-ai'])
  expect(result.error).toBeNull()
  expect(result.pendingA).not.toBeNull()
  expect(result.pendingB).toBeNull()
})

test('late finish cannot complete or unlock the current arena', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { runLateFinishScenario } = await import('/tests/visual/arena-session-harness.tsx')
    return runLateFinishScenario()
  })

  expect(result).toEqual({ calls: ['arena-a', 'arena-b'], viewState: 'finishing' })
})

test('reload recovery keeps the original turn and finish command IDs', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { runPendingRecoveryScenario } = await import('/tests/visual/arena-session-harness.tsx')
    return runPendingRecoveryScenario()
  })

  expect(result).toEqual({
    turnCalls: ['original-turn-id'],
    finishCalls: ['original-finish-id'],
    pendingTurn: null,
    pendingFinish: null,
  })
})

test('failed finish keeps its command ID for an explicit retry', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { runFinishRetryScenario } = await import('/tests/visual/arena-session-harness.tsx')
    return runFinishRetryScenario()
  })

  expect(result.finishCalls).toHaveLength(2)
  expect(result.finishCalls[0]).toBe(result.finishCalls[1])
  expect(result.afterFailure).toMatchObject({
    result: false,
    viewState: 'ready',
    error: 'Временная ошибка завершения',
  })
  expect(result.afterFailure.pending).toBe(result.finishCalls[0])
  expect(result.afterRetry).toEqual({ result: true, viewState: 'finished', pending: null })
})
