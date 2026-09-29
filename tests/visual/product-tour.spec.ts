import { expect, test, type Locator, type Page } from '@playwright/test'

import { captureScreen, expectNoHorizontalOverflow, seedProductTourUser } from './helpers'

const supportedMobileWidths = [320, 360, 390, 430] as const

async function expectTargetAbovePanel(page: Page, target: Locator) {
  await expect(target).toBeVisible()
  await expect(page.locator('[data-product-tour-tooltip]')).toBeVisible()
  await expect.poll(async () => {
    const targetBox = await target.boundingBox()
    const panelBox = await page.locator('[data-product-tour-tooltip]').boundingBox()
    if (!targetBox || !panelBox) return false
    return targetBox.y >= 0
      && targetBox.x >= 0
      && targetBox.x + targetBox.width <= page.viewportSize()!.width
      && targetBox.y + Math.min(targetBox.height, 96) <= panelBox.y
  }).toBe(true)
  await expectNoHorizontalOverflow(page)
}

async function expectNoOverlap(first: Locator, second: Locator) {
  await expect.poll(async () => {
    const firstBox = await first.boundingBox()
    const secondBox = await second.boundingBox()
    if (!firstBox || !secondBox) return false
    return firstBox.x + firstBox.width <= secondBox.x
      || secondBox.x + secondBox.width <= firstBox.x
      || firstBox.y + firstBox.height <= secondBox.y
      || secondBox.y + secondBox.height <= firstBox.y
  }).toBe(true)
}

async function openRoleSelection(page: Page, seed: string) {
  await seedProductTourUser(page, seed)
  await page.goto('/home')
  await expect(page.locator('#product-tour-invitation-description')).toContainText('5–10 минут')
  await expect(page.locator('#product-tour-invitation-description')).toContainText('Понадобится микрофон')
  await expect(page.getByRole('button', { name: 'Больше не показывать' })).toBeVisible()
  if (page.viewportSize()?.width === 390) await captureScreen(page, 'product-tour-invitation', 'mobile')
  await page.getByRole('button', { name: 'Начать тур' }).click()
  await expect(page.locator('.product-tour-tooltip__progress')).toHaveText('Кейс · 1 из 2')
  const caseCard = page.locator('[data-tour-id="case-card"]').nth(1)
  await caseCard.scrollIntoViewIfNeeded()
  await expectTargetAbovePanel(page, caseCard)
  await caseCard.click()
  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Выбери свою роль')
}

test('both role cards remain actionable at every supported mobile width', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const width of supportedMobileWidths) {
    await page.setViewportSize({ width, height: 844 })
    await openRoleSelection(page, `roles-${width}`)

    const roleSelector = page.locator('[data-tour-id="role-selector"]')
    const radios = roleSelector.getByRole('radio')
    await expectTargetAbovePanel(page, roleSelector)
    await radios.first().click()
    await expect(radios.first()).toBeChecked()
    await radios.nth(1).click()
    await expect(radios.nth(1)).toBeChecked()
    await radios.first().focus()
    await radios.first().press('ArrowDown')
    await expect(radios.nth(1)).toBeChecked()
    if (width === 320) await captureScreen(page, 'product-tour-role', 'mobile-320')
    if (width === 390) await captureScreen(page, 'product-tour-role', 'mobile')
  }
})

test('mobile product tour can be completed through primary controls', async ({ page }) => {
  test.setTimeout(70_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await openRoleSelection(page, 'complete-mobile')
  await page.reload()
  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Выбери свою роль')

  const roleSelector = page.locator('[data-tour-id="role-selector"]')
  await expectTargetAbovePanel(page, roleSelector)
  await roleSelector.getByRole('radio').first().check()

  const preparationButton = page.getByRole('button', { name: 'Начать подготовку' })
  await expectTargetAbovePanel(page, page.locator('[data-tour-id="voice-preparation"]'))
  await preparationButton.click()
  await expect(page).toHaveURL(/\/preparation\?.*section=analysis/)
  await expectTargetAbovePanel(page, page.locator('.preparation-bottom__next'))
  await captureScreen(page, 'product-tour-preparation', 'mobile')
  await page.reload()

  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Разбери ситуацию')
  await expect(page.locator('#preparation-root-conflict')).toHaveClass(/product-tour-target/)
  await page.locator('.preparation-bottom__next').click()
  await expect(page).toHaveURL(/section=strategy/)
  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Собери стратегию')
  await expect(page.locator('#preparation-swot')).toHaveClass(/product-tour-target/)
  await page.locator('.preparation-bottom__next').click()
  await expect(page).toHaveURL(/section=tactics/)
  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Продумай тактику')
  await expect(page.locator('#preparation-scenario')).toHaveClass(/product-tour-target/)
  await page.locator('.preparation-bottom__next').click()

  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Выходи на поединок')
  const startDuel = page.locator('.preparation-bottom__next')
  await expectTargetAbovePanel(page, startDuel)
  await startDuel.click()

  await expect(page).toHaveURL(/\/arena\//)
  await page.reload()
  const microphone = page.locator('[data-tour-id="microphone"]')
  await expectTargetAbovePanel(page, microphone)
  await captureScreen(page, 'product-tour-microphone', 'mobile')
  await microphone.click()

  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Ты управляешь длительностью', { timeout: 25_000 })
  const finish = page.locator('[data-tour-id="finish"]')
  await expectTargetAbovePanel(page, finish)
  await captureScreen(page, 'product-tour-finish', 'mobile')
  await finish.click()

  const finishDialog = page.locator('[data-tour-id="finish-dialog"]')
  await expectTargetAbovePanel(page, finishDialog)
  await finishDialog.getByRole('button', { name: 'Завершить', exact: true }).click()

  await expect(page).toHaveURL(/\/result\//, { timeout: 15_000 })
  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Разбор готов', { timeout: 15_000 })
  await expectTargetAbovePanel(page, page.locator('[data-tour-id="result"]'))
  await captureScreen(page, 'product-tour-result', 'mobile')
  await page.reload()
  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Разбор готов', { timeout: 15_000 })
  await page.locator('.product-tour-tooltip').getByRole('button', { name: 'Готово' }).click()
  await expect(page.locator('[data-product-tour-tooltip]')).toHaveCount(0)
})

test('paused role selection resumes with the selected case and role', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await openRoleSelection(page, 'resume-role')

  const secondRole = page.locator('[data-tour-id="role-selector"]').getByRole('radio').nth(1)
  await secondRole.click()
  await page.getByRole('button', { name: 'Меню тура' }).click()
  await expect(page.getByText('Продолжить можно из меню профиля.')).toBeVisible()
  await page.getByRole('button', { name: 'Приостановить тур' }).click()
  await expect(page.locator('[data-product-tour-tooltip]')).toHaveCount(0)

  await page.reload()
  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await page.getByRole('button', { name: 'Продолжить тур' }).click()

  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Перейди к подготовке')
  await expect(page.locator('.product-tour-tooltip__progress')).toHaveText('Подготовка · старт')
  const restoredRoles = page.locator('[data-tour-id="role-selector"]').getByRole('radio')
  await expect(restoredRoles.nth(1)).toBeChecked()
  await expect(page.getByRole('button', { name: 'Начать подготовку' })).toBeEnabled()
})

test('desktop product tour can be completed with precise highlights and pointers', async ({ page }) => {
  test.setTimeout(70_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedProductTourUser(page, 'desktop-target')
  await page.goto('/home')
  await page.getByRole('button', { name: 'Начать тур' }).click()

  const caseCards = page.locator('[data-tour-id="case-card"]')
  await expect(caseCards).toHaveCount(6)
  await expect(page.locator('.home-case-card.product-tour-target')).toHaveCount(3)
  await expect(page.locator('.product-tour-floater')).toHaveAttribute('data-placement', 'top')
  for (let index = 0; index < 3; index += 1) {
    await expectNoOverlap(caseCards.nth(index), page.locator('[data-product-tour-tooltip]'))
  }
  await captureScreen(page, 'product-tour-case', 'desktop')

  await caseCards.nth(1).click()
  const roleSelector = page.locator('[data-tour-id="role-selector"]')
  await expect(roleSelector).toHaveClass(/product-tour-target/)
  await expectNoOverlap(roleSelector, page.locator('[data-product-tour-tooltip]'))
  await roleSelector.getByRole('radio').first().check()
  await page.getByRole('button', { name: 'Начать подготовку' }).click()

  await expect(page).toHaveURL(/\/preparation\?.*section=analysis/)
  const preparationNext = page.locator('[data-tour-id="preparation-next"]')
  await expect(page.locator('#preparation-root-conflict')).toHaveClass(/product-tour-target/)
  await preparationNext.click()
  await expect(page.locator('#preparation-swot')).toHaveClass(/product-tour-target/)
  await page.locator('[data-tour-id="preparation-next"]').click()
  await expect(page.locator('#preparation-scenario')).toHaveClass(/product-tour-target/)
  await page.locator('[data-tour-id="preparation-next"]').click()

  const startDuel = page.locator('.preparation-start[data-tour-id="start-duel"]')
  await expect(startDuel).toHaveClass(/product-tour-target/)
  await expectNoOverlap(startDuel, page.locator('[data-product-tour-tooltip]'))
  await startDuel.click()

  await expect(page).toHaveURL(/\/arena\//)
  const microphone = page.locator('[data-tour-id="microphone"]')
  await expect(microphone).toHaveClass(/product-tour-target/)
  await expectNoOverlap(microphone, page.locator('[data-product-tour-tooltip]'))
  await captureScreen(page, 'product-tour-microphone', 'desktop')
  await microphone.click()

  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Ты управляешь длительностью', { timeout: 25_000 })
  const finish = page.locator('[data-tour-id="finish"]')
  await expectNoOverlap(finish, page.locator('[data-product-tour-tooltip]'))
  await finish.click()
  const finishDialog = page.locator('[data-tour-id="finish-dialog"]')
  await expect(finishDialog).toHaveClass(/product-tour-target/)
  await expectNoOverlap(finishDialog, page.locator('[data-product-tour-tooltip]'))
  await finishDialog.getByRole('button', { name: 'Завершить', exact: true }).click()

  await expect(page).toHaveURL(/\/result\//, { timeout: 15_000 })
  const result = page.locator('[data-tour-id="result"]')
  await expect(result).toHaveClass(/product-tour-target/)
  await expectNoOverlap(result, page.locator('[data-product-tour-tooltip]'))
  await captureScreen(page, 'product-tour-result', 'desktop')
  await page.locator('.product-tour-tooltip').getByRole('button', { name: 'Готово' }).click()
  await expect(page.locator('[data-product-tour-tooltip]')).toHaveCount(0)
})
