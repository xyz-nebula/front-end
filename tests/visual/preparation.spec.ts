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
  await expect(page).toHaveURL(/\/cases\/salary-review\/preparation\?role=0&mode=text&section=analysis$/)
}

test('preparation draft, progress and responsive layout', async ({ page }) => {
  test.skip(process.env.VITE_AUTH_SOURCE !== 'mock', 'Requires mock auth.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await registerAndOpenPreparation(page)
  await expect(page.getByRole('heading', { name: 'Подготовка к переговорам' })).toBeVisible()
  await expect(page.getByText('Заполнено 0 из 10')).toBeVisible()
  await expect(page).toHaveURL(/section=analysis/)
  const rootConflictCard = page.locator('#preparation-root-conflict')
  await expect(rootConflictCard.getByText('Корневой конфликт', { exact: true })).toHaveCount(1)
  const rootHelp = rootConflictCard.getByRole('button', { name: 'Подсказка: Корневой конфликт' })
  await rootHelp.hover()
  await expect(rootConflictCard.getByRole('tooltip')).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: 'Условие кейса' }).click()
  const caseDrawer = page.getByRole('dialog', { name: 'Повышение зарплаты' })
  await expect(caseDrawer).toContainText('Вы считаете, что ваши результаты')
  await expect(caseDrawer).toContainText('Ваша роль')
  await expect(caseDrawer).toContainText('Сотрудник')
  await expect(caseDrawer).toContainText('AI-оппонент')
  await captureScreenshot(page, `${artifactsDir}/preparation-case-drawer-desktop.png`)
  await page.keyboard.press('Escape')
  await expect(caseDrawer).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Условие кейса' })).toBeFocused()
  await page.getByRole('button', { name: 'Условие кейса' }).click()
  await page.locator('.preparation-case-backdrop').click({ position: { x: 10, y: 10 } })
  await expect(caseDrawer).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Корневой конфликт', exact: true }).fill('Стороны по-разному оценивают вклад сотрудника и бюджетные ограничения.')
  await page.getByRole('textbox', { name: 'Экономический слой', exact: true }).fill('Сотруднику важно повышение, руководителю — сохранить бюджет.')
  await captureScreenshot(page, `${artifactsDir}/preparation-analysis-desktop.png`, true)
  await page.locator('.preparation-sidebar').getByRole('button', { name: /Стратегия/ }).click()
  await expect(page).toHaveURL(/section=strategy/)
  await expect(page.getByRole('textbox', { name: 'Корневой конфликт', exact: true })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Красная черта', exact: true }).fill('Зафиксированный срок повторного пересмотра.')
  await expect(page.getByText('Заполнено 3 из 10')).toBeVisible()
  await expect(page.locator('.preparation-sidebar').getByRole('button', { name: /Стратегия 1 из 4/ })).toBeVisible()
  await expect(page.getByRole('status')).toContainText(/Сохранено/)
  await captureScreenshot(page, `${artifactsDir}/preparation-strategy-desktop.png`, true)
  await page.getByRole('button', { name: /Далее/ }).click()
  await expect(page).toHaveURL(/section=tactics/)
  await expect(page.getByRole('button', { name: /Начать поединок/ })).toHaveCount(2)
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/preparation-tactics-desktop.png`, true)

  await page.reload()
  await expect(page).toHaveURL(/section=tactics/)
  await page.getByRole('button', { name: /Назад/ }).click()
  await page.getByRole('button', { name: /Назад/ }).click()
  await expect(page.getByRole('textbox', { name: 'Корневой конфликт', exact: true })).toHaveValue(/Стороны по-разному/)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(page.locator('.preparation-mobile-nav')).toBeVisible()
  await expect(page.locator('.preparation-bottom')).toBeVisible()
  await rootHelp.click()
  await expect(rootHelp).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(rootHelp).toHaveAttribute('aria-expanded', 'false')
  await page.evaluate(() => window.scrollTo(0, 0))
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/preparation-mobile.png`)
  await page.getByRole('button', { name: 'Условие кейса' }).click()
  await expect(caseDrawer).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/preparation-case-drawer-mobile.png`)
  await page.getByRole('button', { name: 'Закрыть условие кейса' }).click()
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
  expect(result.filled.indexOf('### Экономический слой')).toBeLessThan(result.filled.indexOf('# Стратегия'))
  expect(result.filled).toContain('### Красная черта')
  expect(result.filled).not.toMatch(/^## [^#]/m)
})

test('preparation drafts and snapshots are isolated by auth-session owner', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const storage = await import('/src/features/preparation/preparation.ts')
    const draft = storage.createEmptyPreparation()
    draft.rootConflict = 'Секрет владельца A'
    const snapshot = {
      caseId: 'shared-case',
      caseTitle: 'Общий кейс',
      userRole: 'Роль A',
      opponentRole: 'Роль B',
      selectedRole: 0 as const,
      draft,
    }
    const legacyKey = 'arena.preparation-draft.v1.shared-case.0'
    localStorage.setItem(legacyKey, JSON.stringify(draft))

    storage.savePreparationDraft('owner-a', 'shared-case', 0, draft)
    storage.saveSessionPreparation('owner-a', 'shared-session', snapshot)
    const persistent = {
      ownerA: storage.readPreparationDraft('owner-a', 'shared-case', 0).rootConflict,
      ownerB: storage.readPreparationDraft('owner-b', 'shared-case', 0).rootConflict,
      snapshotA: storage.readSessionPreparation('owner-a', 'shared-session')?.userRole ?? null,
      snapshotB: storage.readSessionPreparation('owner-b', 'shared-session'),
      legacyStillPresent: localStorage.getItem(legacyKey) !== null,
    }

    const storagePrototype = Object.getPrototypeOf(localStorage) as Storage
    const originalGetItem = storagePrototype.getItem
    const originalSetItem = storagePrototype.setItem
    storagePrototype.getItem = () => { throw new DOMException('blocked') }
    storagePrototype.setItem = () => { throw new DOMException('blocked') }
    try {
      const memoryDraft = storage.createEmptyPreparation()
      memoryDraft.rootConflict = 'Memory secret A'
      storage.savePreparationDraft('memory-owner-a', 'shared-case', 0, memoryDraft)
      storage.saveSessionPreparation('memory-owner-a', 'shared-session', { ...snapshot, draft: memoryDraft })
      return {
        persistent,
        memory: {
          ownerA: storage.readPreparationDraft('memory-owner-a', 'shared-case', 0).rootConflict,
          ownerB: storage.readPreparationDraft('memory-owner-b', 'shared-case', 0).rootConflict,
          snapshotA: storage.readSessionPreparation('memory-owner-a', 'shared-session')?.draft.rootConflict ?? null,
          snapshotB: storage.readSessionPreparation('memory-owner-b', 'shared-session'),
        },
      }
    } finally {
      storagePrototype.getItem = originalGetItem
      storagePrototype.setItem = originalSetItem
    }
  })

  expect(result.persistent).toEqual({
    ownerA: 'Секрет владельца A',
    ownerB: '',
    snapshotA: 'Роль A',
    snapshotB: null,
    legacyStillPresent: true,
  })
  expect(result.memory).toEqual({
    ownerA: 'Memory secret A',
    ownerB: '',
    snapshotA: 'Memory secret A',
    snapshotB: null,
  })
})
