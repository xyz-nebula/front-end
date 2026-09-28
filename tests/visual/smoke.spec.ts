import { expect, test } from '@playwright/test'

import {
  captureScreen,
  ensureArtifactsDirectory,
  seedProtectedScreens,
} from './helpers'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

test.beforeAll(async () => {
  await ensureArtifactsDirectory()
})

for (const viewport of viewports) {
  test(`${viewport.name} routes render their primary UI`, async ({ page }) => {
    test.setTimeout(45_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: viewport.width, height: viewport.height })

    await page.goto('/')
    await expect(page.locator('#arena-hero-title')).toBeVisible()
    await captureScreen(page, 'landing', viewport.name)

    await page.goto('/login')
    await expect(page.locator('#login-title')).toBeVisible()
    await captureScreen(page, 'login', viewport.name)

    await page.goto('/register')
    await expect(page.locator('#register-title')).toBeVisible()
    await captureScreen(page, 'register', viewport.name)

    await page.goto('/activate')
    await expect(page.locator('#activation-title')).toBeVisible()
    await captureScreen(page, 'activation', viewport.name)

    await page.goto('/missing-smoke-route')
    await expect(page.locator('#not-found-title')).toBeVisible()
    await captureScreen(page, 'not-found', viewport.name)

    await page.goto('/auth')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.locator('#login-title')).toBeVisible()

    await page.goto('/home')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.locator('#login-title')).toBeVisible()

    const state = await seedProtectedScreens(page, viewport.name)

    await page.goto('/home')
    await expect(page.locator('#home-cases-title')).toBeVisible()
    await expect(page.locator('.home-case-card')).toHaveCount(6)
    await captureScreen(page, 'home', viewport.name)

    await page.goto('/cases/salary-review/preparation?role=0&mode=text&section=analysis')
    await expect(page.getByRole('heading', { level: 1, name: 'Подготовка к переговорам' })).toBeVisible()
    await captureScreen(page, 'preparation', viewport.name)

    await page.goto(`/arena/${state.activeSessionId}`)
    await expect(page.locator('.duel-heading h1')).toBeVisible()
    await expect(page.getByLabel('Оставшееся время')).toHaveText('15:00')
    await expect(page.getByText('Таймер начнётся после первой реплики')).toBeVisible()
    await expect(page.getByLabel('Ваша реплика')).toBeVisible()
    await captureScreen(page, 'arena', viewport.name)

    await page.goto(`/result/${state.finishedSessionId}`)
    await expect(page.locator('.result-intro h1')).toHaveText('Разбор поединка')
    await captureScreen(page, 'result', viewport.name)
  })
}

test('an expired persisted session automatically starts evaluation after reload', async ({ page }) => {
  const state = await seedProtectedScreens(page, 'expired-session')

  await page.goto(`/arena/${state.expiredSessionId}`)
  await expect(page).toHaveURL(new RegExp(`/result/${state.expiredSessionId}$`))
  await expect.poll(() => page.evaluate(({ sessionId }) => {
    const serialized = localStorage.getItem('arena.mock.data.v2')
    if (!serialized) return 0
    const data = JSON.parse(serialized) as { results?: Array<{ sessionId?: string }> }
    return data.results?.filter((result) => result.sessionId === sessionId).length ?? 0
  }, { sessionId: state.expiredSessionId })).toBe(1)
})
