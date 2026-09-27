import { expect, test } from './helpers'

test('page data hooks isolate loading, persistence, polling and stale work', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible()
  const result = await page.evaluate(async () => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const harness = await import('/tests/visual/page-data-hooks-harness.tsx')
    try {
      return {
        home: await harness.runHomeDataHookScenario(),
        preparation: await harness.runPreparationDraftHookScenario(),
        result: await harness.runResultDataHookScenario(),
      }
    } finally {
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
    }
  })

  expect(result.home).toEqual({ initial: { cases: 1, casesError: null, historyError: 'История недоступна' }, history: 1, historyError: null, historyCalls: 2 })
  expect(result.preparation).toEqual({ ownerA: 'Черновик A', ownerB: '' })
  expect(result.result).toEqual({ firstError: 'Первый сбой', newResultCalls: 2, readyStatus: 'ready', staleSession: 'new', retriedSession: 'retry', retryAttempts: 2 })
})
