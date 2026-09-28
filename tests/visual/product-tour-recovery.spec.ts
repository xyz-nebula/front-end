import { artifactsDir, captureScreenshot, expect, expectNoHorizontalOverflow, test, type Page } from './helpers'

interface StoredTourState {
  schemaVersion: 1
  tourVersion: 'product-tour-v1'
  status: 'active' | 'paused'
  stepId: string
  caseId?: string
  roleIndex?: 0 | 1
  sessionId?: string
  updatedAt: string
}

async function registerTourUser(page: Page, email: string) {
  await page.goto('/register')
  await page.getByLabel('Имя', { exact: true }).fill('Тур')
  await page.getByLabel('Фамилия').fill('Восстановление')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await page.getByRole('link', { name: 'Открыть demo-ссылку активации' }).click()
  await page.getByRole('link', { name: 'Перейти в приложение' }).click()
  await page.getByRole('dialog', { name: 'Познакомимся с Ареной?' }).getByRole('button', { name: 'Начать тур' }).click()
}

async function replaceTourState(page: Page, changes: Partial<StoredTourState>) {
  await page.evaluate((next) => {
    const key = Object.keys(window.localStorage).find((candidate) => candidate.startsWith('arena.product-tour.v1.'))
    if (!key) throw new Error('Product tour state was not created.')
    const current = JSON.parse(window.localStorage.getItem(key) ?? 'null') as StoredTourState
    window.localStorage.setItem(key, JSON.stringify({ ...current, ...next, updatedAt: new Date().toISOString() }))
  }, changes)
}

async function readTourState(page: Page): Promise<StoredTourState | null> {
  return page.evaluate(() => {
    const key = Object.keys(window.localStorage).find((candidate) => candidate.startsWith('arena.product-tour.v1.'))
    return key ? JSON.parse(window.localStorage.getItem(key) ?? 'null') as StoredTourState : null
  })
}

async function continueTour(page: Page) {
  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await page.getByRole('button', { name: 'Продолжить тур' }).click()
}

test('tour restores reversible routes and resets a lost home modal to the case step', async ({ page }) => {
  test.skip(process.env.VITE_AUTH_SOURCE !== 'mock' || process.env.VITE_NEGOTIATION_SOURCE !== 'mock', 'Requires mock auth and negotiation.')
  await registerTourUser(page, 'tour.restore@example.com')

  await replaceTourState(page, { status: 'paused', stepId: 'strategy', caseId: 'salary-review', roleIndex: 0 })
  await page.reload()
  await continueTour(page)
  await expect(page).toHaveURL('/cases/salary-review/preparation?role=0&mode=voice&section=strategy')
  await expect(page.locator('[data-tour-id="preparation-strategy"]')).toBeVisible()

  await page.goto('/home')
  await expect.poll(() => readTourState(page)).toMatchObject({ status: 'paused', stepId: 'strategy' })
  await replaceTourState(page, { status: 'paused', stepId: 'role' })
  await page.reload()
  await continueTour(page)
  await expect(page).toHaveURL('/home')
  await expect.poll(() => readTourState(page)).toMatchObject({ status: 'active', stepId: 'case' })
  await expect(page.locator('[data-product-tour-tooltip]').getByRole('heading', { name: 'Начни с кейса' })).toBeVisible()
})

test('unavailable owner-scoped session can restart only the tour context', async ({ page }) => {
  test.skip(process.env.VITE_AUTH_SOURCE !== 'mock' || process.env.VITE_NEGOTIATION_SOURCE !== 'mock', 'Requires mock auth and negotiation.')
  await registerTourUser(page, 'tour.missing-session@example.com')
  await replaceTourState(page, { status: 'paused', stepId: 'microphone', sessionId: 'missing-session' })
  await page.evaluate(() => window.localStorage.setItem('arena.product-data-proof', 'preserved'))
  await page.reload()
  await continueTour(page)

  const dialog = page.getByRole('dialog', { name: 'Не удалось продолжить тур' })
  await expect(dialog).toContainText('Эта тренировка больше недоступна. Начни тур заново, чтобы пройти путь на новой сессии.')
  await expect(dialog.getByRole('button', { name: 'Начать заново' })).toBeFocused()
  await expect(page.locator('#root')).toHaveJSProperty('inert', true)
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/product-tour-recovery-error-desktop.png`)
  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/product-tour-recovery-error-mobile.png`)
  await dialog.getByRole('button', { name: 'Начать заново' }).click()

  await expect(page).toHaveURL('/home')
  await expect.poll(() => readTourState(page)).toMatchObject({ status: 'active', stepId: 'case' })
  expect(await page.evaluate(() => window.localStorage.getItem('arena.product-data-proof'))).toBe('preserved')
})

test('missing target stops the tour after ten seconds and closing pauses it', async ({ page }) => {
  test.skip(process.env.VITE_AUTH_SOURCE !== 'mock' || process.env.VITE_NEGOTIATION_SOURCE !== 'mock', 'Requires mock auth and negotiation.')
  test.setTimeout(30_000)
  await registerTourUser(page, 'tour.target-timeout@example.com')
  await replaceTourState(page, { status: 'active', stepId: 'role', caseId: 'salary-review' })
  await page.reload()

  const dialog = page.getByRole('dialog', { name: 'Не удалось продолжить тур' })
  await expect(dialog).toContainText('Нужный элемент не появился на странице. Обнови страницу или начни тур заново из меню профиля.', { timeout: 12_000 })
  await dialog.getByRole('button', { name: 'Закрыть' }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => readTourState(page)).toMatchObject({ status: 'paused', stepId: 'role' })
})
