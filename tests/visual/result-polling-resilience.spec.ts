import { expect, test } from './helpers'

test('result polling uses a long deadline and cancels stale or duplicate loops', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible()
  const result = await page.evaluate(async () => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const harness = await import('/tests/visual/result-polling-harness.tsx')
    try {
      return await harness.runResultPollingResilienceScenario()
    } finally {
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
    }
  })

  expect(result.defaultPolicy).toEqual({
    initialDelaysMs: [500, 1_000, 2_000],
    intervalMs: 4_000,
    deadlineMs: 360_000,
  })
  expect(result.polling).toEqual({ calls: 5, status: 'ready' })
  expect(result.switched).toEqual({ result: 'ready', session: 'new' })
  expect(result.deduplication).toEqual({ calls: 2, maximumActiveRequests: 1, status: 'ready' })
  expect(result.deadline).toEqual({
    error: 'Разбор готовится дольше обычного. Проверьте ещё раз.',
    processingStatus: 'processing',
  })
  expect(result.retried).toEqual({ calls: 4, error: null, status: 'ready' })
  expect(result.unmountedCalls).toBe(1)
})
