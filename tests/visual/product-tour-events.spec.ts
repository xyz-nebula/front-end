import { expect, test, type Page } from './helpers'

async function tourState(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(window.localStorage).find((candidate) => candidate.startsWith('arena.product-tour.v1.'))
    return key ? JSON.parse(window.localStorage.getItem(key) ?? 'null') as { stepId?: string; status?: string; caseId?: string; roleIndex?: number; sessionId?: string } | null : null
  })
}

test('product events advance the voice tour and expose stable targets', async ({ page }) => {
  test.skip(process.env.VITE_AUTH_SOURCE !== 'mock' || process.env.VITE_NEGOTIATION_SOURCE !== 'mock' || process.env.VITE_AUDIO_SOURCE !== 'mock', 'Requires full mock mode.')
  test.setTimeout(70_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/register')
  await page.getByLabel('Имя', { exact: true }).fill('Тур')
  await page.getByLabel('Фамилия').fill('События')
  await page.getByLabel('Email').fill('tour.events@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await page.getByRole('link', { name: 'Открыть demo-ссылку активации' }).click()
  await page.getByRole('link', { name: 'Перейти в приложение' }).click()

  await page.getByRole('dialog', { name: 'Познакомимся с Ареной?' }).getByRole('button', { name: 'Начать тур' }).click()
  const caseTarget = page.locator('[data-tour-id="case-card"]')
  await expect(caseTarget).toHaveCount(1)
  await caseTarget.click()
  await expect.poll(() => tourState(page)).toMatchObject({ stepId: 'role', caseId: 'salary-review' })

  const caseDialog = page.getByRole('dialog', { name: 'Повышение зарплаты' })
  await expect(caseDialog.locator('[data-tour-id="role-selector"]')).toBeVisible()
  await caseDialog.getByRole('radio', { name: /Сотрудник/ }).check()
  await expect.poll(() => tourState(page)).toMatchObject({ stepId: 'voice-format', roleIndex: 0 })
  await expect(caseDialog.getByRole('radio', { name: 'Текст' })).toHaveCount(0)
  await expect(caseDialog.getByRole('radio', { name: 'Голос' })).toBeChecked()
  await caseDialog.getByRole('button', { name: 'Начать подготовку' }).click()

  await expect(page).toHaveURL(/mode=voice&section=analysis$/)
  await expect(page.locator('[data-tour-id="preparation-analysis"]')).toBeVisible()
  await expect.poll(() => tourState(page)).toMatchObject({ stepId: 'analysis' })
  await page.locator('.preparation-sidebar').getByRole('button', { name: /Стратегия/ }).click()
  await expect(page.locator('[data-tour-id="preparation-strategy"]')).toBeVisible()
  await expect.poll(() => tourState(page)).toMatchObject({ stepId: 'strategy' })
  await page.locator('.preparation-sidebar').getByRole('button', { name: /Тактика/ }).click()
  await expect(page.locator('[data-tour-id="preparation-tactics"]')).toBeVisible()
  await expect.poll(() => tourState(page)).toMatchObject({ stepId: 'tactics' })
  await page.locator('[data-tour-id="start-duel"]').click()

  await expect(page).toHaveURL(/\/arena\/[0-9a-f-]+$/)
  await expect(page.locator('[data-tour-id="microphone"]')).toBeVisible()
  await expect.poll(() => tourState(page)).toMatchObject({ stepId: 'microphone' })
  await page.locator('[data-tour-id="microphone"]').click()
  await expect(page.locator('[data-tour-id="dialogue"] .arena-message')).toHaveCount(2, { timeout: 12_000 })
  await expect.poll(() => tourState(page)).toMatchObject({ stepId: 'finish' })

  const finishTarget = page.locator('[data-tour-id="finish"]')
  await finishTarget.click()
  const finishDialog = page.locator('[data-tour-id="finish-dialog"]')
  await expect(finishDialog).toBeVisible()
  await expect(finishDialog.getByRole('button', { name: 'Продолжить диалог' })).toBeFocused()
  await expect(page.locator('.arena-page > main')).toHaveJSProperty('inert', true)
  await expect.poll(() => tourState(page)).toMatchObject({ stepId: 'confirm-finish' })
  await page.keyboard.press('Escape')
  await expect(finishDialog).toHaveCount(0)
  await expect(finishTarget).toBeFocused()
  await expect.poll(() => tourState(page)).toMatchObject({ stepId: 'finish' })

  await finishTarget.click()
  await finishDialog.getByRole('button', { name: 'Завершить' }).click()
  await expect(page).toHaveURL(/\/result\/[0-9a-f-]+$/)
  await expect(page.locator('[data-tour-id="result"]')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => tourState(page)).toMatchObject({ stepId: 'result', status: 'active' })
})
