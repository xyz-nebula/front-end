import type { Page, Route } from '@playwright/test'

import {
  artifactsDir,
  captureScreenshot,
  expect,
  expectNoHorizontalOverflow,
  test,
} from './helpers'

const storageKey = 'arena.auth.tokens.v1'
const uuidV7 = '01890f47-6c12-7cc4-b6a0-23d21a4b8c12'

const apiTokens = {
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

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function seedSession(page: Page, accessToken = 'stored-access', refreshToken = 'stored-refresh') {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, { key: storageKey, value: { accessToken, refreshToken } })
}

async function fillLogin(page: Page) {
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Пароль').fill('strong-password')
}

async function mockLogin(page: Page) {
  await page.route('**/api/v1/auth/login', (route) => json(route, 200, apiTokens))
}

async function login(page: Page) {
  await page.goto('/login')
  await fillLogin(page)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/home$/)
}

async function readStoredTokens(page: Page) {
  return page.evaluate((key) => window.localStorage.getItem(key), storageKey)
}

async function replaceSessionExternally(page: Page, accessToken: string, refreshToken: string) {
  await page.evaluate(({ key, value }) => {
    const serialized = JSON.stringify(value)
    window.localStorage.setItem(key, serialized)
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: serialized }))
  }, { key: storageKey, value: { accessToken, refreshToken } })
}

async function openEnrollment(page: Page) {
  await page.getByRole('button', { name: '2FA' }).click()
  await page.getByRole('button', { name: /Подключить 2FA/ }).click()
}

async function closeSecurityModal(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Закрыть' }).click()
}

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState(null, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

test('times out login and activation without leaving forms loading', async ({ page }) => {
  const delayedResponse = async (route: Route) => {
    await delay(1_200)
    await json(route, 200, apiTokens).catch(() => undefined)
  }

  await page.route('**/api/v1/auth/login', delayedResponse)
  await page.goto('/login')
  await fillLogin(page)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('alert')).toContainText('Сервер не ответил вовремя')
  await expect(page.getByRole('button', { name: 'Войти' })).toBeEnabled()

  await page.unroute('**/api/v1/auth/login')
  await page.route('**/api/v1/auth/register/activate', delayedResponse)
  await page.goto(`/activate?code=${uuidV7}`)
  await expect(page.getByRole('alert')).toContainText('Сервер не ответил вовремя')
  await expect(page.getByRole('button', { name: 'Попробовать снова' })).toBeEnabled()
})

test('does not let a delayed activation overwrite a newer login', async ({ page }) => {
  let releaseActivation = () => undefined
  const activationReleased = new Promise<void>((resolve) => { releaseActivation = resolve })
  let markActivationStarted = () => undefined
  const activationStarted = new Promise<void>((resolve) => { markActivationStarted = resolve })
  let markActivationResponded = () => undefined
  const activationResponded = new Promise<void>((resolve) => { markActivationResponded = resolve })

  await page.route('**/api/v1/auth/register/activate', async (route) => {
    markActivationStarted()
    await activationReleased
    await json(route, 200, {
      access_token: 'activation-a-access',
      refresh_token: 'activation-a-refresh',
    })
    markActivationResponded()
  })
  await page.route('**/api/v1/auth/login', (route) => json(route, 200, {
    access_token: 'login-b-access',
    refresh_token: 'login-b-refresh',
  }))

  await page.goto(`/activate?code=${uuidV7}`)
  await activationStarted
  await navigateInApp(page, '/login')
  await fillLogin(page)
  await page.getByRole('button', { name: 'Войти' }).click()

  await expect(page).toHaveURL(/\/home$/)
  await expect.poll(() => readStoredTokens(page)).toContain('login-b-refresh')

  releaseActivation()
  await activationResponded
  await delay(100)
  expect(await readStoredTokens(page)).not.toContain('activation-a-refresh')
  expect(await readStoredTokens(page)).toContain('login-b-refresh')
})

test('keeps the result of the last-started concurrent login', async ({ page }) => {
  let loginRequests = 0
  let releaseFirstLogin = () => undefined
  const firstLoginReleased = new Promise<void>((resolve) => { releaseFirstLogin = resolve })
  let markFirstLoginStarted = () => undefined
  const firstLoginStarted = new Promise<void>((resolve) => { markFirstLoginStarted = resolve })
  let markFirstLoginResponded = () => undefined
  const firstLoginResponded = new Promise<void>((resolve) => { markFirstLoginResponded = resolve })

  await page.route('**/api/v1/auth/login', async (route) => {
    loginRequests += 1
    if (loginRequests === 1) {
      markFirstLoginStarted()
      await firstLoginReleased
      await json(route, 200, {
        access_token: 'first-access',
        refresh_token: 'first-refresh',
      })
      markFirstLoginResponded()
      return
    }

    await json(route, 200, {
      access_token: 'second-access',
      refresh_token: 'second-refresh',
    })
  })

  await page.goto('/login')
  await fillLogin(page)
  await page.getByRole('button', { name: 'Войти' }).click()
  await firstLoginStarted

  await navigateInApp(page, '/auth')
  await page.getByRole('link', { name: 'Войти' }).click()
  await fillLogin(page)
  await page.getByLabel('Email').fill('newer@example.com')
  await page.getByRole('button', { name: 'Войти' }).click()

  await expect(page).toHaveURL(/\/home$/)
  await expect.poll(() => readStoredTokens(page)).toContain('second-refresh')

  releaseFirstLogin()
  await firstLoginResponded
  await delay(100)
  expect(await readStoredTokens(page)).not.toContain('first-refresh')
  expect(await readStoredTokens(page)).toContain('second-refresh')
})

test('does not restore a pending login after logout', async ({ page }) => {
  let releaseLogin = () => undefined
  const loginReleased = new Promise<void>((resolve) => { releaseLogin = resolve })
  let markLoginStarted = () => undefined
  const loginStarted = new Promise<void>((resolve) => { markLoginStarted = resolve })
  let markLoginResponded = () => undefined
  const loginResponded = new Promise<void>((resolve) => { markLoginResponded = resolve })

  await page.route('**/api/v1/auth/login', async (route) => {
    markLoginStarted()
    await loginReleased
    await json(route, 200, {
      access_token: 'late-access',
      refresh_token: 'late-refresh',
    })
    markLoginResponded()
  })
  await page.route('**/api/v1/auth/logout', (route) => route.fulfill({ status: 204 }))

  await page.goto('/login')
  await fillLogin(page)
  await page.getByRole('button', { name: 'Войти' }).click()
  await loginStarted

  await page.evaluate(({ key, value }) => {
    const serialized = JSON.stringify(value)
    window.localStorage.setItem(key, serialized)
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: serialized }))
  }, {
    key: storageKey,
    value: { accessToken: 'temporary-access', refreshToken: 'temporary-refresh' },
  })
  await expect(page).toHaveURL(/\/home$/)
  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page).toHaveURL(/\/auth$/)
  expect(await readStoredTokens(page)).toBeNull()

  releaseLogin()
  await loginResponded
  await delay(100)
  expect(await readStoredTokens(page)).toBeNull()
  await expect(page).toHaveURL(/\/auth$/)
})

test('keeps tokens after a transient bootstrap failure and recovers on retry', async ({ page }) => {
  await seedSession(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/v1/auth/token/refresh', (route) => json(route, 503, { detail: 'Unavailable' }))

  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Не удалось проверить сессию' })).toBeVisible()
  expect(await readStoredTokens(page)).toContain('stored-refresh')
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/session-recovery-desktop.png`)

  await page.unroute('**/api/v1/auth/token/refresh')
  await page.route('**/api/v1/auth/token/refresh', (route) => json(route, 200, {
    access_token: 'recovered-access',
    refresh_token: 'recovered-refresh',
  }))
  await page.getByRole('button', { name: 'Повторить' }).click()

  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('heading', { name: /Какой разговор/ })).toBeVisible()
  expect(await readStoredTokens(page)).toContain('recovered-refresh')
})

for (const failure of ['network', 'timeout'] as const) {
  test(`keeps tokens after a ${failure} bootstrap refresh failure`, async ({ page }) => {
    await seedSession(page)
    await page.route('**/api/v1/auth/token/refresh', async (route) => {
      if (failure === 'network') {
        await route.abort('failed')
        return
      }
      await delay(1_200)
      await json(route, 200, apiTokens).catch(() => undefined)
    })

    await page.goto('/home')

    await expect(page.getByRole('heading', { name: 'Не удалось проверить сессию' })).toBeVisible()
    expect(await readStoredTokens(page)).toContain('stored-refresh')
  })
}

test('clears a session when refresh is rejected with 403', async ({ page }) => {
  await seedSession(page)
  await page.route('**/api/v1/auth/token/refresh', (route) => json(route, 403, { detail: 'Forbidden' }))

  await page.goto('/home')

  await expect(page).toHaveURL(/\/login$/)
  expect(await readStoredTokens(page)).toBeNull()
})

test('optimistic logout clears the UI and storage before a hanging request finishes', async ({ page }) => {
  await mockLogin(page)
  await page.route('**/api/v1/auth/logout', async (route) => {
    await delay(4_000)
    await route.fulfill({ status: 204 }).catch(() => undefined)
  })
  await login(page)

  await page.getByRole('button', { name: 'Выйти' }).click()

  await expect(page).toHaveURL(/\/auth$/)
  expect(await readStoredTokens(page)).toBeNull()
})

test('retries remote logout after refreshing a rejected snapshot', async ({ page }) => {
  await mockLogin(page)
  let logoutRequests = 0
  await page.route('**/api/v1/auth/logout', async (route) => {
    logoutRequests += 1
    if (logoutRequests === 1) {
      await json(route, 401, { detail: 'Expired' })
      return
    }
    expect(route.request().headers().authorization).toBe('Bearer logout-access')
    expect(JSON.parse(route.request().postData() ?? 'null') as unknown).toEqual({ refresh_token: 'logout-refresh' })
    await route.fulfill({ status: 204 })
  })
  await page.route('**/api/v1/auth/token/refresh', (route) => json(route, 200, {
    access_token: 'logout-access',
    refresh_token: 'logout-refresh',
  }))
  await login(page)

  await page.getByRole('button', { name: 'Выйти' }).click()

  await expect(page).toHaveURL(/\/auth$/)
  await expect.poll(() => logoutRequests).toBe(2)
  expect(await readStoredTokens(page)).toBeNull()
})

test('keeps an authenticated session when refresh fails during a protected operation', async ({ page }) => {
  await seedSession(page)
  let refreshRequests = 0
  await page.route('**/api/v1/auth/token/refresh', async (route) => {
    refreshRequests += 1
    if (refreshRequests === 1) {
      await json(route, 200, { access_token: 'bootstrap-access', refresh_token: 'bootstrap-refresh' })
      return
    }
    await json(route, 503, { detail: 'Unavailable' })
  })
  await page.route('**/api/v1/auth/totp/enroll', (route) => json(route, 401, { detail: 'Expired' }))

  await page.goto('/home')
  await openEnrollment(page)

  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Сервис временно недоступен')
  await expect(page).toHaveURL(/\/home$/)
  expect(await readStoredTokens(page)).toContain('bootstrap-refresh')
})

test('does not retry a protected request with a replacement session', async ({ page }) => {
  await seedSession(page, 'account-a-access', 'account-a-refresh')
  let refreshRequests = 0
  let enrollRequests = 0
  let releaseEnrollment = () => undefined
  const enrollmentReleased = new Promise<void>((resolve) => { releaseEnrollment = resolve })
  let markEnrollmentStarted = () => undefined
  const enrollmentStarted = new Promise<void>((resolve) => { markEnrollmentStarted = resolve })

  await page.route('**/api/v1/auth/token/refresh', async (route) => {
    refreshRequests += 1
    await json(route, 200, {
      access_token: 'account-a-bootstrap-access',
      refresh_token: 'account-a-bootstrap-refresh',
    })
  })
  await page.route('**/api/v1/auth/totp/enroll', async (route) => {
    enrollRequests += 1
    markEnrollmentStarted()
    await enrollmentReleased
    await json(route, 401, { detail: 'Expired' })
  })

  await page.goto('/home')
  await openEnrollment(page)
  await enrollmentStarted
  await replaceSessionExternally(page, 'account-b-access', 'account-b-refresh')
  await expect(page.getByRole('dialog')).toBeHidden()

  releaseEnrollment()
  await delay(100)

  expect(enrollRequests).toBe(1)
  expect(refreshRequests).toBe(1)
  expect(await readStoredTokens(page)).toContain('account-b-refresh')
})

test('discards a late protected success from the previous session', async ({ page }) => {
  await seedSession(page, 'account-a-access', 'account-a-refresh')
  let releaseEnrollment = () => undefined
  const enrollmentReleased = new Promise<void>((resolve) => { releaseEnrollment = resolve })
  let markEnrollmentStarted = () => undefined
  const enrollmentStarted = new Promise<void>((resolve) => { markEnrollmentStarted = resolve })

  await page.route('**/api/v1/auth/token/refresh', (route) => json(route, 200, {
    access_token: 'account-a-bootstrap-access',
    refresh_token: 'account-a-bootstrap-refresh',
  }))
  await page.route('**/api/v1/auth/totp/enroll', async (route) => {
    markEnrollmentStarted()
    await enrollmentReleased
    await json(route, 200, {
      secret: 'ACCOUNT_A_LATE_SECRET',
      otpauth_url: 'otpauth://totp/Arena:account-a',
    })
  })

  await page.goto('/home')
  await openEnrollment(page)
  await enrollmentStarted
  await replaceSessionExternally(page, 'account-b-access', 'account-b-refresh')
  releaseEnrollment()
  await delay(100)

  await page.getByRole('button', { name: '2FA' }).click()
  await expect(page.getByRole('heading', { name: 'Двухфакторная защита' })).toBeVisible()
  await expect(page.getByText('ACCOUNT_A_LATE_SECRET')).toHaveCount(0)
})

test('closes an open security modal when the session is replaced externally', async ({ page }) => {
  await seedSession(page, 'account-a-access', 'account-a-refresh')
  await page.route('**/api/v1/auth/token/refresh', (route) => json(route, 200, {
    access_token: 'account-a-bootstrap-access',
    refresh_token: 'account-a-bootstrap-refresh',
  }))
  await page.route('**/api/v1/auth/totp/enroll', (route) => json(route, 200, {
    secret: 'ACCOUNT_A_VISIBLE_SECRET',
    otpauth_url: 'otpauth://totp/Arena:account-a',
  }))

  await page.goto('/home')
  await openEnrollment(page)
  await expect(page.getByText('ACCOUNT_A_VISIBLE_SECRET')).toBeVisible()

  await replaceSessionExternally(page, 'account-b-access', 'account-b-refresh')

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('ACCOUNT_A_VISIBLE_SECRET')).toHaveCount(0)
})

test('survives corrupted storage and removes its invalid value', async ({ page }) => {
  await page.addInitScript(({ key }) => {
    window.localStorage.setItem(key, '{broken-json')
  }, { key: storageKey })

  await page.goto('/home')

  await expect(page).toHaveURL(/\/login$/)
  expect(await readStoredTokens(page)).toBeNull()
})

test('uses a one-tab memory session when localStorage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const fail = () => { throw new DOMException('Storage disabled', 'SecurityError') }
    Storage.prototype.getItem = fail
    Storage.prototype.setItem = fail
    Storage.prototype.removeItem = fail
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockLogin(page)

  await login(page)
  const notice = page.getByRole('status').filter({ hasText: 'Сессия действует только в этой вкладке' })
  await expect(notice).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/memory-session-mobile.png`)

  await notice.getByRole('button', { name: 'Закрыть уведомление' }).click()
  await expect(notice).toBeHidden()
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
})

test('accepts UUIDv7 activation links and blocks missing or malformed codes', async ({ page }) => {
  let activationRequests = 0
  let activationPayload: unknown
  await page.route('**/api/v1/auth/register/activate', async (route) => {
    activationRequests += 1
    activationPayload = JSON.parse(route.request().postData() ?? 'null') as unknown
    await json(route, 200, apiTokens)
  })

  await page.goto('/activate')
  await expect(page.getByRole('alert')).toContainText('В ссылке нет кода активации')
  expect(activationRequests).toBe(0)

  await page.goto('/activate?code=01890f47-6c12-7cc4-z6a0-23d21a4b8c12')
  await expect(page.getByRole('alert')).toContainText('неверный формат')
  expect(activationRequests).toBe(0)

  await page.goto(`/activate?code=${uuidV7}`)
  await expect(page.getByRole('heading', { name: 'Аккаунт активирован' })).toBeVisible()
  expect(activationRequests).toBe(1)
  expect(activationPayload).toEqual({ code: uuidV7 })

  await page.getByRole('link', { name: 'Перейти в приложение' }).click()
  await expect(page).toHaveURL(/\/home$/)
})

test('recovers from activation validation and network errors on retry', async ({ page }) => {
  let activationRequests = 0
  await page.route('**/api/v1/auth/register/activate', async (route) => {
    activationRequests += 1
    if (activationRequests === 1) {
      await json(route, 422, {
        detail: [{ loc: ['body', 'code'], msg: 'Ссылка активации истекла', type: 'value_error' }],
      })
      return
    }
    if (activationRequests === 2) {
      await route.abort('failed')
      return
    }
    await json(route, 200, apiTokens)
  })

  await page.goto(`/activate?code=${uuidV7}`)
  await expect(page.getByRole('alert')).toContainText('Ссылка активации истекла')
  await expect(page.getByRole('button', { name: 'Попробовать снова' })).toBeEnabled()

  await page.getByRole('button', { name: 'Попробовать снова' }).click()
  await expect(page.getByRole('alert')).toContainText('Не удалось связаться с сервером')
  await expect(page.getByRole('button', { name: 'Попробовать снова' })).toBeEnabled()

  await page.getByRole('button', { name: 'Попробовать снова' }).click()
  await expect(page.getByRole('heading', { name: 'Аккаунт активирован' })).toBeVisible()
  expect(activationRequests).toBe(3)
})

test('synchronizes login, token rotation, and logout between tabs', async ({ page, context }) => {
  const otherPage = await context.newPage()
  await mockLogin(page)
  await page.route('**/api/v1/auth/token/refresh', (route) => json(route, 200, {
    access_token: 'rotated-access',
    refresh_token: 'rotated-refresh',
  }))
  let firstPageEnrolls = 0
  await page.route('**/api/v1/auth/totp/enroll', async (route) => {
    firstPageEnrolls += 1
    if (firstPageEnrolls === 1) {
      await json(route, 401, { detail: 'Expired' })
      return
    }
    expect(route.request().headers().authorization).toBe('Bearer rotated-access')
    await json(route, 200, { secret: 'FIRSTPAGE', otpauth_url: 'otpauth://totp/Arena:first' })
  })
  let otherAuthorization = ''
  await otherPage.route('**/api/v1/auth/totp/enroll', async (route) => {
    otherAuthorization = route.request().headers().authorization ?? ''
    await json(route, 200, { secret: 'OTHERPAGE', otpauth_url: 'otpauth://totp/Arena:other' })
  })
  await page.route('**/api/v1/auth/logout', (route) => route.fulfill({ status: 204 }))

  await otherPage.goto('/login')
  await login(page)
  await expect(otherPage).toHaveURL(/\/home$/)

  await openEnrollment(page)
  await expect(page.getByText('FIRSTPAGE')).toBeVisible()
  await expect.poll(() => readStoredTokens(otherPage)).toContain('rotated-refresh')

  await openEnrollment(otherPage)
  await expect(otherPage.getByText('OTHERPAGE')).toBeVisible()
  expect(otherAuthorization).toBe('Bearer rotated-access')

  await closeSecurityModal(page)
  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page).toHaveURL(/\/auth$/)
  await expect(otherPage).toHaveURL(/\/login$/)
})

test('serializes simultaneous bootstrap refreshes between tabs', async ({ page, context }) => {
  await page.goto('/login')
  await page.evaluate(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, {
    key: storageKey,
    value: { accessToken: 'shared-access', refreshToken: 'shared-refresh' },
  })

  let refreshRequests = 0
  await context.route('**/api/v1/auth/token/refresh', async (route) => {
    refreshRequests += 1
    if (refreshRequests > 1) {
      await json(route, 403, { detail: 'Refresh token already rotated' })
      return
    }

    await delay(200)
    await json(route, 200, {
      access_token: 'rotated-access',
      refresh_token: 'rotated-refresh',
    })
  })

  const otherPage = await context.newPage()
  await Promise.all([
    page.goto('/home'),
    otherPage.goto('/home'),
  ])

  await expect(page.getByRole('heading', { name: /Какой разговор/ })).toBeVisible()
  await expect(otherPage.getByRole('heading', { name: /Какой разговор/ })).toBeVisible()
  await expect.poll(() => readStoredTokens(page)).toContain('rotated-refresh')
  await expect.poll(() => readStoredTokens(otherPage)).toContain('rotated-refresh')
  expect(refreshRequests).toBe(1)
})

test('does not let a stale refresh overwrite a newer cross-tab session', async ({ page, context }) => {
  await seedSession(page, 'old-access', 'old-refresh')
  let releaseRefresh = () => undefined
  const refreshReleased = new Promise<void>((resolve) => { releaseRefresh = resolve })
  let markRefreshStarted = () => undefined
  const refreshStarted = new Promise<void>((resolve) => { markRefreshStarted = resolve })

  await page.route('**/api/v1/auth/token/refresh', async (route) => {
    markRefreshStarted()
    await refreshReleased
    await json(route, 200, { access_token: 'stale-access', refresh_token: 'stale-refresh' })
  })

  await page.goto('/home')
  await refreshStarted

  const otherPage = await context.newPage()
  await otherPage.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, {
    key: storageKey,
    value: { accessToken: 'newer-access', refreshToken: 'newer-refresh' },
  })
  await otherPage.route('**/api/v1/auth/token/refresh', (route) => json(route, 200, {
    access_token: 'newer-access',
    refresh_token: 'newer-refresh',
  }))
  await otherPage.goto('/home')
  await expect.poll(() => readStoredTokens(page)).toContain('newer-refresh')

  releaseRefresh()
  await expect(page).toHaveURL(/\/home$/)
  await expect(otherPage).toHaveURL(/\/home$/)
  await expect.poll(() => readStoredTokens(page)).toContain('newer-refresh')
  expect(await readStoredTokens(page)).not.toContain('stale-refresh')
})
