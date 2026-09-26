import { artifactsDir, captureScreenshot, expect, expectNoHorizontalOverflow, test } from './helpers'

async function registerAndOpenPreparation(page: import('@playwright/test').Page) {
  await page.goto('/register')
  await page.getByLabel('Имя', { exact: true }).fill('Анна')
  await page.getByLabel('Фамилия').fill('Тестовая')
  await page.getByLabel('Email').fill('preparation.visual@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await page.getByRole('link', { name: 'Открыть demo-ссылку активации' }).click()
  await page.getByRole('link', { name: 'Перейти в приложение' }).click()
  await page.getByRole('button', { name: 'Выбрать кейс «Повышение зарплаты»' }).click()
  const dialog = page.getByRole('dialog', { name: 'Повышение зарплаты' })
  await dialog.getByRole('radio', { name: /Сотрудник/ }).check()
  await dialog.getByRole('button', { name: 'Начать подготовку' }).click()
  await expect(page).toHaveURL(/\/cases\/salary-review\/preparation\?role=0&mode=text$/)
}

test('preparation draft, progress and responsive layout', async ({ page }) => {
  test.skip(process.env.VITE_AUTH_SOURCE !== 'mock', 'Requires mock auth.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await registerAndOpenPreparation(page)
  await expect(page.getByRole('heading', { name: 'Подготовка к переговорам' })).toBeVisible()
  await expect(page.getByText('Заполнено 0 из 10')).toBeVisible()
  await page.getByRole('textbox', { name: 'Корневой конфликт', exact: true }).fill('Стороны по-разному оценивают вклад сотрудника и бюджетные ограничения.')
  await page.getByRole('textbox', { name: 'Экономический слой', exact: true }).fill('Сотруднику важно повышение, руководителю — сохранить бюджет.')
  await page.getByRole('textbox', { name: 'Красная черта', exact: true }).fill('Зафиксированный срок повторного пересмотра.')
  await expect(page.getByText('Заполнено 3 из 10')).toBeVisible()
  await expect(page.getByRole('status')).toContainText(/Сохранено/)
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/preparation-desktop.png`, true)

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Корневой конфликт', exact: true })).toHaveValue(/Стороны по-разному/)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.preparation-mobile-nav')).toBeVisible()
  await expect(page.locator('.preparation-bottom')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/preparation-mobile.png`)
})

test('preparation serializer uses level-three field headings only', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { createEmptyPreparation, serializePreparation } = await import('/src/features/preparation/preparation.ts')
    const empty = serializePreparation(createEmptyPreparation())
    const draft = createEmptyPreparation()
    draft.rootConflict = '  Конфликт\nпо срокам  '
    draft.layers.economic = 'Финансовые ограничения'
    draft.bargaining.redLine = 'Не позднее пятницы'
    const filled = serializePreparation(draft)
    return { empty, filled }
  })
  expect(result.empty).toBe('# Подготовка\n\nПользователь не заполнял карточку подготовки.')
  expect(result.filled).toContain('# Анализ ситуации\n\n### Корневой конфликт\nКонфликт\nпо срокам')
  expect(result.filled).toContain('### Экономический слой')
  expect(result.filled).toContain('### Красная черта')
  expect(result.filled).not.toMatch(/^## [^#]/m)
})
