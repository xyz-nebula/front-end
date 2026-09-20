import {
  artifactsDir,
  captureScreenshot,
  expect,
  expectNoHorizontalOverflow,
  test,
} from './helpers'

test('landing renders on desktop and mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-desktop.png`)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-mobile.png`)
})
