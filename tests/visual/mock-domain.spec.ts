import {
  artifactsDir,
  captureScreenshot,
  expect,
  expectNoHorizontalOverflow,
  test,
} from './helpers'

test('mock registration exposes a demo activation link on desktop and mobile', async ({ page }) => {
  test.skip(process.env.VITE_AUTH_SOURCE !== 'mock', 'Requires the full mock service mode.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/register')
  await page.getByLabel('Имя', { exact: true }).fill('Ирина')
  await page.getByLabel('Фамилия').fill('Петрова')
  await page.getByLabel('Email').fill(`irina.${Date.now()}@example.com`)
  await page.getByLabel('Пароль').fill('strong-password')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()

  const activationLink = page.getByRole('link', { name: 'Открыть demo-ссылку активации' })
  await expect(activationLink).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/mock-activation-link-desktop.png`)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(page, `${artifactsDir}/mock-activation-link-mobile.png`)
  await activationLink.click()
  await expect(page.getByRole('heading', { name: 'Аккаунт активирован' })).toBeVisible()
})

test('mock auth supports registration, activation, login, refresh and logout', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const [{ MockAuthClient }, { MockStorage, MOCK_DATA_STORAGE_KEY }] = await Promise.all([
      import('/src/services/mock/mockAuthClient.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    localStorage.removeItem(MOCK_DATA_STORAGE_KEY)
    const storage = new MockStorage(localStorage)
    const auth = new MockAuthClient(storage, 1)
    const registered = await auth.register({
      email: 'demo@example.com',
      first_name: 'Демо',
      last_name: 'Пользователь',
      password: 'strong-password',
    })
    const activated = await auth.activate(registered.demo_activation_code ?? '')
    const refreshed = await auth.refresh(activated.refreshToken)
    await auth.logout(refreshed.accessToken, refreshed.refreshToken)
    const loggedIn = await auth.login({ email: 'demo@example.com', password: 'strong-password' })
    storage.dispose()
    return {
      status: registered.status,
      hasDemoCode: Boolean(registered.demo_activation_code),
      accessIsMock: loggedIn.accessToken.startsWith('mock-access:'),
      storedUsers: JSON.parse(localStorage.getItem(MOCK_DATA_STORAGE_KEY) ?? '{}').users.length,
    }
  })

  expect(result).toEqual({
    status: 'pending_activation',
    hasDemoCode: true,
    accessIsMock: true,
    storedUsers: 1,
  })
})

test('mock negotiation is atomic, idempotent, isolated and recovers corrupted storage', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const [{ MockRuntime }, { MockStorage, MOCK_DATA_STORAGE_KEY }] = await Promise.all([
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    localStorage.setItem(MOCK_DATA_STORAGE_KEY, '{broken json')
    const storage = new MockStorage(localStorage)
    const runtime = new MockRuntime(storage)
    const first = await runtime.createSession('owner-a', {
      caseId: 'salary-review',
      mode: 'text',
      clientCommandId: 'create-1',
    })
    const repeated = await runtime.createSession('owner-a', {
      caseId: 'ignored-on-retry',
      mode: 'text',
      clientCommandId: 'create-1',
    })
    const turn = await runtime.sendTextTurn('owner-a', {
      sessionId: first.id,
      text: 'Мои обязанности и результаты выросли.',
      clientTurnId: 'turn-1',
    })
    const repeatedTurn = await runtime.sendTextTurn('owner-a', {
      sessionId: first.id,
      text: 'Этот текст не должен сохраниться.',
      clientTurnId: 'turn-1',
    })
    let isolated = false
    try {
      runtime.getSession('owner-b', first.id)
    } catch {
      isolated = true
    }
    const stored = runtime.getSession('owner-a', first.id)
    storage.dispose()
    return {
      sameSession: first.id === repeated.id,
      sameMessages: turn.userMessage.id === repeatedTurn.userMessage.id
        && turn.aiMessage.id === repeatedTurn.aiMessage.id,
      sequence: stored.messages.map((message) => message.sequence),
      isolated,
      corruptedValueReplaced: localStorage.getItem(MOCK_DATA_STORAGE_KEY)?.startsWith('{') ?? false,
    }
  })

  expect(result).toEqual({
    sameSession: true,
    sameMessages: true,
    sequence: [1, 2],
    isolated: true,
    corruptedValueReplaced: true,
  })
})

test('mock result processing becomes stable and finish remains idempotent', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const [{ MockRuntime }, { MockStorage, MOCK_DATA_STORAGE_KEY }] = await Promise.all([
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    localStorage.removeItem(MOCK_DATA_STORAGE_KEY)
    const storage = new MockStorage(localStorage)
    const runtime = new MockRuntime(storage)
    const session = await runtime.createSession('owner', {
      caseId: 'refund',
      mode: 'text',
      clientCommandId: 'create',
    })
    await runtime.sendTextTurn('owner', {
      sessionId: session.id,
      text: 'Прошу вернуть деньги за товар.',
      clientTurnId: 'turn',
    })
    const processing = await runtime.finishSession('owner', session.id, 'finish', 20)
    await new Promise((resolve) => setTimeout(resolve, 30))
    const ready = await runtime.getResult('owner', session.id)
    const repeated = await runtime.finishSession('owner', session.id, 'finish', 20)
    storage.dispose()
    return {
      processing: processing.status,
      ready: ready.status,
      repeated: repeated.status,
      stableScore: ready.status === 'ready' && repeated.status === 'ready'
        ? JSON.stringify(ready.result.outcome) === JSON.stringify(repeated.result.outcome)
        : false,
      sessionStatus: runtime.getSession('owner', session.id).status,
    }
  })

  expect(result).toEqual({
    processing: 'processing',
    ready: 'ready',
    repeated: 'ready',
    stableScore: true,
    sessionStatus: 'finished',
  })
})

test('mock result fixtures cover every outcome and all result states', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { createMockResultStateFixtures, mockOutcomeFixtureKinds } = await import('/src/mocks/resultFixtures.ts')
    const session = {
      id: 'fixture-session',
      caseId: 'salary-review',
      mode: 'text' as const,
      status: 'finished' as const,
      startedAt: '2026-09-28T10:00:00.000Z',
      finishedAt: '2026-09-28T10:05:00.000Z',
      messages: [
        { id: 'user-1', sequence: 1, speaker: 'user' as const, text: 'Предлагаю обсудить условия.', createdAt: '2026-09-28T10:01:00.000Z' },
        { id: 'ai-1', sequence: 2, speaker: 'ai' as const, text: 'Какие условия для вас приоритетны?', createdAt: '2026-09-28T10:02:00.000Z' },
      ],
    }
    const fixtures = mockOutcomeFixtureKinds.map((kind) => createMockResultStateFixtures(session, kind))
    return {
      kinds: fixtures.map((fixture) => fixture.ready.result.outcome.status === 'ready'
        ? fixture.ready.result.outcome.kind
        : null),
      stateStatuses: Object.keys(fixtures[0] ?? {}).map((key) => (
        fixtures[0]?.[key as keyof (typeof fixtures)[number]].status
      )),
      sources: fixtures.map((fixture) => fixture.ready.result.source),
      judgeColleges: fixtures.map((fixture) => fixture.ready.result.judges.map((judge) => judge.college)),
      trainersReady: fixtures.every((fixture) => fixture.ready.result.trainer.status === 'ready'),
      planEvidenceIsUser: fixtures.every((fixture) => (
        fixture.ready.result.trainer.status === 'ready'
        && fixture.ready.result.trainer.feedback.planVsReality?.items.every((item) => (
          item.evidence === null || item.evidence.isAi === false
        ))
      )),
    }
  })

  expect(result).toEqual({
    kinds: ['agreement', 'partial-agreement', 'deferred', 'no-agreement', 'not-assessable'],
    stateStatuses: ['processing', 'ready', 'failed'],
    sources: ['mock', 'mock', 'mock', 'mock', 'mock'],
    judgeColleges: Array.from({ length: 5 }, () => ['hiring', 'negotiation', 'ownership']),
    trainersReady: true,
    planEvidenceIsUser: true,
  })
})

test('mock runtime preserves failed results and ignores legacy result storage', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const [{ MockRuntime }, { MockStorage, MOCK_DATA_STORAGE_KEY }] = await Promise.all([
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    localStorage.removeItem(MOCK_DATA_STORAGE_KEY)
    localStorage.setItem('arena.mock.data.v1', JSON.stringify({
      version: 1,
      users: [{ id: 'legacy-user' }],
      sessions: [],
      results: [{ sessionId: 'legacy', outcome: 'victory', score: 90 }],
      audioTickets: [],
    }))

    const storage = new MockStorage(localStorage)
    const legacyIgnored = storage.read((data) => data.users.length === 0 && data.results.length === 0)
    const runtime = new MockRuntime(storage)
    const session = await runtime.createSession('owner-a', {
      caseId: 'refund',
      mode: 'text',
      clientCommandId: 'failed-create',
    })
    await storage.mutate((data) => {
      data.results.push({
        sessionId: session.id,
        status: 'failed',
        readyAt: Date.now(),
        message: 'Не удалось подготовить демонстрационный разбор.',
      })
    })
    const failed = await runtime.getResult('owner-a', session.id)
    let hiddenFromOtherOwner = false
    try {
      await runtime.getResult('owner-b', session.id)
    } catch {
      hiddenFromOtherOwner = true
    }
    storage.dispose()
    return {
      legacyIgnored,
      failed,
      hiddenFromOtherOwner,
      storageKey: MOCK_DATA_STORAGE_KEY,
    }
  })

  expect(result).toEqual({
    legacyIgnored: true,
    failed: { status: 'failed', message: 'Не удалось подготовить демонстрационный разбор.' },
    hiddenFromOtherOwner: true,
    storageKey: 'arena.mock.data.v2',
  })
})

test('mock audio requires fresh tickets, commits through runtime and cleans scheduled work', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const [{ MockAudioClient }, { MockRuntime }, { MockStorage, MOCK_DATA_STORAGE_KEY }] = await Promise.all([
      import('/src/services/mock/mockAudioClient.ts'),
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    localStorage.removeItem(MOCK_DATA_STORAGE_KEY)
    const storage = new MockStorage(localStorage)
    const runtime = new MockRuntime(storage)
    const session = await runtime.createSession('voice-owner', {
      caseId: 'missed-deadline',
      mode: 'voice',
      clientCommandId: 'create-voice',
    })
    const firstTicket = await runtime.createAudioTicket('voice-owner', session.id)
    let stoppedTracks = 0
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => { stoppedTracks += 1 } }],
        }),
      },
    })
    const client = new MockAudioClient(runtime, { latencyMs: 2, requestMicrophone: true })
    const events: string[] = []
    let resolveTranscriptCompletion = () => undefined
    const transcriptCompleted = new Promise<void>((resolve) => { resolveTranscriptCompletion = resolve })
    const unsubscribe = client.subscribe((event) => {
      events.push(event.type)
      if (events.filter((eventType) => eventType === 'message_committed').length === 2) {
        resolveTranscriptCompletion()
      }
    })
    await client.connect({ sessionId: session.id, ticket: firstTicket })
    await transcriptCompleted
    const committedBeforeReconnect = events.filter((event) => event === 'message_committed').length

    let reusedTicketRejected = false
    try {
      await client.connect({ sessionId: session.id, ticket: firstTicket })
    } catch {
      reusedTicketRejected = true
    }
    const secondTicket = await runtime.createAudioTicket('voice-owner', session.id)
    await client.connect({ sessionId: session.id, ticket: secondTicket })
    await client.disconnect()
    const eventCountAtDisconnect = events.length
    await new Promise((resolve) => setTimeout(resolve, 25))
    unsubscribe()
    const persisted = runtime.getSession('voice-owner', session.id)
    const firstDuplicate = await runtime.commitAudioMessage({
      ownerKey: 'voice-owner',
      sessionId: session.id,
      eventId: 'duplicate-event',
      speaker: 'user',
      text: 'Эта реплика сохраняется один раз.',
    })
    const secondDuplicate = await runtime.commitAudioMessage({
      ownerKey: 'voice-owner',
      sessionId: session.id,
      eventId: 'duplicate-event',
      speaker: 'user',
      text: 'Другой текст не заменяет сохранённую реплику.',
    })
    const afterDuplicate = runtime.getSession('voice-owner', session.id)
    storage.dispose()
    return {
      committedBeforeReconnect,
      persistedSpeakers: persisted.messages.map((message) => message.speaker),
      partialWasNotPersisted: persisted.messages.every((message) => !message.text.endsWith(' ')),
      reusedTicketRejected,
      freshTicket: firstTicket.ticket !== secondTicket.ticket,
      idleAfterDisconnect: client.getState() === 'idle',
      noEventsAfterDisconnect: events.length === eventCountAtDisconnect,
      stoppedTracks,
      eventIdDeduplicated: firstDuplicate.message.id === secondDuplicate.message.id
        && afterDuplicate.messages.length === persisted.messages.length + 1,
    }
  })

  expect(result).toEqual({
    committedBeforeReconnect: 2,
    persistedSpeakers: ['user', 'ai'],
    partialWasNotPersisted: true,
    reusedTicketRejected: true,
    freshTicket: true,
    idleAfterDisconnect: true,
    noEventsAfterDisconnect: true,
    stoppedTracks: 2,
    eventIdDeduplicated: true,
  })
})
