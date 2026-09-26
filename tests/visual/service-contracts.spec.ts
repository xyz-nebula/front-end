import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

import { parseServiceConfig } from '../../src/services/config'
import { AudioEngineClient } from '../../src/services/real/audioEngineClient'
import { BackendNegotiationClient } from '../../src/services/real/backendNegotiationClient'
import {
  parseAudioEngineEvent,
  parseBackendError,
  parseCases,
  parseChatList,
  parseChatWithMessages,
  toActivateChatDto,
  toAudioControlDto,
  toAudioInputDto,
  toCreateChatDto,
} from '../../src/services/real/targetContract'
import { AUDIO_FORMAT } from '../../src/types/audio'
import { isServiceError } from '../../src/types/api'
import {
  audioInputFixture,
  audioEventFixtures,
  backendErrorFixture,
  chatFixture,
  chatListFixture,
} from '../fixtures/serviceContracts'

test('remote backend DTO fixtures validate and map to frontend naming', () => {
  const chat = parseChatWithMessages(chatFixture)
  const list = parseChatList(chatListFixture)

  expect(chat).toMatchObject({ id: chatFixture.uuid, name: 'Срок поставки', status: 'ongoing' })
  expect(chat.messages.map((message) => [message.sequence, message.speaker])).toEqual([
    [1, 'user'],
    [2, 'ai'],
  ])
  expect(list).toEqual(chatListFixture.map((item) => ({ id: item.uuid, name: item.name })))
  const backendError = parseBackendError(backendErrorFixture, 409)
  expect(backendError).toMatchObject({
    reason: 'http',
    status: 409,
    code: 'chat_not_found',
  })
})

test('target audio event fixtures validate and preserve event semantics', () => {
  const events = audioEventFixtures.map(parseAudioEngineEvent)

  expect(events.map((event) => event.type)).toEqual([
    'transcript_delta',
    'audio_frame',
    'error',
    'auth_error',
  ])
  expect(events[0]).toEqual({
    type: 'transcript_delta',
    speaker: 'user',
    text: 'Предлагаю согласовать',
  })
  expect(events[3]).toMatchObject({ code: 'expired_token' })

  expect(parseAudioEngineEvent({ type: 'transcript', role: 'assistant', text: ' ' })).toEqual({
    type: 'transcript_delta',
    speaker: 'ai',
    text: ' ',
  })
})

test('invalid DTO and event payloads fail with a typed invalid-response error', () => {
  for (const parse of [
    () => parseChatWithMessages({ ...chatFixture, messages: 'invalid' }),
    () => parseChatList([{ uuid: 'not-a-uuid', name: 'Chat' }]),
    () => parseAudioEngineEvent({ type: 'audio_frame', sequence: 1 }),
    () => parseAudioEngineEvent({ type: 'auth_error', code: 'unknown', message: 'No' }),
  ]) {
    expect(parse).toThrow(/Некорректный ответ сервиса/)
    try {
      parse()
    } catch (error) {
      expect(isServiceError(error)).toBe(true)
      if (isServiceError(error)) expect(error.reason).toBe('invalid-response')
    }
  }
})

test('request serializers keep the target snake_case boundary', () => {
  expect(toCreateChatDto('Срок поставки', chatFixture.uuid, '### Цель\nДоговориться')).toEqual({
    name: 'Срок поставки', case_uuid: chatFixture.uuid, preparations: '### Цель\nДоговориться',
  })
  expect(toActivateChatDto(chatFixture.uuid)).toEqual({ uuid: chatFixture.uuid })
  expect(toAudioInputDto(audioInputFixture.audio)).toEqual(audioInputFixture)
  expect(toAudioControlDto('pause')).toEqual({ type: 'control', action: 'pause' })
})

test('case parser normalizes public fields and does not expose ideal preparation', () => {
  const source = [{
    uuid: '00000000-0000-4000-8000-000000000010',
    created_at: '2026-09-26T10:00:00Z',
    name: 'Срок поставки', description: 'Описание', category: 'Продажи', difficulty: 'hard',
    time_limit: 10, preparations: 'Скрытая идеальная подготовка', goal: 'Цель', synopsis: 'Ситуация',
    first_role: 'Поставщик', second_role: 'Заказчик',
  }]
  const parsed = parseCases(source)
  expect(parsed[0]).toMatchObject({ id: source[0].uuid, name: source[0].name, firstRole: 'Поставщик', secondRole: 'Заказчик' })
  expect(parsed[0]).not.toHaveProperty('preparations')
})

test('service config requires explicit sources and rejects invalid values', () => {
  expect(parseServiceConfig({
    VITE_AUTH_SOURCE: 'mock',
    VITE_NEGOTIATION_SOURCE: 'real',
    VITE_AUDIO_SOURCE: 'mock',
  })).toMatchObject({
    authSource: 'mock',
    negotiationSource: 'real',
    audioSource: 'mock',
    audioWsUrl: '/audio/v1/audio-stream',
    apiTimeoutMs: 20_000,
    mockLatencyMs: 350,
  })

  expect(() => parseServiceConfig({})).toThrow(/VITE_AUTH_SOURCE/)
  expect(() => parseServiceConfig({
    VITE_AUTH_SOURCE: 'automatic',
    VITE_NEGOTIATION_SOURCE: 'mock',
    VITE_AUDIO_SOURCE: 'mock',
  })).toThrow(/VITE_AUTH_SOURCE/)
  expect(() => parseServiceConfig({
    VITE_AUTH_SOURCE: 'mock',
    VITE_NEGOTIATION_SOURCE: 'mock',
    VITE_AUDIO_SOURCE: 'real',
    VITE_AUDIO_WS_URL: 'wss://audio.example/v1/audio-stream',
  })).toThrow(/same-origin path/)
})

test('real negotiation client creates, activates, reads and lists remote chats', async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<{ url: string; method: string; body?: string }> = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    requests.push({ url, method: init?.method ?? 'GET', ...(init?.body ? { body: String(init.body) } : {}) })
    if (url.endsWith('/v1/chats/') && init?.method === 'POST') {
      return new Response(JSON.stringify({
        uuid: chatFixture.uuid,
        name: chatFixture.name,
        status: chatFixture.status,
        created_at: chatFixture.created_at,
      }), { status: 200 })
    }
    if (url.endsWith('/v1/chats/') && (init?.method ?? 'GET') === 'GET') {
      return new Response(JSON.stringify(chatListFixture), { status: 200 })
    }
    if (url.endsWith('/v1/chats/active')) return new Response(null, { status: 204 })
    const id = url.split('/').at(-1)
    const item = chatListFixture.find((candidate) => candidate.uuid === id)
    return new Response(JSON.stringify({
      ...chatFixture,
      uuid: item?.uuid ?? chatFixture.uuid,
      name: item?.name ?? chatFixture.name,
    }), { status: 200 })
  }

  try {
    const client = new BackendNegotiationClient(
      (operation) => operation('access-token'),
      { baseUrl: '/api', timeoutMs: 1_000 },
    )
    const created = await client.createSession({
      caseId: '00000000-0000-4000-8000-000000000001', caseName: 'Повышение зарплаты', mode: 'voice', clientCommandId: 'create-1', preparations: '# Стратегия\n\n### Цель\nДоговориться',
    })
    await client.activateSession(created.id)
    const loaded = await client.getSession(created.id)
    const listed = await client.listSessions()

    expect(created.mode).toBe('voice')
    expect(loaded.messages).toHaveLength(2)
    expect(listed).toHaveLength(2)
    expect(requests[0]).toMatchObject({
      url: '/api/v1/chats/', method: 'POST', body: JSON.stringify({ name: 'Повышение зарплаты', case_uuid: '00000000-0000-4000-8000-000000000001', preparations: '# Стратегия\n\n### Цель\nДоговориться' }),
    })
    expect(requests.some((request) => request.url === '/api/v1/chats/active' && request.method === 'PUT')).toBe(true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('real negotiation client requires authorization while demo-only operations remain local', async () => {
  const negotiation = new BackendNegotiationClient()
  const audio = new AudioEngineClient()

  const calls = [
    negotiation.createSession({ caseId: 'case-1', mode: 'text', clientCommandId: 'command-1', preparations: '' }),
    negotiation.getSession('session-1'),
    negotiation.sendTextTurn({ sessionId: 'session-1', text: 'Текст', clientTurnId: 'turn-1' }),
    negotiation.createAudioTicket('session-1'),
    negotiation.finishSession({ sessionId: 'session-1', clientCommandId: 'command-2' }),
    negotiation.getResult('session-1'),
    negotiation.listCases(),
    negotiation.listSessions(),
    audio.connect({ sessionId: 'session-1', ticket: {
      ticket: 'short-lived',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      protocol: 'audio-engine.v1',
    } }),
  ]
  const results = await Promise.allSettled(calls)

  expect(results).toHaveLength(9)
  expect(results[4].status).toBe('fulfilled')
  expect(results[5].status).toBe('fulfilled')
  for (const [index, result] of results.entries()) {
    if (index === 4 || index === 5) continue
    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') {
      expect(isServiceError(result.reason)).toBe(true)
      if (isServiceError(result.reason)) expect(result.reason.reason).toBe('feature-unavailable')
    }
  }
  expect(audio.getState()).toBe('idle')
  expect(() => audio.sendAudio({
    sequence: 1,
    timestamp: 1_795_507_202_000,
    format: AUDIO_FORMAT,
    payload: 'AAECAw==',
  })).toThrow(/недоступен/)
  expect(() => audio.sendControl('pause')).toThrow(/недоступен/)
  expect(audio.subscribe(() => undefined)()).toBeUndefined()
  expect(audio.subscribeState(() => undefined)()).toBeUndefined()
  await expect(audio.disconnect()).resolves.toBeUndefined()
})

test('real client uses HTTP only for implemented chat operations', async ({ page }) => {
  const domainRequests: string[] = []
  page.on('request', (request) => {
    if (/\/api\/v1\/chats\b/.test(request.url())) domainRequests.push(request.url())
  })
  page.on('websocket', (socket) => {
    if (socket.url().includes('/v1/audio-stream')) domainRequests.push(socket.url())
  })
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const [{ BackendNegotiationClient }, { AudioEngineClient }] = await Promise.all([
      import('/src/services/real/backendNegotiationClient.ts'),
      import('/src/services/real/audioEngineClient.ts'),
    ])
    const negotiation = new BackendNegotiationClient(async (operation) => operation('test-access-token'))
    const audio = new AudioEngineClient()
    const calls = [
      negotiation.createSession({ caseId: 'case-1', mode: 'text', clientCommandId: 'create-1', preparations: '' }),
      negotiation.getSession('session-1'),
      negotiation.sendTextTurn({ sessionId: 'session-1', text: 'Текст', clientTurnId: 'turn-1' }),
      negotiation.createAudioTicket('session-1'),
      negotiation.finishSession({ sessionId: 'session-1', clientCommandId: 'finish-1' }),
      negotiation.getResult('session-1'),
      negotiation.listCases(),
      negotiation.listSessions(),
      audio.connect({ sessionId: 'session-1', ticket: {
        ticket: 'short-lived', expiresAt: new Date(Date.now() + 60_000).toISOString(),
        protocol: 'audio-engine.v1',
      } }),
    ]
    const settled = await Promise.allSettled(calls)
    return settled.map((entry) => entry.status === 'rejected'
      ? (entry.reason as { reason?: string }).reason : 'resolved')
  })

  expect(result).toEqual(['http', 'http', 'feature-unavailable', 'feature-unavailable', 'resolved', 'resolved', 'http', 'http', 'feature-unavailable'])
  expect(domainRequests).toHaveLength(4)
})

test('pages and arena hooks depend only on service ports', async () => {
  for (const path of [
    'src/pages/ArenaPage.tsx',
    'src/pages/ResultPage.tsx',
    'src/pages/HomePage.tsx',
    'src/components/home/TrainingModal.tsx',
    'src/features/arena/useArenaSession.ts',
    'src/features/arena/useArenaAudio.ts',
  ]) {
    const source = await readFile(path, 'utf8')
    expect(source, path).not.toMatch(/from ['"]@\/services\/(mock|real)\//)
    expect(source, path).not.toMatch(/\b(import\.meta\.env|\/v1\/chat\/|is_ai)\b/)
  }
})
