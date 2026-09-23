import { expect, test } from './helpers'

test('keeps confirmed mutations after persistent storage rejects a write', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const [{ MockRuntime }, { MockStorage }] = await Promise.all([
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    let persisted: string | null = null
    const failingStorage = {
      getItem: () => persisted,
      setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError') },
      removeItem: () => { persisted = null },
    }
    const storage = new MockStorage(failingStorage)
    const runtime = new MockRuntime(storage)
    const created = await runtime.createSession('owner', {
      caseId: 'salary-review', mode: 'text', clientCommandId: 'memory-create',
    })
    const readAfterCreate = runtime.getSession('owner', created.id)
    const firstTurn = await runtime.sendTextTurn('owner', {
      sessionId: created.id, text: 'Первый ход', clientTurnId: 'memory-turn',
    })
    const repeatedTurn = await runtime.sendTextTurn('owner', {
      sessionId: created.id, text: 'Не должен сохраниться', clientTurnId: 'memory-turn',
    })
    const readAfterTurn = runtime.getSession('owner', created.id)
    storage.dispose()
    return {
      readAfterCreate: readAfterCreate.id === created.id,
      messageIdsMatch: firstTurn.userMessage.id === repeatedTurn.userMessage.id,
      messages: readAfterTurn.messages.map((message) => message.text),
      persistentValue: persisted,
    }
  })

  expect(result).toEqual({
    readAfterCreate: true,
    messageIdsMatch: true,
    messages: ['Первый ход', expect.any(String)],
    persistentValue: null,
  })
})

test('preserves old and new data when storage fails after earlier writes', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const [{ MockRuntime }, { MockStorage }] = await Promise.all([
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    let persisted: string | null = null
    let rejectWrites = false
    const intermittentStorage = {
      getItem: () => persisted,
      setItem: (_key: string, value: string) => {
        if (rejectWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError')
        persisted = value
      },
      removeItem: () => { persisted = null },
    }
    const storage = new MockStorage(intermittentStorage)
    const runtime = new MockRuntime(storage)
    const first = await runtime.createSession('owner', {
      caseId: 'salary-review', mode: 'text', clientCommandId: 'persisted-create',
    })
    rejectWrites = true
    const second = await runtime.createSession('owner', {
      caseId: 'refund', mode: 'voice', clientCommandId: 'memory-create',
    })
    await runtime.sendTextTurn('owner', {
      sessionId: first.id, text: 'Ход после quota error', clientTurnId: 'memory-turn',
    })
    const sessions = storage.read((data) => data.sessions.map((session) => ({
      id: session.id,
      messages: session.messages.length,
    })))
    storage.dispose()
    return { firstId: first.id, secondId: second.id, sessions }
  })

  expect(result.sessions).toEqual([
    { id: result.firstId, messages: 2 },
    { id: result.secondId, messages: 0 },
  ])
})

test('parallel mock tabs keep one session and monotonic message sequence', async ({ page, context }) => {
  await page.goto('/')
  const otherPage = await context.newPage()
  await otherPage.goto('/')

  const sessionId = await page.evaluate(async () => {
    const [{ MockRuntime }, { MockStorage }] = await Promise.all([
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    const storage = new MockStorage(localStorage)
    const runtime = new MockRuntime(storage)
    const session = await runtime.createSession('shared-owner', {
      caseId: 'salary-review', mode: 'text', clientCommandId: 'shared-create',
    })
    storage.dispose()
    return session.id
  })

  const performTurns = async ({ id, prefix }: { id: string; prefix: string }) => {
    const [{ MockRuntime }, { MockStorage }] = await Promise.all([
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    const storage = new MockStorage(localStorage)
    const runtime = new MockRuntime(storage)
    const repeated = await runtime.createSession('shared-owner', {
      caseId: 'ignored', mode: 'text', clientCommandId: 'shared-create',
    })
    await Promise.all(Array.from({ length: 4 }, (_, index) => runtime.sendTextTurn('shared-owner', {
      sessionId: id,
      text: `${prefix} ${index}`,
      clientTurnId: `${prefix}-${index}`,
    })))
    storage.dispose()
    return repeated.id
  }

  const [firstId, secondId] = await Promise.all([
    page.evaluate(performTurns, { id: sessionId, prefix: 'first' }),
    otherPage.evaluate(performTurns, { id: sessionId, prefix: 'second' }),
  ])
  expect(firstId).toBe(sessionId)
  expect(secondId).toBe(sessionId)

  const stored = await page.evaluate(async (id) => {
    const [{ MockRuntime }, { MockStorage }] = await Promise.all([
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    const storage = new MockStorage(localStorage)
    const runtime = new MockRuntime(storage)
    const messages = runtime.getSession('shared-owner', id).messages
    storage.dispose()
    return messages
  }, sessionId)
  expect(stored.map((message) => message.sequence)).toEqual(Array.from({ length: 16 }, (_, index) => index + 1))
  expect(new Set(stored.map((message) => message.id)).size).toBe(16)
})

test('fallback lease rejects a second arena and releases after disposal', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
    const [{ MockRuntime }, { MockStorage, MOCK_DATA_STORAGE_KEY }] = await Promise.all([
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    localStorage.removeItem(MOCK_DATA_STORAGE_KEY)
    const first = new MockStorage(localStorage)
    const second = new MockStorage(localStorage)
    const firstRuntime = new MockRuntime(first)
    const secondRuntime = new MockRuntime(second)
    await firstRuntime.createSession('owner', {
      caseId: 'salary-review', mode: 'text', clientCommandId: 'first',
    })
    let errorCode = ''
    try {
      await secondRuntime.createSession('owner', {
        caseId: 'salary-review', mode: 'text', clientCommandId: 'second',
      })
    } catch (error) {
      errorCode = error instanceof Error && 'code' in error ? String(error.code) : ''
    }
    first.dispose()
    const afterRelease = await secondRuntime.createSession('owner', {
      caseId: 'salary-review', mode: 'text', clientCommandId: 'second',
    })
    second.dispose()
    return { errorCode, secondSessionCreated: Boolean(afterRelease.id) }
  })
  expect(result).toEqual({ errorCode: 'MOCK_ARENA_TAB_CONFLICT', secondSessionCreated: true })
})

test('invalid version and malformed nested mock data recover without leaking users', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const [{ MockRuntime }, { MockStorage, MOCK_DATA_STORAGE_KEY }] = await Promise.all([
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    const invalidValues = [
      '{broken',
      JSON.stringify({ version: 2, users: [], sessions: [], results: [], audioTickets: [] }),
      JSON.stringify({ version: 1, users: [], sessions: [{ id: 'bad' }], results: [], audioTickets: [] }),
    ]
    const recovered: boolean[] = []
    for (const serialized of invalidValues) {
      localStorage.setItem(MOCK_DATA_STORAGE_KEY, serialized)
      const storage = new MockStorage(localStorage)
      const runtime = new MockRuntime(storage)
      const session = await runtime.createSession('owner-a', {
        caseId: 'salary-review', mode: 'text', clientCommandId: crypto.randomUUID(),
      })
      const data = JSON.parse(localStorage.getItem(MOCK_DATA_STORAGE_KEY) ?? 'null') as {
        version: number; sessions: Array<{ id: string }>
      }
      let otherOwnerDenied = false
      try { runtime.getSession('owner-b', session.id) } catch { otherOwnerDenied = true }
      recovered.push(data.version === 1 && data.sessions.length === 1 && otherOwnerDenied)
      storage.dispose()
    }
    return recovered
  })
  expect(result).toEqual([true, true, true])
})

test('disconnect during pending microphone request stops late tracks and emits no transcript', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const [{ MockAudioClient }, { MockRuntime }, { MockStorage }] = await Promise.all([
      import('/src/services/mock/mockAudioClient.ts'),
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    const storage = new MockStorage(localStorage)
    const runtime = new MockRuntime(storage)
    const session = await runtime.createSession('owner', {
      caseId: 'salary-review', mode: 'voice', clientCommandId: 'cleanup-create',
    })
    const ticket = await runtime.createAudioTicket('owner', session.id)
    let releaseMicrophone: (stream: MediaStream) => void = () => undefined
    const microphone = new Promise<MediaStream>((resolve) => { releaseMicrophone = resolve })
    let microphoneRequested = () => undefined
    const requestStarted = new Promise<void>((resolve) => { microphoneRequested = resolve })
    let stoppedTracks = 0
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => { microphoneRequested(); return microphone } },
    })
    const client = new MockAudioClient(runtime, { latencyMs: 2, requestMicrophone: true })
    const events: string[] = []
    const unsubscribe = client.subscribe((event) => events.push(event.type))
    const connect = client.connect({ sessionId: session.id, ticket })
    await requestStarted
    await client.disconnect()
    const eventCountAtDisconnect = events.length
    releaseMicrophone({ getTracks: () => [{ stop: () => { stoppedTracks += 1 } }] } as MediaStream)
    await connect
    await new Promise((resolve) => setTimeout(resolve, 20))
    unsubscribe()
    const messages = runtime.getSession('owner', session.id).messages
    storage.dispose()
    return {
      state: client.getState(), stoppedTracks, eventCountAtDisconnect,
      eventCountAfterWait: events.length, messages: messages.length,
    }
  })
  expect(result).toEqual({
    state: 'idle', stoppedTracks: 1, eventCountAtDisconnect: 2,
    eventCountAfterWait: 2, messages: 0,
  })
})

test('audio ticket is bound to one session and expiry requires a fresh ticket', async ({ page }) => {
  await page.goto('/')
  const reasons = await page.evaluate(async () => {
    const [{ MockRuntime }, { MockStorage, MOCK_DATA_STORAGE_KEY }] = await Promise.all([
      import('/src/services/mock/mockRuntime.ts'),
      import('/src/services/mock/mockStorage.ts'),
    ])
    const storage = new MockStorage(localStorage)
    const runtime = new MockRuntime(storage)
    const first = await runtime.createSession('owner', {
      caseId: 'salary-review', mode: 'voice', clientCommandId: 'voice-one',
    })
    const second = await runtime.createSession('owner', {
      caseId: 'salary-review', mode: 'voice', clientCommandId: 'voice-two',
    })
    const ticket = await runtime.createAudioTicket('owner', first.id)
    const failures: string[] = []
    try { await runtime.consumeAudioTicket(second.id, ticket) } catch (error) {
      failures.push(error instanceof Error && 'reason' in error ? String(error.reason) : '')
    }
    const data = JSON.parse(localStorage.getItem(MOCK_DATA_STORAGE_KEY) ?? 'null') as {
      audioTickets: Array<{ expiresAt: string }>
    }
    data.audioTickets[0].expiresAt = new Date(Date.now() - 1_000).toISOString()
    localStorage.setItem(MOCK_DATA_STORAGE_KEY, JSON.stringify(data))
    try { await runtime.consumeAudioTicket(first.id, ticket) } catch (error) {
      failures.push(error instanceof Error && 'reason' in error ? String(error.reason) : '')
    }
    const fresh = await runtime.createAudioTicket('owner', first.id)
    const connection = await runtime.consumeAudioTicket(first.id, fresh)
    storage.dispose()
    return { failures, freshTicket: fresh.ticket !== ticket.ticket, connectedToOriginal: connection.sessionId === first.id }
  })
  expect(reasons).toEqual({
    failures: ['expired-audio-ticket', 'expired-audio-ticket'],
    freshTicket: true,
    connectedToOriginal: true,
  })
})
