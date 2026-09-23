import {
  artifactsDir,
  captureScreenshot,
  expect,
  expectNoHorizontalOverflow,
  test,
} from './helpers'

const authStorageKey = 'arena.auth.tokens.v1'

async function seedAuthenticatedSession(page: Parameters<typeof test>[0]['page']) {
  await page.addInitScript(({ key }) => {
    window.localStorage.setItem(key, JSON.stringify({
      tokens: { accessToken: 'arena-access', refreshToken: 'arena-refresh' },
      source: 'real',
      mockOwnerKey: 'arena-text-owner',
    }))
  }, { key: authStorageKey })
  await page.route('**/api/v1/auth/token/refresh', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ access_token: 'fresh-arena-access', refresh_token: 'fresh-arena-refresh' }),
  }))
}

test('text arena creates, restores and finishes one atomic conversation without duplicates', async ({ page }) => {
  test.skip(process.env.VITE_AUTH_SOURCE !== 'real' || process.env.VITE_NEGOTIATION_SOURCE !== 'mock', 'Requires current real-auth/mock-domain smoke mode.')
  test.setTimeout(45_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedAuthenticatedSession(page)

  const chatCrudRequests: string[] = []
  page.on('request', (request) => {
    if (/\/chat\/.*\/message\//.test(request.url())) chatCrudRequests.push(request.url())
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/home')
  await page.getByRole('button', { name: 'Начать кейс' }).click()

  const dialog = page.getByRole('dialog', { name: 'Повышение зарплаты' })
  await expect(dialog.getByText('Текст', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Голос', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('radio', { name: /Голос/ })).toBeEnabled()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/training-modal-modes-desktop.png`)

  await dialog.getByRole('button', { name: 'Начать тренировку' }).click()
  await expect(page).toHaveURL(/\/arena\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: 'Начните разговор' })).toBeVisible()

  const composer = page.getByLabel('Ваша реплика')
  await composer.fill('Хочу обсудить пересмотр зарплаты: за полгода я взял на себя два новых направления.')
  await page.locator('.arena-composer').evaluate((form) => {
    const composerForm = form as HTMLFormElement
    composerForm.requestSubmit()
    composerForm.requestSubmit()
  })

  await expect(page.locator('.arena-message')).toHaveCount(2)
  await expect(page.getByText('Расскажите, какие результаты за последний период')).toBeVisible()
  expect(chatCrudRequests).toEqual([])

  const arenaUrl = page.url()
  const sessionId = arenaUrl.split('/').at(-1) ?? ''
  const persistedAfterTurn = await page.evaluate(() => {
    const data = JSON.parse(window.localStorage.getItem('arena.mock.data.v1') ?? '{}') as {
      sessions?: Array<{ messages?: unknown[] }>
    }
    return data.sessions?.[0]?.messages?.length ?? 0
  })
  expect(persistedAfterTurn).toBe(2)

  await page.reload()
  await expect(page.locator('.arena-message')).toHaveCount(2)
  await expect(page.getByText('Хочу обсудить пересмотр зарплаты')).toBeVisible()

  await page.evaluate(({ id }) => {
    window.sessionStorage.setItem(`arena.pending-turn.${id}`, JSON.stringify({
      id: 'recovered-turn-id',
      text: 'Какие измеримые результаты помогут принять решение о пересмотре?',
    }))
  }, { id: sessionId })
  await page.reload()
  await expect(page.locator('.arena-message')).toHaveCount(4)
  await expect(page.getByText('Какие измеримые результаты помогут')).toBeVisible()
  expect(await page.evaluate(({ id }) => window.sessionStorage.getItem(`arena.pending-turn.${id}`), { id: sessionId })).toBeNull()

  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/arena-text-desktop.png`)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: 'Повышение зарплаты' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/arena-text-mobile.png`)

  await page.getByRole('button', { name: 'Завершить' }).click()
  await expect(page.getByRole('heading', { name: 'Закончить переговоры?' })).toBeVisible()
  await captureScreenshot(page, `${artifactsDir}/arena-finish-confirmation-mobile.png`)
  await page.getByRole('dialog').getByRole('button', { name: 'Завершить' }).click()
  await expect(page).toHaveURL(new RegExp(`/result/${sessionId}$`))
  await expect(page.getByRole('heading', { name: 'Ваш результат' })).toBeVisible()
  await expect(composer).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ваш результат' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/result/${sessionId}$`))
  expect(chatCrudRequests).toEqual([])
})
