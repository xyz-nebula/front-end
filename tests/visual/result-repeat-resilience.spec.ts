import { expect, test } from './helpers'

test('repeat case reuses an unfinished command and starts a new command after success', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { runRepeatRecoveryScenario } = await import('/tests/visual/result-repeat-harness.tsx')
    return runRepeatRecoveryScenario()
  })

  expect(result.retry.calls).toHaveLength(2)
  expect(result.retry.calls[0]).toBe(result.retry.calls[1])
  expect(result.retry).toMatchObject({ rounds: 1, path: '/arena/round-1' })

  expect(result.reload.calls).toHaveLength(2)
  expect(result.reload.calls[0]).toBe(result.reload.calls[1])
  expect(result.reload.path).toBe('/arena/round-after-reload')

  expect(result.memory.calls).toHaveLength(2)
  expect(result.memory.calls[0]).toBe(result.memory.calls[1])
  expect(result.memory.path).toBe('/arena/round-memory')

  expect(result.double.callsBeforeResolve).toHaveLength(1)
  expect(result.double.path).toBe('/arena/round-double')

  expect(result.late.path).toBe('/home')

  expect(result.independent.calls).toHaveLength(2)
  expect(result.independent.distinct).toBe(2)
  expect(result.independent.path).toBe('/arena/round-independent-2')
})
