import type { Page, Route } from '@playwright/test'

import {
  artifactsDir,
  captureScreenshot,
  expect,
  expectNoHorizontalOverflow,
  test,
} from './helpers'

const storageKey = 'arena.auth.tokens.v1'
const activationCode = '123e4567-e89b-42d3-a456-426614174000'

const tokens = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function seedSession(page: Page, accessToken = 'stored-access', refreshToken = 'stored-refresh') {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, { key: storageKey, value: { accessToken, refreshToken } })
}

async function mockSuccessfulBootstrap(page: Page, nextAccessToken = 'fresh-access', nextRefreshToken = 'fresh-refresh') {
  await page.route('**/api/v1/auth/token/refresh', (route) => json(route, 200, {
    access_token: nextAccessToken,
    refresh_token: nextRefreshToken,
  }))
}

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({ usr: null, key: 'test-navigation', idx: 1 }, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function loginThroughUi(page: Page, totpToken = '') {
  await page.goto('/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
  if (totpToken) {
    await page.getByRole('button', { name: 'У меня подключён 2FA' }).click()
    await page.getByLabel('Код 2FA — если подключён').fill(totpToken)
  }
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/home$/)
}

async function submitRegistration(page: Page) {
  await page.goto('/register')
  await page.getByLabel('Имя', { exact: true }).fill('Ирина')
  await page.getByLabel('Фамилия').fill('Петрова')
  await page.getByLabel('Email').fill('irina@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
}

test('auth entry screens render on desktop and mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/auth')
  await expect(page).toHaveURL(/\/login$/)

  await expect(page.getByRole('heading', { level: 1, name: 'С возвращением' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/login-desktop.png`)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1, name: 'С возвращением' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/login-mobile.png`)
})

test('registration renders responsively and reveals the password', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/register')
  await expect(page.getByRole('heading', { level: 1, name: 'Создание аккаунта' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const password = page.getByLabel('Пароль')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Показать символы' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Скрыть символы' }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await captureScreenshot(page, `${artifactsDir}/register-desktop.png`)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/register-mobile.png`)
})

test('not found page uses safe back navigation and a contextual home', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/missing-page')
  await expect(page.getByRole('heading', { name: 'Такой страницы нет' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'На главную', exact: true })).toHaveAttribute('href', '/')
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/not-found-desktop.png`)

  await page.getByRole('button', { name: /Вернуться назад/ }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/login')
  await navigateInApp(page, '/another-missing-page')
  await expect(page.getByRole('heading', { name: 'Такой страницы нет' })).toBeVisible()
  await page.getByRole('button', { name: /Вернуться назад/ }).click()
  await expect(page).toHaveURL(/\/login$/)

  await seedSession(page)
  await mockSuccessfulBootstrap(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/missing-for-member')
  await expect(page.getByRole('link', { name: 'На главную', exact: true })).toHaveAttribute('href', '/home')
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/not-found-mobile.png`)
  await page.getByRole('link', { name: 'На главную', exact: true }).click()
  await expect(page).toHaveURL(/\/home$/)
})

test('login controls reveal the password and 2FA field, and explain unavailable recovery', async ({ page }) => {
  await page.goto('/login')
  const password = page.getByLabel('Пароль')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Показать символы' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Скрыть символы' }).click()
  await expect(password).toHaveAttribute('type', 'password')

  const totpToggle = page.getByRole('button', { name: 'У меня подключён 2FA' })
  await expect(totpToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByLabel('Код 2FA — если подключён')).toHaveCount(0)
  await totpToggle.click()
  await expect(page.getByLabel('Код 2FA — если подключён')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Скрыть код 2FA' })).toHaveAttribute('aria-expanded', 'true')
  await captureScreenshot(page, `${artifactsDir}/login-totp-desktop.png`)
  await page.getByRole('button', { name: 'Скрыть код 2FA' }).click()
  await expect(page.getByLabel('Код 2FA — если подключён')).toHaveCount(0)

  const forgot = page.getByRole('button', { name: 'Забыли пароль?' })
  await forgot.click()
  const dialog = page.getByRole('dialog', { name: 'Восстановление пароля' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/пока недоступно/)).toBeVisible()
  await captureScreenshot(page, `${artifactsDir}/login-recovery-dialog-desktop.png`)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(forgot).toBeFocused()
})

test('shows the email confirmation screen after registration', async ({ page }) => {
  test.setTimeout(30_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  let registerPayload: unknown

  await page.route('**/api/v1/auth/register', async (route) => {
    registerPayload = JSON.parse(route.request().postData() ?? 'null') as unknown
    await json(route, 200, {
      user_id: 'd2719d45-ff17-4fc9-8ec5-4dc47cb08ae5',
      status: 'pending_activation',
    })
  })
  await page.goto('/register')
  await page.getByLabel('Имя', { exact: true }).fill('Ирина')
  await page.getByLabel('Фамилия').fill('Петрова')
  await page.getByLabel('Email').fill('irina@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()

  await expect(page).toHaveURL(/\/activate$/)
  await expect(page.getByRole('heading', { name: 'Проверьте почту' })).toBeVisible()
  await expect(page.getByText(/irina@example.com/)).toBeVisible()
  await expect(page.getByLabel('Код активации')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/activation-waiting-desktop.png`)
  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  await expect(page.getByRole('link', { name: 'На главную', exact: true })).toBeInViewport()
  await captureScreenshot(page, `${artifactsDir}/activation-waiting-mobile.png`)
  await expect(page.getByRole('button', { name: 'Отправить повторно' })).toHaveCount(0)
  await expect(page.getByText('Не получили письмо?')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login')
  expect(registerPayload).toEqual({
    email: 'irina@example.com',
    first_name: 'Ирина',
    last_name: 'Петрова',
    password: 'strong-password',
  })
})

test('activates from a link only once in React strict mode', async ({ page }) => {
  let activationRequests = 0
  let activationPayload: unknown
  await page.route('**/api/v1/auth/register/activate', async (route) => {
    activationRequests += 1
    activationPayload = JSON.parse(route.request().postData() ?? 'null') as unknown
    await json(route, 200, tokens)
  })

  await page.goto(`/activate?code=${activationCode}`)
  await expect(page.getByRole('heading', { name: 'Аккаунт активирован' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/activate\\?code=${activationCode}$`))
  expect(activationRequests).toBe(1)
  expect(activationPayload).toEqual({ code: activationCode })
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toContain('refresh-token')

  await page.getByRole('link', { name: 'Перейти в приложение' }).click()
  await expect(page).toHaveURL(/\/home$/)
})

test('does not replace an existing session from an activation link', async ({ page }) => {
  await seedSession(page)
  await mockSuccessfulBootstrap(page)
  let activationRequests = 0
  await page.route('**/api/v1/auth/register/activate', async (route) => {
    activationRequests += 1
    await json(route, 200, tokens)
  })

  await page.goto(`/activate?code=${activationCode}`)

  await expect(page).toHaveURL(/\/home$/)
  expect(activationRequests).toBe(0)
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toContain('fresh-refresh')
})

test('activation loading, success, and error states render on desktop and mobile', async ({ page }) => {
  // Six screenshots and several viewport changes share this test budget.
  test.setTimeout(30_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/v1/auth/register/activate', (route) => json(route, 422, {
    detail: [{ loc: ['body', 'code'], msg: 'Ссылка истекла или уже была использована', type: 'value_error' }],
  }))

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/activate?code=${activationCode}`)
  await expect(page.getByRole('alert')).toContainText('Ссылка истекла')
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/activation-error-desktop.png`)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/activation-error-mobile.png`)

  await page.unroute('**/api/v1/auth/register/activate')
  await page.goto('/login')
  let releaseActivation = () => undefined
  const activationReleased = new Promise<void>((resolve) => { releaseActivation = resolve })
  await page.route('**/api/v1/auth/register/activate', async (route) => {
    await activationReleased
    await json(route, 200, tokens)
  })

  // Keep the intercepted request pending while taking loading screenshots;
  // the runner uses a short API timeout for dedicated resilience tests.
  await page.clock.install()
  await page.clock.pauseAt(new Date())
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/activate?code=${activationCode}`)
  // Let React commit the lazy route, then freeze the pending API timeout again.
  await page.clock.resume()
  await expect(page.getByRole('heading', { name: 'Активируем аккаунт' })).toBeVisible()
  await page.clock.pauseAt(new Date())
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/activation-loading-desktop.png`)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/activation-loading-mobile.png`)

  releaseActivation()
  await expect(page.getByRole('heading', { name: 'Аккаунт активирован' })).toBeVisible()
  await page.clock.resume()
  await captureScreenshot(page, `${artifactsDir}/activation-success-mobile.png`)

  await page.setViewportSize({ width: 1440, height: 900 })
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/activation-success-desktop.png`)
})

test('returns to a protected route after password login and logs out locally', async ({ page }) => {
  let loginPayload: unknown
  let logoutPayload: unknown
  let logoutAuthorization = ''
  let markLogoutHandled = () => undefined
  const logoutHandled = new Promise<void>((resolve) => { markLogoutHandled = resolve })

  await page.route('**/api/v1/auth/login', async (route) => {
    loginPayload = JSON.parse(route.request().postData() ?? 'null') as unknown
    await json(route, 200, tokens)
  })
  await page.route('**/api/v1/auth/logout', async (route) => {
    logoutPayload = JSON.parse(route.request().postData() ?? 'null') as unknown
    logoutAuthorization = route.request().headers().authorization ?? ''
    await route.fulfill({ status: 204 })
    markLogoutHandled()
  })

  await page.goto('/home')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/home$/)
  expect(loginPayload).toEqual({ email: 'user@example.com', password: 'strong-password' })

  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page).toHaveURL(/\/login$/)
  // Local logout is optimistic; the redirect does not await remote revocation.
  await logoutHandled
  expect(logoutPayload).toEqual({ refresh_token: 'refresh-token' })
  expect(logoutAuthorization).toBe('Bearer access-token')
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBeNull()
})

test('sends an optional TOTP token during login', async ({ page }) => {
  let loginPayload: unknown
  await page.route('**/api/v1/auth/login', async (route) => {
    loginPayload = JSON.parse(route.request().postData() ?? 'null') as unknown
    await json(route, 200, tokens)
  })

  await loginThroughUi(page, '123456')
  expect(loginPayload).toEqual({
    email: 'user@example.com',
    password: 'strong-password',
    totp_token: '123456',
  })
})

test('restores a session with refresh and clears an invalid session', async ({ page }) => {
  await seedSession(page)
  let refreshPayload: unknown
  await page.route('**/api/v1/auth/token/refresh', async (route) => {
    refreshPayload = JSON.parse(route.request().postData() ?? 'null') as unknown
    await json(route, 200, { access_token: 'renewed-access', refresh_token: 'renewed-refresh' })
  })

  await page.goto('/home')
  await expect(page.getByRole('heading', { name: /Добро пожаловать/ })).toBeVisible()
  expect(refreshPayload).toEqual({ refresh_token: 'stored-refresh' })
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toContain('renewed-refresh')

  await page.unrouteAll({ behavior: 'wait' })
  await page.route('**/api/v1/auth/token/refresh', (route) => json(route, 401, { detail: 'Invalid token' }))
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBeNull()
})

test('refreshes once after a protected 401 and supports TOTP enable and disable', async ({ page }) => {
  await seedSession(page)
  let refreshRequests = 0
  let enrollRequests = 0
  let confirmAuthorization = ''
  let disablePayload: unknown

  await page.route('**/api/v1/auth/token/refresh', async (route) => {
    refreshRequests += 1
    await json(route, 200, {
      access_token: refreshRequests === 1 ? 'bootstrap-access' : 'retry-access',
      refresh_token: refreshRequests === 1 ? 'bootstrap-refresh' : 'retry-refresh',
    })
  })
  await page.route('**/api/v1/auth/totp/enroll', async (route) => {
    enrollRequests += 1
    if (enrollRequests === 1) {
      await json(route, 401, { detail: 'Expired token' })
      return
    }
    expect(route.request().headers().authorization).toBe('Bearer retry-access')
    await json(route, 200, { secret: 'JBSWY3DPEHPK3PXP', otpauth_url: 'otpauth://totp/Arena:user' })
  })
  await page.route('**/api/v1/auth/totp/confirm', async (route) => {
    confirmAuthorization = route.request().headers().authorization ?? ''
    await route.fulfill({ status: 204 })
  })
  await page.route('**/api/v1/auth/totp', async (route) => {
    disablePayload = JSON.parse(route.request().postData() ?? 'null') as unknown
    await route.fulfill({ status: 204 })
  })

  await page.goto('/home')
  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await page.getByRole('button', { name: 'Настроить 2FA' }).click()
  await page.getByRole('button', { name: /Подключить 2FA/ }).click()
  await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible()
  expect(refreshRequests).toBe(2)
  expect(enrollRequests).toBe(2)

  await page.getByLabel('Код из приложения').fill('654321')
  await page.getByRole('button', { name: 'Подтвердить и включить' }).click()
  await expect(page.getByRole('heading', { name: '2FA подключена' })).toBeVisible()
  await captureScreenshot(page, `${artifactsDir}/security-success-desktop.png`)
  expect(confirmAuthorization).toBe('Bearer retry-access')

  await page.locator('.security-success').getByRole('button', { name: 'Закрыть' }).click()
  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await page.getByRole('button', { name: 'Настроить 2FA' }).click()
  await page.getByRole('button', { name: /Отключить 2FA/ }).click()
  await page.getByLabel('Текущий пароль').fill('strong-password')
  await page.getByLabel('Я понимаю, что вход станет менее защищённым').check()
  await page.getByRole('button', { name: 'Отключить 2FA' }).click()
  await expect(page.getByRole('heading', { name: '2FA отключена' })).toBeVisible()
  expect(disablePayload).toEqual({ password: 'strong-password' })
})

test('maps backend validation errors to fields and shows network failures', async ({ page }) => {
  await page.route('**/api/v1/auth/register', (route) => json(route, 422, {
    detail: [{ loc: ['body', 'email'], msg: 'Email уже занят', type: 'value_error' }],
  }))
  await page.goto('/register')
  await page.getByLabel('Имя', { exact: true }).fill('Ирина')
  await page.getByLabel('Фамилия').fill('Петрова')
  await page.getByLabel('Email').fill('irina@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByText('Email уже занят')).toBeVisible()

  await page.unrouteAll({ behavior: 'wait' })
  await page.route('**/api/v1/auth/login', (route) => route.abort('failed'))
  await page.goto('/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('alert')).toContainText('Не удалось связаться с сервером')
})

test('rejects malformed login tokens without creating a session', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (route) => json(route, 200, {
    access_token: 'access-token',
    refresh_token: '   ',
  }))

  await page.goto('/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Войти' }).click()

  await expect(page.getByRole('alert')).toContainText('Сервер вернул несовместимый ответ')
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBeNull()
})

test('rejects malformed activation tokens without creating a session', async ({ page }) => {
  await page.route('**/api/v1/auth/register/activate', (route) => json(route, 200, {
    access_token: '',
    refresh_token: 'refresh-token',
  }))

  await page.goto(`/activate?code=${activationCode}`)

  await expect(page.getByRole('alert')).toContainText('Сервер вернул несовместимый ответ')
  await expect(page.getByRole('heading', { name: 'Аккаунт активирован' })).toHaveCount(0)
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBeNull()
})

test('rejects malformed refresh tokens without overwriting stored session', async ({ page }) => {
  await seedSession(page)
  await page.route('**/api/v1/auth/token/refresh', (route) => json(route, 200, {
    access_token: 'renewed-access',
  }))

  await page.goto('/home')

  await expect(page.getByRole('heading', { name: 'Не удалось проверить сессию' })).toBeVisible()
  const storedSession = await page.evaluate((key) => window.localStorage.getItem(key), storageKey)
  expect(storedSession).toContain('stored-refresh')
  expect(storedSession).not.toContain('renewed-access')
})

test('rejects malformed registration response without showing success', async ({ page }) => {
  await page.route('**/api/v1/auth/register', (route) => json(route, 200, {
    user_id: 'not-a-uuid',
    status: 'unknown',
  }))

  await submitRegistration(page)

  await expect(page.getByRole('alert')).toContainText('Сервер вернул несовместимый ответ')
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByRole('heading', { name: 'Проверьте почту' })).toHaveCount(0)
})

test('rejects malformed TOTP enrollment without exposing a success state', async ({ page }) => {
  await seedSession(page)
  await mockSuccessfulBootstrap(page)
  await page.route('**/api/v1/auth/totp/enroll', (route) => json(route, 200, {
    secret: '   ',
    otpauth_url: 'otpauth://totp/Arena:user',
  }))

  await page.goto('/home')
  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await page.getByRole('button', { name: 'Настроить 2FA' }).click()
  await page.getByRole('button', { name: /Подключить 2FA/ }).click()

  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Сервер вернул несовместимый ответ')
  await expect(page.getByText('Секретный ключ')).toHaveCount(0)
})

test('security modal renders on desktop and mobile', async ({ page }) => {
  await seedSession(page)
  await mockSuccessfulBootstrap(page)
  await page.route('**/api/v1/auth/totp/enroll', (route) => json(route, 200, {
    secret: 'JBSWY3DPEHPK3PXP',
    otpauth_url: 'otpauth://totp/Arena:user',
  }))
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/home')
  await page.getByRole('button', { name: 'Меню профиля' }).click()
  await page.getByRole('button', { name: 'Настроить 2FA' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await captureScreenshot(page, `${artifactsDir}/security-modal-desktop.png`)

  await page.getByRole('button', { name: /Подключить 2FA/ }).click()
  await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible()
  await captureScreenshot(page, `${artifactsDir}/security-enroll-desktop.png`)
  await page.getByRole('button', { name: '← Назад' }).click()
  await page.getByRole('button', { name: /Отключить 2FA/ }).click()
  await expect(page.getByRole('heading', { name: 'Подтверди действие' })).toBeVisible()
  await captureScreenshot(page, `${artifactsDir}/security-disable-desktop.png`)
  await page.getByRole('button', { name: '← Назад' }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/security-modal-mobile.png`)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
})
