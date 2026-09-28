import { mkdir } from 'node:fs/promises'

import { expect, type Page } from '@playwright/test'

export const artifactsDir = 'artifacts/visual-smoke'

export interface SeededSmokeState {
  activeSessionId: string
  finishedSessionId: string
}

export async function ensureArtifactsDirectory() {
  await mkdir(artifactsDir, { recursive: true })
}

export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
}

export async function captureScreen(page: Page, screen: string, viewport: string) {
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: `${artifactsDir}/${screen}-${viewport}.png`,
    animations: 'disabled',
  })
}

export async function seedProtectedScreens(page: Page, seed: string): Promise<SeededSmokeState> {
  await page.goto('/')

  return page.evaluate(async ({ seedValue }) => {
    const [
      { AUTH_STORAGE_KEY },
      { deferProductTourPrompt },
      { MockAuthClient },
      { MockRuntime },
      { MockStorage, MOCK_DATA_STORAGE_KEY },
    ] = await Promise.all([
      import('/src/auth/storage.ts'),
      import('/src/features/product-tour/productTourStorage.ts'),
      import('/src/services/mock/mockAuthClient.ts'),
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])

    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(MOCK_DATA_STORAGE_KEY)

    const ownerKey = `smoke-owner-${seedValue}`
    const storage = new MockStorage(localStorage)
    const auth = new MockAuthClient(storage, 0)
    const registered = await auth.register({
      email: `smoke-${seedValue}@example.com`,
      first_name: 'Smoke',
      last_name: 'Test',
      password: 'strong-password',
    })
    const tokens = await auth.activate(registered.demo_activation_code ?? '')

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      tokens,
      source: 'mock',
      mockOwnerKey: ownerKey,
      tourOwnerKey: ownerKey,
    }))
    deferProductTourPrompt(ownerKey)

    const runtime = new MockRuntime(storage)
    const activeSession = await runtime.createSession(ownerKey, {
      caseId: 'salary-review',
      mode: 'text',
      clientCommandId: `active-${seedValue}`,
    })
    const finishedSession = await runtime.createSession(ownerKey, {
      caseId: 'salary-review',
      mode: 'text',
      clientCommandId: `finished-${seedValue}`,
    })
    await runtime.sendTextTurn(ownerKey, {
      sessionId: finishedSession.id,
      text: 'Хочу обсудить новые условия.',
      clientTurnId: `turn-one-${seedValue}`,
    })
    await runtime.sendTextTurn(ownerKey, {
      sessionId: finishedSession.id,
      text: 'Давайте зафиксируем следующий шаг.',
      clientTurnId: `turn-two-${seedValue}`,
    })
    await runtime.finishSession(ownerKey, finishedSession.id, `finish-${seedValue}`, 0)
    storage.dispose()

    return {
      activeSessionId: activeSession.id,
      finishedSessionId: finishedSession.id,
    }
  }, { seedValue: seed })
}
