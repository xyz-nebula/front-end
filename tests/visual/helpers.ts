import { mkdir } from 'node:fs/promises'

import { expect, type Page } from '@playwright/test'

export const artifactsDir = 'artifacts/visual-smoke'

export interface SeededSmokeState {
  activeSessionId: string
  expiredSessionId: string
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
      timeLimitSeconds: 15 * 60,
      mode: 'text',
      clientCommandId: `active-${seedValue}`,
    })
    const finishedSession = await runtime.createSession(ownerKey, {
      caseId: 'salary-review',
      timeLimitSeconds: 15 * 60,
      mode: 'text',
      clientCommandId: `finished-${seedValue}`,
    })
    const expiredSession = await runtime.createSession(ownerKey, {
      caseId: 'salary-review',
      timeLimitSeconds: 15 * 60,
      mode: 'text',
      clientCommandId: `expired-${seedValue}`,
    })
    await runtime.sendTextTurn(ownerKey, {
      sessionId: expiredSession.id,
      text: 'Начинаем переговоры.',
      clientTurnId: `expired-turn-${seedValue}`,
    })
    await storage.mutate((data) => {
      const session = data.sessions.find((item) => item.id === expiredSession.id)
      if (!session) throw new Error('Expired smoke session was not created.')
      for (const message of session.messages) message.createdAt = '2026-09-28T00:00:00.000Z'
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
      expiredSessionId: expiredSession.id,
      finishedSessionId: finishedSession.id,
    }
  }, { seedValue: seed })
}
