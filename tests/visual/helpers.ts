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

export async function captureScreenshot(page: Page, path: string) {
  await page.screenshot({
    path,
    animations: 'disabled',
  })
}
