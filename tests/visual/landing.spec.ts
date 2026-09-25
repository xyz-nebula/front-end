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
  'Он не обязан с тобой соглашаться',
  'Одна Арена — разные задачи команды',
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

const aiOpponentTraits = [
  'Отстаивает интересы',
  'Соблюдает границы',
  'Помнит уступки',
  'Ищет обмен',
]

const aiOpponentViewports = [
  { width: 1440, height: 1000, screenshot: 'landing-ai-opponent-desktop.png' },
  { width: 768, height: 900, screenshot: 'landing-ai-opponent-tablet.png' },
  { width: 390, height: 844, screenshot: 'landing-ai-opponent-mobile.png' },
  { width: 360, height: 800, screenshot: 'landing-ai-opponent-mobile-narrow.png' },
]

const teamsViewports = [
  { width: 1440, height: 1000, screenshot: 'landing-teams-desktop.png' },
  { width: 768, height: 900, screenshot: 'landing-teams-tablet.png' },
  { width: 390, height: 844, screenshot: 'landing-teams-mobile.png' },
  { width: 360, height: 800, screenshot: 'landing-teams-mobile-narrow.png' },
  { width: 320, height: 800, screenshot: 'landing-teams-mobile-compact.png' },
]

test('landing renders the redesigned hero, problem section and section framework', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Тренируй переговоры как стратегическую игру' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Начать поединок' })).toHaveAttribute('href', '/home')
  await expect(page.locator('.arena-header').getByRole('link', { name: 'Начать', exact: true })).toHaveAttribute('href', '/home')
  await expect(page.getByRole('link', { name: 'Начать первый поединок' })).toHaveAttribute('href', '/home')
  await expect(page.getByRole('link', { name: 'Посмотреть кейсы' })).toHaveCount(0)
  await expect(page.locator('.arena-header')).toHaveAttribute('data-state', 'transparent')
  await expect(page.locator('.arena-scene-card')).toHaveCount(0)
  await expect(page.locator('.arena-placeholder')).toHaveCount(0)
  for (const heading of sectionHeadings) {
    await expect(page.getByRole('heading', { level: 2, name: heading })).toBeAttached()
  }
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-desktop.png`)

  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.locator('#problem').evaluate((element) => {
    window.scrollTo(0, (element as HTMLElement).offsetTop)
  })
  await expect(page.locator('.arena-header')).toHaveAttribute('data-state', 'compact')
  await expect(page.getByRole('link', { name: 'Зачем', exact: true })).toHaveAttribute('aria-current', 'location')
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
  await captureScreenshot(page, `${artifactsDir}/landing-header-scrolled-desktop.png`)

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

  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/')
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/landing-mobile-compact.png`)
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
    await images.last().scrollIntoViewIfNeeded()
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

test('AI opponent shows both positions and negotiation principles responsively', async ({ page }) => {
  test.setTimeout(45_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const viewport of aiOpponentViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')

    const section = page.locator('#ai-opponent')
    await expect(section).toHaveAttribute('aria-labelledby', 'ai-opponent-title')
    await expect(section.getByRole('heading', { level: 2, name: 'Он не обязан с тобой соглашаться' })).toBeVisible()
    await expect(section.getByRole('heading', { level: 3, name: 'Ваша позиция' })).toBeVisible()
    await expect(section.getByRole('heading', { level: 3, name: 'Позиция AI-оппонента' })).toBeVisible()

    for (const trait of aiOpponentTraits) {
      await expect(section.getByRole('heading', { level: 3, name: trait })).toBeVisible()
    }

    await expect(section.locator('.arena-placeholder__card')).toHaveCount(0)
    const sceneImage = section.locator('.arena-opponent__scene img')
    await sceneImage.scrollIntoViewIfNeeded()
    await expect(sceneImage).toHaveJSProperty('complete', true)
    await expectNoHorizontalOverflow(page)
    await section.screenshot({
      path: `${artifactsDir}/${viewport.screenshot}`,
      animations: 'disabled',
    })
  }
})

test('teams section presents all audiences and the final calls to action responsively', async ({ page }) => {
  test.setTimeout(45_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const viewport of teamsViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')

    const section = page.locator('#teams')
    await expect(section).toHaveAttribute('aria-labelledby', 'teams-title')
    await expect(section.getByRole('heading', { level: 2, name: 'Одна Арена — разные задачи команды' })).toBeVisible()
    await expect(section.getByRole('heading', { level: 2, name: 'Следующие важные переговоры не должны быть первой попыткой' })).toBeVisible()
    await expect(section.getByRole('heading', { level: 3, name: 'Больше практики' })).toBeVisible()
    await expect(section.getByRole('heading', { level: 3, name: viewport.width > 980 ? 'Свои ситуации и правила' : 'Свои ситуации' })).toBeVisible()
    await expect(section.getByRole('heading', { level: 3, name: 'Единый формат развития' })).toBeVisible()

    await expect(section.getByRole('link', { name: 'Начать первый поединок' })).toHaveAttribute('href', '/home')
    await expect(section.getByRole('link', { name: 'Посмотреть кейсы' })).toHaveCount(0)
    await expect(section.locator('.arena-placeholder__card')).toHaveCount(0)

    const images = section.locator('img')
    await expect(images).toHaveCount(3)
    await section.locator('.arena-teams-cta').scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        images.evaluateAll((elements) =>
          elements.every((element) => {
            const image = element as HTMLImageElement
            return getComputedStyle(image).display === 'none'
              || (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)
          }),
        ),
      )
      .toBe(true)

    const trainerCard = section.locator('.arena-team-card--trainer')
    const preview = trainerCard.locator('.arena-case-preview')
    await expect(trainerCard.locator('img')).toHaveCount(0)
    await expect(preview).toBeVisible()
    await expect(preview).toHaveAttribute('aria-hidden', 'true')
    await expect(preview.getByText('Настройка кейса', { exact: true })).toBeVisible()
    await expect(preview.locator('.arena-case-preview__label')).toHaveText(['Сфера', 'Сложность', 'Роль AI', 'Тон'])
    await expect(preview.locator('.arena-case-preview__value')).toHaveText(['Работа и карьера', 'Средняя', 'Руководитель', 'Требовательный'])

    const geometry = await preview.evaluate((element) => {
      const card = element.closest('.arena-team-card')!
      const copyElements = card.querySelectorAll('.arena-team-card__copy, .arena-team-card__label, .arena-team-card__copy h3, .arena-team-card__description')
      const panel = element.getBoundingClientRect()
      const bounds = card.getBoundingClientRect()
      const textElements = element.querySelectorAll('.arena-case-preview__title, .arena-case-preview__label, .arena-case-preview__value')
      return {
        insideCard: panel.left >= bounds.left && panel.right <= bounds.right && panel.top >= bounds.top && panel.bottom <= bounds.bottom,
        separateFromCopy: Array.from(copyElements).every((element) => {
          const copy = element.getBoundingClientRect()
          return panel.top >= copy.bottom || panel.left >= copy.right
        }),
        textFits: Array.from(textElements).every((text) => {
          const range = document.createRange()
          range.selectNodeContents(text)
          const textBounds = range.getBoundingClientRect()
          const available = text.getBoundingClientRect()
          return textBounds.left >= available.left - 1 && textBounds.right <= available.right + 1
            && textBounds.top >= panel.top && textBounds.bottom <= panel.bottom
        }),
      }
    })
    expect(geometry, `${viewport.width}px: preview containment, overlap and text clipping`).toEqual({
      insideCard: true,
      separateFromCopy: true,
      textFits: true,
    })

    const ctaScene = section.locator('.arena-teams-cta__scene')
    if (viewport.width > 980) {
      await expect(ctaScene).toBeVisible()
    } else {
      await expect(ctaScene).toBeHidden()
    }

    await expectNoHorizontalOverflow(page)
    await section.screenshot({
      path: `${artifactsDir}/${viewport.screenshot}`,
      animations: 'disabled',
    })
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
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await expect(page.getByRole('navigation', { name: 'Навигация по лендингу' })).toBeVisible()
  const problemLink = page.getByRole('link', { name: 'Зачем', exact: true })
  await expect(problemLink).toHaveAttribute('href', '#problem')
  await expect(problemLink).toBeFocused()
  await expect(page.getByRole('link', { name: 'Как это работает' })).toHaveAttribute('href', '#how-it-works')
  await expect(page.getByRole('link', { name: 'AI-оппонент' })).toHaveAttribute('href', '#ai-opponent')
  await expect(page.getByRole('link', { name: 'Для команд' })).toHaveAttribute('href', '#teams')
  await captureScreenshot(page, `${artifactsDir}/landing-mobile-menu.png`)

  await problemLink.click()
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(menuButton).toBeFocused()
  await expect(page.locator('#problem')).toBeInViewport()

  await menuButton.click()
  await page.keyboard.press('Escape')
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(menuButton).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')

  await menuButton.click()
  await page.locator('#problem').click({ position: { x: 8, y: 120 } })
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(menuButton).toBeFocused()

  await menuButton.click()
  await page.setViewportSize({ width: 900, height: 844 })
  await expect(page.getByRole('navigation', { name: 'Навигация по лендингу' })).toBeVisible()
  await expect(menuButton).toBeHidden()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
})

test('product home keeps its own styles after landing navigation', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Имя', { exact: true }).fill('Ирина')
  await page.getByLabel('Фамилия').fill('Петрова')
  await page.getByLabel('Имя пользователя').fill('landing.user')
  await page.getByLabel('Email').fill('landing@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await page.getByRole('link', { name: 'Открыть demo-ссылку активации' }).click()
  await page.getByRole('link', { name: 'Перейти в приложение' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('link', { name: 'Начать поединок' }).click()

  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('heading', { level: 1, name: /Добро пожаловать/ })).toBeVisible()
  await expect(page.locator('.arena-landing')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/home-mobile-regression.png`)
})

test('header navigation follows every landing section and guest CTA opens login', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const links = [
    { name: 'Зачем', href: '#problem' },
    { name: 'Как это работает', href: '#how-it-works' },
    { name: 'AI-оппонент', href: '#ai-opponent' },
    { name: 'Для команд', href: '#teams' },
  ]

  for (const link of links) {
    const navigationLink = page.getByRole('link', { name: link.name, exact: true })
    await expect(navigationLink).toHaveAttribute('href', link.href)
    await navigationLink.click()
    await expect(page.locator(link.href)).toBeInViewport()
    await expect(navigationLink).toHaveAttribute('aria-current', 'location')
    await expect(page.locator('.arena-header')).toHaveAttribute('data-state', 'compact')
    await expectNoHorizontalOverflow(page)
  }

  await page.locator('.arena-header').getByRole('link', { name: 'Начать', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
})
