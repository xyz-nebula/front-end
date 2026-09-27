import { mkdir } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

export { expect, test }

export const artifactsDir = 'artifacts/visual-smoke'

test.beforeAll(async () => {
  await mkdir(artifactsDir, { recursive: true })
})

export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
}

export async function expectNoDocumentVerticalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight))
    .toBe(true)
}

export async function captureScreenshot(page: Page, path: string, fullPage = false) {
  await page.screenshot({
    path,
    animations: 'disabled',
    fullPage,
  })
}

export async function dismissProductTourInvitation(page: Page) {
  const invitation = page.getByRole('dialog', { name: 'Познакомимся с Ареной?' })
  await page.locator('[data-tour-id="case-card"]').waitFor({ state: 'visible' })
  await expect(invitation).toBeVisible()
  await invitation.getByRole('button', { name: 'Позже' }).click()
}
