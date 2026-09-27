import { expect, test } from './helpers'

test('product tour machine only accepts valid persisted transitions', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { transitionProductTour } = await import('/src/features/product-tour/productTourMachine.ts')
    let state = transitionProductTour(null, { type: 'start' }, '2026-01-01T00:00:00.000Z')
    state = transitionProductTour(state, { type: 'role-selected', roleIndex: 1 }, '2026-01-01T00:00:01.000Z')
    const ignoredRole = state?.stepId
    state = transitionProductTour(state, { type: 'case-opened', caseId: 'case-b', caseIndex: 1 }, '2026-01-01T00:00:02.000Z')
    state = transitionProductTour(state, { type: 'role-selected', roleIndex: 1 }, '2026-01-01T00:00:03.000Z')
    state = transitionProductTour(state, { type: 'preparation-opened' }, '2026-01-01T00:00:04.000Z')
    state = transitionProductTour(state, { type: 'next' }, '2026-01-01T00:00:05.000Z')
    state = transitionProductTour(state, { type: 'back' }, '2026-01-01T00:00:06.000Z')
    state = transitionProductTour(state, { type: 'session-created', sessionId: 'session-1', userMessages: 0, aiMessages: 0 }, '2026-01-01T00:00:07.000Z')
    state = transitionProductTour(state, { type: 'audio-connected', userMessages: 1, aiMessages: 0 }, '2026-01-01T00:00:08.000Z')
    state = transitionProductTour(state, { type: 'finish-opened' }, '2026-01-01T00:00:09.000Z')
    state = transitionProductTour(state, { type: 'finish-cancelled' }, '2026-01-01T00:00:10.000Z')
    state = transitionProductTour(state, { type: 'pause' }, '2026-01-01T00:00:11.000Z')
    return { ignoredRole, state }
  })

  expect(result.ignoredRole).toBe('case')
  expect(result.state).toMatchObject({
    status: 'paused',
    stepId: 'finish',
    caseId: 'case-b',
    caseIndex: 1,
    roleIndex: 1,
    sessionId: 'session-1',
  })
})

test('product tour invitation supports later and manual start', async ({ page }) => {
  test.skip(process.env.VITE_AUTH_SOURCE !== 'mock', 'Requires mock auth.')
  await page.goto('/register')
  await page.getByLabel('Имя', { exact: true }).fill('Тур')
  await page.getByLabel('Фамилия').fill('Тест')
  await page.getByLabel('Email').fill('tour.invitation@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await page.getByRole('link', { name: 'Открыть demo-ссылку активации' }).click()
  await page.getByRole('link', { name: 'Перейти в приложение' }).click()

  const invitation = page.getByRole('dialog', { name: 'Познакомимся с Ареной?' })
  await expect(invitation).toBeVisible()
  await expect(invitation.getByRole('button', { name: 'Начать тур' })).toBeFocused()
  await expect(page.locator('#root')).toHaveJSProperty('inert', true)
  await page.keyboard.press('Escape')
  await expect(invitation).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Меню профиля' })).toBeFocused()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Кейсы' })).toBeVisible()
  await expect(invitation).toHaveCount(0)
  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await page.getByRole('button', { name: 'Пройти тур' }).click()
  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await expect(page.getByRole('button', { name: 'Продолжить тур' })).toBeVisible()
})
