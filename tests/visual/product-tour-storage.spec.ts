import { expect, test } from './helpers'

test('tour owner identity is normalized, pseudonymous, and source-scoped', async ({ page }) => {
  await page.goto('/')

  const keys = await page.evaluate(async () => {
    const identity = await import('/src/auth/tourOwnerIdentity.ts')
    return {
      normalized: await identity.createTourOwnerKey('real', '  User@Example.COM '),
      repeated: await identity.createTourOwnerKey('real', 'user@example.com'),
      otherSource: await identity.createTourOwnerKey('mock', 'user@example.com'),
    }
  })

  expect(keys.normalized).toBe(keys.repeated)
  expect(keys.normalized).not.toBe(keys.otherSource)
  expect(keys.normalized).toMatch(/^[a-f0-9]{64}$/)
  expect(keys.normalized).not.toContain('user')
})

test('product tour storage validates schema and isolates owners', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const storage = await import('/src/features/product-tour/productTourStorage.ts')
    const state = {
      schemaVersion: 1 as const,
      tourVersion: storage.PRODUCT_TOUR_VERSION,
      status: 'paused' as const,
      stepId: 'strategy' as const,
      caseId: 'case-a',
      roleIndex: 1 as const,
      updatedAt: new Date().toISOString(),
    }
    storage.writeProductTourState('owner/a', state)
    window.localStorage.setItem(storage.getProductTourStorageKey('broken'), '{bad json')

    return {
      ownerA: storage.readProductTourState('owner/a').state,
      ownerB: storage.readProductTourState('owner/b').state,
      broken: storage.readProductTourState('broken').state,
      brokenRemoved: window.localStorage.getItem(storage.getProductTourStorageKey('broken')) === null,
    }
  })

  expect(result.ownerA).toMatchObject({ status: 'paused', stepId: 'strategy', caseId: 'case-a' })
  expect(result.ownerB).toBeNull()
  expect(result.broken).toBeNull()
  expect(result.brokenRemoved).toBe(true)
})

test('product tour storage falls back to memory when browser storage is unavailable', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const storage = await import('/src/features/product-tour/productTourStorage.ts')
    const identity = await import('/src/auth/tourOwnerIdentity.ts')
    const originalSetItem = Storage.prototype.setItem
    const originalGetItem = Storage.prototype.getItem
    Storage.prototype.setItem = () => { throw new DOMException('disabled', 'SecurityError') }
    Storage.prototype.getItem = () => { throw new DOMException('disabled', 'SecurityError') }
    try {
      const state = {
        schemaVersion: 1 as const,
        tourVersion: storage.PRODUCT_TOUR_VERSION,
        status: 'active' as const,
        stepId: 'case' as const,
        updatedAt: new Date().toISOString(),
      }
      const persisted = storage.writeProductTourState('memory-owner', state)
      const loaded = storage.readProductTourState('memory-owner')
      const promptPersisted = storage.deferProductTourPrompt('memory-owner')
      const promptDeferred = storage.isProductTourPromptDeferred('memory-owner')
      identity.clearTourPromptDeferral('memory-owner')
      return {
        persisted,
        loaded,
        promptPersisted,
        promptDeferred,
        promptCleared: !storage.isProductTourPromptDeferred('memory-owner'),
      }
    } finally {
      Storage.prototype.setItem = originalSetItem
      Storage.prototype.getItem = originalGetItem
    }
  })

  expect(result.persisted).toBe(false)
  expect(result.loaded.storageAvailable).toBe(false)
  expect(result.loaded.state).toMatchObject({ status: 'active', stepId: 'case' })
  expect(result.promptPersisted).toBe(false)
  expect(result.promptDeferred).toBe(true)
  expect(result.promptCleared).toBe(true)
})
