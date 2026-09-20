import {
  artifactsDir,
  captureScreenshot,
  expect,
  expectNoHorizontalOverflow,
  test,
} from './helpers'

const sectionHeadings = [
  'Проблема — почему обычной практики недостаточно',
  'Как работает Арена — 4 этапа',
  'AI-оппонент, который действительно ведёт переговоры',
  'Глубокая подготовка + AI-тренер',
  'Независимое судейство и персональный разбор',
  'Реальные кейсы и разные переговорные ситуации',
  'Методология и развитие навыка',
  'Для команд и компаний + финальный CTA',
]

test('landing renders the redesigned hero and section framework', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Тренируй переговоры как стратегическую игру' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Начать поединок' })).toHaveAttribute('href', '/home')
  await expect(page.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/home')
  for (const heading of sectionHeadings) {
    await expect(page.getByRole('heading', { level: 2, name: heading })).toBeAttached()
  }
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-desktop.png`)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Тренируй переговоры как стратегическую игру' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-mobile.png`)

  await page.locator('#problem').scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { level: 2, name: sectionHeadings[0] })).toBeVisible()
  await captureScreenshot(page, `${artifactsDir}/landing-section-placeholder.png`)
})

test('mobile navigation opens and closes accessibly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const menuButton = page.getByRole('button', { name: 'Открыть меню' })
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await menuButton.click()
  await expect(page.getByRole('button', { name: 'Закрыть меню' })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Кейсы' })).toHaveAttribute('href', '#cases')
  await expect(page.getByRole('link', { name: 'Как это работает' })).toHaveAttribute('href', '#how-it-works')
  await expect(page.getByRole('link', { name: 'Методика' })).toHaveAttribute('href', '#methodology')
  await captureScreenshot(page, `${artifactsDir}/landing-mobile-menu.png`)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Открыть меню' })).toHaveAttribute('aria-expanded', 'false')
})

test('product home remains separate from the landing redesign', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/home')

  await expect(page.getByRole('heading', { level: 1, name: /Какой разговор/ })).toBeVisible()
  await expect(page.locator('.arena-landing')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/home-mobile-regression.png`)
})
