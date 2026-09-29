import { expect, test } from '@playwright/test'

import {
  captureScreen,
  ensureArtifactsDirectory,
  seedActiveVoiceArena,
  seedProtectedScreens,
  seedProductTourUser,
} from './helpers'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

test.beforeAll(async () => {
  await ensureArtifactsDirectory()
})

for (const viewport of viewports) {
  test(`${viewport.name} routes render their primary UI`, async ({ page }) => {
    test.setTimeout(45_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: viewport.width, height: viewport.height })

    await page.goto('/')
    await expect(page.locator('#arena-hero-title')).toBeVisible()
    await captureScreen(page, 'landing', viewport.name)

    await page.goto('/login')
    await expect(page.locator('#login-title')).toBeVisible()
    await expect(page.getByText('Забыли пароль?', { exact: true })).toHaveCount(0)
    await expect(page.locator('.login-form__totp-toggle')).toHaveCount(0)
    await expect(page.locator('#login-totp-token')).toHaveCount(0)
    await captureScreen(page, 'login', viewport.name)

    await page.goto('/register')
    await expect(page.locator('#register-title')).toBeVisible()
    await captureScreen(page, 'register', viewport.name)

    await page.goto('/activate')
    await expect(page.locator('#activation-title')).toBeVisible()
    await captureScreen(page, 'activation', viewport.name)

    await page.goto('/missing-smoke-route')
    await expect(page.locator('#not-found-title')).toBeVisible()
    await captureScreen(page, 'not-found', viewport.name)

    await page.goto('/auth')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.locator('#login-title')).toBeVisible()

    await page.goto('/home')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.locator('#login-title')).toBeVisible()

    const state = await seedProtectedScreens(page, viewport.name)

    await page.goto('/home')
    await expect(page.locator('#home-cases-title')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Продолжить подготовку' })).toBeVisible()
    await expect(page.locator('.arena-home__continue-head > span')).toContainText('Черновик')
    await expect(page.getByRole('meter', { name: 'Прогресс подготовки' })).toHaveAttribute('aria-valuenow', '30')
    await expect(page.getByText('Подготовка:', { exact: false })).toContainText('30%')
    await expect(page.getByRole('link', { name: 'Продолжить' })).toHaveAttribute('href', '/cases/salary-review/preparation?role=0&mode=voice&section=strategy')
    const caseCards = page.locator('.home-case-card')
    await expect(caseCards).toHaveCount(6)
    await expect(caseCards.first().locator('.home-case-card__description')).toHaveText('Вы считаете, что ваши результаты и выросшая ответственность заслуживают пересмотра зарплаты. Руководитель ценит ваш вклад, но бюджет команды ограничен и решение потребует убедительных аргументов.')
    await expect(caseCards.first().locator('.home-case-card__difficulty-bars i')).toHaveCount(4)
    await expect(caseCards.first().locator('.home-case-card__difficulty-bars i.is-active')).toHaveCount(2)
    await expect(caseCards.nth(1).locator('.home-case-card__difficulty-bars i.is-active')).toHaveCount(3)
    await expect(caseCards.nth(3).locator('.home-case-card__difficulty-bars i.is-active')).toHaveCount(1)
    await captureScreen(page, 'home', viewport.name)

    await caseCards.first().click()
    const modal = page.locator('.home-case-modal')
    await expect(modal.locator('.home-case-modal__intro')).toHaveText('Аргументируй свою ценность и договорись о новых условиях с руководителем.')
    await expect(modal.getByText('Аргументируй свою ценность и договорись о новых условиях с руководителем.', { exact: true })).toHaveCount(1)
    await expect(modal.getByRole('heading', { name: 'Ситуация' })).toHaveCount(0)
    await expect(modal.getByText('Формат тренировки', { exact: true })).toHaveCount(0)
    const roleCards = page.locator('.home-case-modal__role')
    await expect(roleCards).toHaveCount(2)
    await expect(roleCards.locator('img')).toHaveCount(0)
    await roleCards.first().scrollIntoViewIfNeeded()
    await captureScreen(page, 'role-selection-empty', viewport.name)

    await roleCards.first().getByRole('radio').check()
    await expect(roleCards.locator('img')).toHaveCount(2)
    await expect(roleCards.first().locator('img')).toHaveAttribute('src', /profile\.webp$/)
    await expect(roleCards.nth(1).locator('img')).toHaveAttribute('src', /opponent\.webp$/)
    await captureScreen(page, 'role-selection-selected', viewport.name)

    await modal.getByRole('button', { name: 'Начать подготовку' }).click()
    await expect(page).toHaveURL(/\/cases\/salary-review\/preparation\?role=0&mode=voice&section=analysis$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Подготовка к переговорам' })).toBeVisible()
    await captureScreen(page, 'preparation', viewport.name)

    await page.goto(`/arena/${state.activeSessionId}`)
    await expect(page.locator('.duel-heading h1')).toBeVisible()
    await expect(page.getByLabel('Оставшееся время')).toHaveText('15:00')
    await expect(page.getByText('Таймер начнётся после первой реплики')).toBeVisible()
    await expect(page.getByLabel('Ваша реплика')).toBeVisible()
    await captureScreen(page, 'arena', viewport.name)

    await page.getByLabel('Ваша реплика').fill('Проверяем аватары участников.')
    await page.getByLabel('Отправить сообщение').click()
    const messages = page.locator('.arena-message')
    await expect(messages).toHaveCount(2)
    await expect(messages.filter({ has: page.locator('.arena-message__avatar[src$="profile.webp"]') })).toHaveCount(1)
    await expect(messages.filter({ has: page.locator('.arena-message__avatar[src$="opponent.webp"]') })).toHaveCount(1)

    await page.goto(`/result/${state.finishedSessionId}`)
    await expect(page.locator('.result-intro h1')).toHaveText('Разбор поединка')
    await captureScreen(page, 'result', viewport.name)
  })
}

test('home hides preparation progress before a training is started', async ({ page }) => {
  await seedProductTourUser(page, 'home-without-session')
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Начать тренировку' })).toBeVisible()
  await expect(page.locator('.arena-home__preparation')).toHaveCount(0)
})

test('an active session does not replace the start card when there is no recent preparation', async ({ page }) => {
  const state = await seedProtectedScreens(page, 'home-without-recent-preparation')
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('arena.recent-preparation.v1.')) localStorage.removeItem(key)
    }
  })
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Начать тренировку' })).toBeVisible()
  await expect(page.locator('.arena-home__preparation')).toHaveCount(0)
  await expect(page.locator('.arena-home__continue').getByRole('link', { name: 'Продолжить' })).toHaveCount(0)
  await expect(page.locator(`.arena-home__history-row a[href="/arena/${state.activeSessionId}"]`)).toBeVisible()
})

test('opening an empty preparation creates a resumable zero-percent draft', async ({ page }) => {
  await seedProtectedScreens(page, 'empty-recent-preparation')
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('arena.recent-preparation.v1.') || key.startsWith('arena.preparation-draft.v2.')) localStorage.removeItem(key)
    }
  })
  await page.goto('/cases/salary-review/preparation?role=1&mode=voice&section=analysis')
  await expect(page.getByRole('heading', { name: 'Подготовка к переговорам' })).toBeVisible()
  await page.getByRole('link', { name: 'Назад' }).click()
  await expect(page.getByRole('heading', { name: 'Продолжить подготовку' })).toBeVisible()
  await expect(page.getByRole('meter', { name: 'Прогресс подготовки' })).toHaveAttribute('aria-valuenow', '0')
  await expect(page.getByRole('link', { name: 'Продолжить' })).toHaveAttribute('href', '/cases/salary-review/preparation?role=1&mode=voice&section=analysis')
})

test('quickly leaving preparation flushes fields and resumes the last section', async ({ page }) => {
  await seedProtectedScreens(page, 'quick-preparation-return')
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('arena.recent-preparation.v1.') || key.startsWith('arena.preparation-draft.v2.')) localStorage.removeItem(key)
    }
  })
  await page.goto('/cases/salary-review/preparation?role=0&mode=voice&section=tactics')
  await page.getByRole('textbox', { name: 'Сценарий' }).fill('Сначала обозначить общую цель.')
  await page.getByRole('textbox', { name: 'Загрузка' }).fill('Предлагаю обсудить условия.')
  await page.getByRole('link', { name: 'Назад' }).click()
  await expect(page.getByRole('meter', { name: 'Прогресс подготовки' })).toHaveAttribute('aria-valuenow', '20')
  const resumeLink = page.getByRole('link', { name: 'Продолжить' })
  await expect(resumeLink).toHaveAttribute('href', '/cases/salary-review/preparation?role=0&mode=voice&section=tactics')
  await resumeLink.click()
  await expect(page).toHaveURL(/section=tactics$/)
  await expect(page.getByRole('textbox', { name: 'Сценарий' })).toHaveValue('Сначала обозначить общую цель.')
})

test('starting a negotiation removes the preparation from the home resume card', async ({ page }) => {
  await seedProtectedScreens(page, 'started-preparation')
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('arena.recent-preparation.v1.') || key.startsWith('arena.preparation-draft.v2.')) localStorage.removeItem(key)
    }
  })
  await page.goto('/cases/salary-review/preparation?role=0&mode=text&section=analysis')
  await page.getByRole('textbox', { name: 'Корневой конфликт' }).fill('Нужно согласовать ожидания.')
  await page.getByRole('button', { name: 'Начать поединок' }).click()
  await expect(page).toHaveURL(/\/arena\//)
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Начать тренировку' })).toBeVisible()
  await expect(page.locator('.arena-home__preparation')).toHaveCount(0)
})

test('preparation remains available after signing in again in the same browser profile', async ({ page }) => {
  const email = 'preparation-owner@example.com'
  const password = 'strong-password'
  const expectedConflict = 'Сохранённый конфликт владельца.'
  await page.goto('/')
  await page.evaluate(async ({ emailValue, expectedValue, passwordValue }) => {
    const [
      { AUTH_STORAGE_KEY },
      { createTourOwnerKey },
      { createEmptyPreparation, savePreparationDraft },
      { MockAuthClient },
      { MockStorage, MOCK_DATA_STORAGE_KEY },
    ] = await Promise.all([
      import('/src/auth/storage.ts'),
      import('/src/auth/tourOwnerIdentity.ts'),
      import('/src/features/preparation/preparation.ts'),
      import('/src/services/mock/mockAuthClient.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(MOCK_DATA_STORAGE_KEY)
    const storage = new MockStorage(localStorage)
    const auth = new MockAuthClient(storage, 0)
    const registered = await auth.register({
      email: emailValue,
      first_name: 'Preparation',
      last_name: 'Owner',
      password: passwordValue,
    })
    const tokens = await auth.activate(registered.demo_activation_code ?? '')
    const stableOwnerKey = await createTourOwnerKey('mock', emailValue)
    const legacyOwnerKey = 'legacy-preparation-owner'
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      tokens,
      source: 'mock',
      mockOwnerKey: legacyOwnerKey,
      tourOwnerKey: stableOwnerKey,
    }))
    savePreparationDraft(legacyOwnerKey, 'salary-review', 0, {
      ...createEmptyPreparation(),
      rootConflict: expectedValue,
    })
    storage.dispose()
  }, { emailValue: email, expectedValue: expectedConflict, passwordValue: password })

  const preparationUrl = '/cases/salary-review/preparation?role=0&mode=voice&section=analysis'
  await page.goto(preparationUrl)
  await expect(page.getByRole('textbox', { name: 'Корневой конфликт' })).toHaveValue(expectedConflict)
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Продолжить подготовку' })).toBeVisible()

  await page.evaluate(async ({ emailValue, passwordValue }) => {
    const [
      { AUTH_STORAGE_KEY, createStoredSession },
      { createTourOwnerKey },
      { MockAuthClient },
      { MockStorage },
    ] = await Promise.all([
      import('/src/auth/storage.ts'),
      import('/src/auth/tourOwnerIdentity.ts'),
      import('/src/services/mock/mockAuthClient.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    const storage = new MockStorage(localStorage)
    const auth = new MockAuthClient(storage, 0)
    const tokens = await auth.login({ email: emailValue, password: passwordValue })
    const stableOwnerKey = await createTourOwnerKey('mock', emailValue)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(createStoredSession(tokens, 'mock', stableOwnerKey)))
    storage.dispose()
  }, { emailValue: email, passwordValue: password })

  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Продолжить подготовку' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Продолжить' })).toHaveAttribute('href', preparationUrl)
  await page.goto(preparationUrl)
  await expect(page.getByRole('textbox', { name: 'Корневой конфликт' })).toHaveValue(expectedConflict)
})

test('an expired persisted session automatically starts evaluation after reload', async ({ page }) => {
  const state = await seedProtectedScreens(page, 'expired-session')

  await page.goto(`/arena/${state.expiredSessionId}`)
  await expect(page).toHaveURL(new RegExp(`/result/${state.expiredSessionId}$`))
  await expect.poll(() => page.evaluate(({ sessionId }) => {
    const serialized = localStorage.getItem('arena.mock.data.v2')
    if (!serialized) return 0
    const data = JSON.parse(serialized) as { results?: Array<{ sessionId?: string }> }
    return data.results?.filter((result) => result.sessionId === sessionId).length ?? 0
  }, { sessionId: state.expiredSessionId })).toBe(1)
})

for (const viewport of viewports) {
  test(`${viewport.name} active voice arena confirms internal navigation`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const state = await seedActiveVoiceArena(page, `leave-${viewport.name}`)
    await page.goto(`/arena/${state.activeVoiceSessionId}`)
    await expect(page.locator('.duel-heading h1')).toBeVisible()

    await page.getByRole('link', { name: 'Арена — на главную' }).click()
    const leaveDialog = page.locator('[data-tour-id="leave-dialog"]')
    await expect(leaveDialog).toBeVisible()
    await captureScreen(page, 'arena-leave-dialog', viewport.name)
    await leaveDialog.getByRole('button', { name: 'Остаться' }).click()
    await expect(page).toHaveURL(new RegExp(`/arena/${state.activeVoiceSessionId}$`))

    await page.getByRole('link', { name: 'Арена — на главную' }).click()
    await leaveDialog.getByRole('button', { name: 'Завершить и покинуть' }).click()
    await expect(page).toHaveURL(/\/home$/)
    await expect.poll(() => page.evaluate(({ sessionId }) => {
      const serialized = localStorage.getItem('arena.mock.data.v2')
      if (!serialized) return null
      const data = JSON.parse(serialized) as { sessions?: Array<{ id?: string; status?: string }> }
      return data.sessions?.find((session) => session.id === sessionId)?.status ?? null
    }, { sessionId: state.activeVoiceSessionId })).toMatch(/^(finishing|finished)$/)
  })
}

test('active voice arena guards browser history, tour actions, and logout', async ({ page }) => {
  const state = await seedActiveVoiceArena(page, 'leave-actions')
  await page.goto('/home')
  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await expect(page.locator('.product-header-menu').getByRole('button').filter({ hasText: '2FA' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Пройти тур', exact: true }).click()
  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Выбери кейс')
  await page.locator(`a[href="/arena/${state.activeVoiceSessionId}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/arena/${state.activeVoiceSessionId}$`))
  await expect(page.locator('.duel-heading h1')).toBeVisible()

  await page.evaluate(() => history.back())
  const leaveDialog = page.locator('[data-tour-id="leave-dialog"]')
  await expect(leaveDialog).toBeVisible()
  await leaveDialog.getByRole('button', { name: 'Остаться' }).click()
  await expect(page).toHaveURL(new RegExp(`/arena/${state.activeVoiceSessionId}$`))

  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await page.getByRole('button', { name: /тур/i }).click()
  const restartDialog = page.locator('[data-tour-id="tour-restart-dialog"]')
  await expect(restartDialog).toBeVisible()
  await expect(restartDialog).toContainText('Текущий прогресс тура будет сброшен')
  await expect(page.locator('[data-product-tour-tooltip]')).toHaveCount(0)
  await restartDialog.getByRole('button', { name: 'Остаться' }).click()

  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await page.getByRole('button', { name: /тур/i }).click()
  await restartDialog.getByRole('button', { name: 'Завершить и начать заново' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.locator('.product-tour-tooltip h2')).toHaveText('Выбери кейс')

  const nextState = await seedActiveVoiceArena(page, 'leave-actions-logout')
  await page.goto(`/arena/${nextState.activeVoiceSessionId}`)

  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(leaveDialog).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('arena.auth.tokens.v1')))).toBe(true)
  await leaveDialog.getByRole('button', { name: 'Завершить и покинуть' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('text arena navigation is not guarded', async ({ page }) => {
  const state = await seedProtectedScreens(page, 'leave-text')
  await page.goto(`/arena/${state.activeSessionId}`)
  await page.getByRole('link', { name: 'Арена — на главную' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.locator('[data-tour-id="leave-dialog"]')).toHaveCount(0)
})

test('failed session finish does not trap an explicitly departing user', async ({ page }) => {
  const state = await seedActiveVoiceArena(page, 'leave-failed-finish')
  await page.goto(`/arena/${state.activeVoiceSessionId}`)
  await expect(page.locator('.duel-heading h1')).toBeVisible()
  await page.evaluate(async ({ sessionId }) => {
    const [{ MockStorage }] = await Promise.all([
      import('/src/services/mock/mockStorage.ts'),
    ])
    const storage = new MockStorage(localStorage)
    await storage.mutate((data) => {
      data.sessions = data.sessions.filter((session) => session.id !== sessionId)
    })
    storage.dispose()
  }, { sessionId: state.activeVoiceSessionId })

  await page.getByRole('link', { name: 'Арена — на главную' }).click()
  await page.locator('[data-tour-id="leave-dialog"]').getByRole('button', { name: 'Завершить и покинуть' }).click()
  await expect(page).toHaveURL(/\/home$/)
})

test('finished session routes remain unguarded', async ({ page }) => {
  const state = await seedProtectedScreens(page, 'leave-finished')
  await page.goto(`/result/${state.finishedSessionId}`)
  await expect(page.locator('.result-intro h1')).toHaveText('Разбор поединка')
  await page.getByRole('link', { name: 'Арена — на главную' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.locator('[data-tour-id="leave-dialog"]')).toHaveCount(0)
})
