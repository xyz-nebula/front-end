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
    await expect(page.getByText('Забыли пароль?', { exact: true })).toHaveCount(0)
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
    const caseCards = page.locator('.home-case-card')
    await expect(caseCards).toHaveCount(6)
    await expect(caseCards.first().locator('.home-case-card__description')).toHaveText('Вы считаете, что ваши результаты и выросшая ответственность заслуживают пересмотра зарплаты. Руководитель ценит ваш вклад, но бюджет команды ограничен и решение потребует убедительных аргументов.')
    await expect(caseCards.first().locator('.home-case-card__difficulty-bars i')).toHaveCount(4)
    await expect(caseCards.first().locator('.home-case-card__difficulty-bars i.is-active')).toHaveCount(2)
    await expect(caseCards.nth(1).locator('.home-case-card__difficulty-bars i.is-active')).toHaveCount(3)
    await expect(caseCards.nth(3).locator('.home-case-card__difficulty-bars i.is-active')).toHaveCount(1)
    await captureScreen(page, 'home', viewport.name)

    await caseCards.first().click()
    const modal = page.locator('.home-case-modal')
    await expect(modal.locator('.home-case-modal__intro')).toHaveText('Аргументируй свою ценность и договорись о новых условиях с руководителем.')
    await expect(modal.getByText('Аргументируй свою ценность и договорись о новых условиях с руководителем.', { exact: true })).toHaveCount(1)
    await expect(modal.getByRole('heading', { name: 'Ситуация' })).toHaveCount(0)
    await expect(modal.getByText('Формат тренировки', { exact: true })).toHaveCount(0)
    const roleCards = page.locator('.home-case-modal__role')
    await expect(roleCards).toHaveCount(2)
    await expect(roleCards.locator('img')).toHaveCount(0)
    await roleCards.first().scrollIntoViewIfNeeded()
    await captureScreen(page, 'role-selection-empty', viewport.name)

    await roleCards.first().getByRole('radio').check()
    await expect(roleCards.locator('img')).toHaveCount(2)
    await expect(roleCards.first().locator('img')).toHaveAttribute('src', /profile\.webp$/)
    await expect(roleCards.nth(1).locator('img')).toHaveAttribute('src', /opponent\.webp$/)
    await captureScreen(page, 'role-selection-selected', viewport.name)

    await modal.getByRole('button', { name: 'Начать подготовку' }).click()
    await expect(page).toHaveURL(/\/cases\/salary-review\/preparation\?role=0&mode=voice&section=analysis$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Подготовка к переговорам' })).toBeVisible()
    await captureScreen(page, 'preparation', viewport.name)

    await page.goto(`/arena/${state.activeSessionId}`)
    await expect(page.locator('.duel-heading h1')).toBeVisible()
    await expect(page.getByLabel('Оставшееся время')).toHaveText('15:00')
    await expect(page.getByText('Таймер начнётся после первой реплики')).toBeVisible()
    await expect(page.getByLabel('Ваша реплика')).toBeVisible()
    await captureScreen(page, 'arena', viewport.name)

    await page.getByLabel('Ваша реплика').fill('Проверяем аватары участников.')
    await page.getByLabel('Отправить сообщение').click()
    const messages = page.locator('.arena-message')
    await expect(messages).toHaveCount(2)
    await expect(messages.filter({ has: page.locator('.arena-message__avatar[src$="profile.webp"]') })).toHaveCount(1)
    await expect(messages.filter({ has: page.locator('.arena-message__avatar[src$="opponent.webp"]') })).toHaveCount(1)

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
