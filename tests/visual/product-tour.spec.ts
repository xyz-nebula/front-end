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

async function openRoleSelection(page: Page, seed: string) {
  await seedProductTourUser(page, seed)
  await page.goto('/home')
  await page.getByRole('button', { name: 'Начать тур' }).click()
  const caseCard = page.locator('[data-tour-id="case-card"]')
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
    if (width === 390) await captureScreen(page, 'product-tour-role', 'mobile')
  }
})

test('mobile product tour can be completed through primary controls', async ({ page }) => {
  test.setTimeout(70_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await openRoleSelection(page, 'complete-mobile')

  const roleSelector = page.locator('[data-tour-id="role-selector"]')
  await expectTargetAbovePanel(page, roleSelector)
  await roleSelector.getByRole('radio').first().check()

  const preparationButton = page.getByRole('button', { name: 'Начать подготовку' })
  await expectTargetAbovePanel(page, page.locator('[data-tour-id="voice-preparation"]'))
  await preparationButton.click()
  await expect(page).toHaveURL(/\/preparation\?.*section=analysis/)

  for (const title of ['Разбери ситуацию', 'Собери стратегию', 'Продумай тактику']) {
    await expect(page.locator('.product-tour-tooltip h2')).toHaveText(title)
    await page.locator('.product-tour-tooltip').getByRole('button', { name: 'Далее' }).click()
  }

  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Выходи на поединок')
  const startDuel = page.locator('[data-tour-id="start-duel"]')
  await expectTargetAbovePanel(page, startDuel)
  await startDuel.click()

  await expect(page).toHaveURL(/\/arena\//)
  const microphone = page.locator('[data-tour-id="microphone"]')
  await expectTargetAbovePanel(page, microphone)
  await captureScreen(page, 'product-tour-microphone', 'mobile')
  await microphone.click()

  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Ты управляешь длительностью', { timeout: 25_000 })
  const finish = page.locator('[data-tour-id="finish"]')
  await expectTargetAbovePanel(page, finish)
  await finish.click()

  const finishDialog = page.locator('[data-tour-id="finish-dialog"]')
  await expectTargetAbovePanel(page, finishDialog)
  await finishDialog.getByRole('button', { name: 'Завершить', exact: true }).click()

  await expect(page).toHaveURL(/\/result\//, { timeout: 15_000 })
  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Разбор готов', { timeout: 15_000 })
  await expectTargetAbovePanel(page, page.locator('[data-tour-id="result"]'))
  await page.locator('.product-tour-tooltip').getByRole('button', { name: 'Готово' }).click()
  await expect(page.locator('[data-product-tour-tooltip]')).toHaveCount(0)
})
