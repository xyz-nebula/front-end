import {
  artifactsDir,
  captureScreenshot,
  expect,
  expectNoHorizontalOverflow,
  test,
} from './helpers'

const sectionHeadings = [
  'Переговоры — навык, который нельзя натренировать только по книге',
  'От кейса до новой стратегии — за один цикл',
  'AI-оппонент, который действительно ведёт переговоры',
  'Глубокая подготовка + AI-тренер',
  'Независимое судейство и персональный разбор',
  'Реальные кейсы и разные переговорные ситуации',
  'Методология и развитие навыка',
  'Для команд и компаний + финальный CTA',
]

const howItWorksSteps = [
  'Выбери кейс и роль',
  'Подготовь стратегию',
  'Проведи поединок',
  'Получи разбор',
]

const howItWorksViewports = [
  { width: 1440, height: 1000, screenshot: 'landing-how-it-works-desktop.png' },
  { width: 1220, height: 1000 },
  { width: 981, height: 1000 },
  { width: 980, height: 1000 },
  { width: 768, height: 900, screenshot: 'landing-how-it-works-tablet.png' },
  { width: 390, height: 844, screenshot: 'landing-how-it-works-mobile.png' },
  { width: 360, height: 800, screenshot: 'landing-how-it-works-mobile-narrow.png' },
]

test('landing renders the redesigned hero, problem section and section framework', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Тренируй переговоры как стратегическую игру' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Начать поединок' })).toHaveAttribute('href', '/home')
  await expect(page.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/home')
  await expect(page.locator('.arena-scene-card')).toHaveCount(0)
  for (const heading of sectionHeadings) {
    await expect(page.getByRole('heading', { level: 2, name: heading })).toBeAttached()
  }
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-desktop.png`)

  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.locator('#problem').evaluate((element) => {
    window.scrollTo(0, (element as HTMLElement).offsetTop)
  })
  await expect(page.getByRole('heading', { level: 2, name: sectionHeadings[0] })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Мало практики' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Ошибки имеют последствия' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Нет цикла повторения' })).toBeVisible()
  const practiceCycle = page.getByRole('list', { name: 'Цикл развития навыка переговоров' })
  for (const step of ['Попытка', 'Обратная связь', 'Изменение стратегии', 'Повтор']) {
    await expect(practiceCycle.getByText(step, { exact: true })).toBeVisible()
  }
  await expect(page.locator('#problem .arena-placeholder__card')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-problem-desktop.png`)

  await page.locator('#how-it-works').evaluate((element) => {
    window.scrollTo(0, (element as HTMLElement).offsetTop)
  })
  await expect(page.locator('section#how-it-works')).toHaveAttribute('aria-labelledby', 'how-it-works-title')
  const howItWorksList = page.getByRole('list', { name: 'Четыре этапа тренировки на Арене' })
  for (const step of howItWorksSteps) {
    await expect(howItWorksList.getByRole('heading', { level: 3, name: step })).toBeVisible()
  }
  await expect(page.locator('#how-it-works .arena-placeholder__card')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await page.locator('#how-it-works').screenshot({
    path: `${artifactsDir}/landing-how-it-works-desktop.png`,
    animations: 'disabled',
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Тренируй переговоры как стратегическую игру' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-mobile.png`)

  await page.locator('#problem').evaluate((element) => {
    window.scrollTo(0, (element as HTMLElement).offsetTop)
  })
  await expect(page.getByRole('heading', { level: 2, name: sectionHeadings[0] })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-problem-mobile.png`)

  await page.locator('.arena-problem__conclusion').evaluate((element) => {
    window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 28)
  })
  await expect(practiceCycle.getByText('Повтор', { exact: true })).toBeVisible()
  await captureScreenshot(page, `${artifactsDir}/landing-problem-mobile-cycle.png`)

  await page.locator('#how-it-works').evaluate((element) => {
    window.scrollTo(0, (element as HTMLElement).offsetTop)
  })
  await expect(page.getByRole('heading', { level: 2, name: sectionHeadings[1] })).toBeVisible()
  for (const step of howItWorksSteps) {
    await expect(howItWorksList.getByRole('heading', { level: 3, name: step })).toBeAttached()
  }
  await expectNoHorizontalOverflow(page)
  await page.locator('#how-it-works').screenshot({
    path: `${artifactsDir}/landing-how-it-works-mobile.png`,
    animations: 'disabled',
  })

  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-mobile-narrow.png`)

  await page.locator('#problem').evaluate((element) => {
    window.scrollTo(0, (element as HTMLElement).offsetTop)
  })
  await expect(page.getByRole('heading', { level: 2, name: sectionHeadings[0] })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-problem-mobile-narrow.png`)

  await page.locator('#how-it-works').evaluate((element) => {
    window.scrollTo(0, (element as HTMLElement).offsetTop)
  })
  await expect(page.getByRole('heading', { level: 2, name: sectionHeadings[1] })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.locator('#how-it-works').screenshot({
    path: `${artifactsDir}/landing-how-it-works-mobile-narrow.png`,
    animations: 'disabled',
  })
})

test('how it works keeps every illustration inside its visual area', async ({ page }) => {
  test.setTimeout(45_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const viewport of howItWorksViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')

    const section = page.locator('#how-it-works')
    const images = section.locator('.arena-how-step__image')
    await expect(images).toHaveCount(howItWorksSteps.length)
    await expect
      .poll(() =>
        images.evaluateAll((elements) =>
          elements.every((element) => {
            const image = element as HTMLImageElement
            return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
          }),
        ),
      )
      .toBe(true)

    const imageBounds = await images.evaluateAll((elements) =>
      elements.map((element) => {
        const image = element as HTMLImageElement
        const visual = image.closest('.arena-how-step__visual')

        if (!(visual instanceof HTMLElement)) {
          throw new Error('How-it-works image is missing its visual container')
        }

        const imageRect = image.getBoundingClientRect()
        const visualRect = visual.getBoundingClientRect()

        return {
          imageLeft: imageRect.left,
          imageTop: imageRect.top,
          imageRight: imageRect.right,
          imageBottom: imageRect.bottom,
          visualLeft: visualRect.left,
          visualTop: visualRect.top,
          visualRight: visualRect.right,
          visualBottom: visualRect.bottom,
        }
      }),
    )

    for (const [index, bounds] of imageBounds.entries()) {
      const label = `${viewport.width}px, ${howItWorksSteps[index]}`
      expect(bounds.imageLeft, `${label}: left edge`).toBeGreaterThanOrEqual(bounds.visualLeft - 1)
      expect(bounds.imageTop, `${label}: top edge`).toBeGreaterThanOrEqual(bounds.visualTop - 1)
      expect(bounds.imageRight, `${label}: right edge`).toBeLessThanOrEqual(bounds.visualRight + 1)
      expect(bounds.imageBottom, `${label}: bottom edge`).toBeLessThanOrEqual(bounds.visualBottom + 1)
    }

    await expectNoHorizontalOverflow(page)

    if (viewport.screenshot) {
      await section.screenshot({
        path: `${artifactsDir}/${viewport.screenshot}`,
        animations: 'disabled',
      })
    }
  }
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
