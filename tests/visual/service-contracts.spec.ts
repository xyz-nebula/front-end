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
  parseEvaluateTrigger,
  parseEvaluationResult,
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
  evaluateTriggerFixture,
  evaluationResultFixture,
  evaluationSessionFixture,
} from '../fixtures/serviceContracts'

test('remote backend DTO fixtures validate and map to frontend naming', () => {
  const chat = parseChatWithMessages(chatFixture)
  const list = parseChatList(chatListFixture)

  expect(chat).toMatchObject({ id: chatFixture.uuid, name: 'Срок поставки', status: 'ongoing' })
  expect(chat).toMatchObject({ selectedRole: 0, preparations: chatFixture.preparations })
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

test('evaluation parser validates the complete 2.0.0-rc.1 payload', () => {
  expect(parseEvaluateTrigger(evaluateTriggerFixture)).toEqual({
    jobId: evaluateTriggerFixture.job_uuid,
    status: 'pending',
  })

  const parsed = parseEvaluationResult(evaluationResultFixture, evaluationSessionFixture)
  expect(parsed.status).toBe('ready')
  if (parsed.status !== 'ready') return
  expect(parsed.result.source).toBe('server')
  expect(parsed.result.contractVersion).toBe('2.0.0-rc.1')
  expect(parsed.result.outcome.status).toBe('ready')
  if (parsed.result.outcome.status === 'ready') expect(parsed.result.outcome.kind).toBe('partial-agreement')
  expect(parsed.result.judges.map((slot) => slot.college)).toEqual([
    'hiring', 'negotiation', 'ownership',
  ])
  expect(parsed.result.judges[0].status).toBe('ready')
  if (parsed.result.judges[0].status === 'ready') expect(parsed.result.judges[0].verdict.choice).toBe('user')
  expect(parsed.result.trainer.status).toBe('ready')
  if (parsed.result.trainer.status === 'ready') {
    expect(parsed.result.trainer.feedback.nextTry).toHaveLength(2)
    expect(parsed.result.trainer.feedback.goalAssessment.status).toBe('partially-achieved')
  }
})

test('evaluation parser maps consistent job states without exposing backend errors', () => {
  expect(parseEvaluationResult(
    { status: 'processing', result: null, error: null },
    evaluationSessionFixture,
  )).toEqual({ status: 'processing' })
  expect(parseEvaluationResult(
    { status: 'failed', result: null, error: 'provider timeout: internal details' },
    evaluationSessionFixture,
  )).toEqual({ status: 'failed', message: 'Не удалось подготовить разбор переговоров.' })
})

test('evaluation parser preserves valid failed slots and nullable analysis fields', () => {
  const partialFailure = structuredClone(evaluationResultFixture)
  partialFailure.result.outcome.status = 'failed'
  partialFailure.result.outcome.assessment = null
  partialFailure.result.outcome.error_code = 'outcome_analysis_unavailable'
  partialFailure.result.judge_verdicts[0].status = 'failed'
  partialFailure.result.judge_verdicts[0].verdict = null
  partialFailure.result.judge_verdicts[0].error_code = 'insufficient_evidence'
  partialFailure.result.trainer_feedback.status = 'failed'
  partialFailure.result.trainer_feedback.feedback = null
  partialFailure.result.trainer_feedback.error_code = 'trainer_unavailable'

  const parsed = parseEvaluationResult(partialFailure, evaluationSessionFixture)
  expect(parsed.status).toBe('ready')
  if (parsed.status !== 'ready') return
  expect(parsed.result.outcome).toEqual({ status: 'failed', reason: 'analysis-unavailable' })
  expect(parsed.result.judges[0]).toEqual({ college: 'hiring', status: 'failed', reason: 'insufficient-evidence' })
  expect(parsed.result.trainer).toEqual({ status: 'failed', reason: 'unavailable' })

  const nullable = structuredClone(evaluationResultFixture)
  const feedback = nullable.result.trainer_feedback.feedback
  if (feedback) {
    feedback.plan_vs_reality = null
    feedback.goal_assessment.goal_text = null
    feedback.goal_assessment.status = 'not_assessable'
  }
  const nullableParsed = parseEvaluationResult(nullable, evaluationSessionFixture)
  expect(nullableParsed.status).toBe('ready')
  if (nullableParsed.status === 'ready' && nullableParsed.result.trainer.status === 'ready') {
    expect(nullableParsed.result.trainer.feedback.planVsReality).toBeNull()
    expect(nullableParsed.result.trainer.feedback.goalAssessment.goalText).toBeNull()
    expect(nullableParsed.result.trainer.feedback.goalAssessment.status).toBe('not-assessable')
  }
})

test('evaluation parser rejects incompatible versions, evidence and slot combinations', () => {
  const incompatibleVersion = structuredClone(evaluationResultFixture)
  incompatibleVersion.result.contract_version = '2.0.0' as '2.0.0-rc.1'

  const wrongSpeaker = structuredClone(evaluationResultFixture)
  const assessment = wrongSpeaker.result.outcome.assessment
  if (assessment) assessment.evidence[0].is_ai = true

  const duplicateCollege = structuredClone(evaluationResultFixture)
  duplicateCollege.result.judge_verdicts[1].college = 'hiring'
  const duplicateVerdict = duplicateCollege.result.judge_verdicts[1].verdict
  if (duplicateVerdict) duplicateVerdict.college = 'hiring'

  const invalidPlanEvidence = structuredClone(evaluationResultFixture)
  const plan = invalidPlanEvidence.result.trainer_feedback.feedback?.plan_vs_reality
  if (plan?.items[0].evidence) plan.items[0].evidence = null

  for (const value of [
    incompatibleVersion,
    wrongSpeaker,
    duplicateCollege,
    invalidPlanEvidence,
    { status: 'done', result: null, error: null },
    { status: 'processing', result: evaluationResultFixture.result, error: null },
  ]) {
    expect(() => parseEvaluationResult(value, evaluationSessionFixture)).toThrow(/Некорректный ответ сервиса/)
  }
})

test('request serializers keep the target snake_case boundary', () => {
  expect(toCreateChatDto('Срок поставки', chatFixture.uuid, '### Цель\nДоговориться', 1)).toEqual({
    name: 'Срок поставки', case_uuid: chatFixture.uuid, preparations: '### Цель\nДоговориться', selected_role: 1,
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
    time_limit: 10, goal: 'Цель', synopsis: 'Ситуация',
    first_role: 'Поставщик', second_role: 'Заказчик',
    first_role_preparations: 'Скрытая подготовка поставщика',
    second_role_preparations: 'Скрытая подготовка заказчика',
  }]
  const parsed = parseCases(source)
  expect(parsed[0]).toMatchObject({
    id: source[0].uuid,
    name: source[0].name,
    timeLimit: 10,
    firstRole: 'Поставщик',
    secondRole: 'Заказчик',
  })
  expect(parsed[0]).not.toHaveProperty('firstRolePreparations')
  expect(parsed[0]).not.toHaveProperty('secondRolePreparations')
})

test('real negotiation client converts case time limits from seconds to rounded-up minutes', async () => {
  const originalFetch = globalThis.fetch
  const cases = [600, 610].map((timeLimit, index) => ({
    uuid: `00000000-0000-4000-8000-00000000001${index}`,
    created_at: '2026-09-26T10:00:00Z',
    name: `Кейс ${index + 1}`,
    description: 'Описание',
    category: 'Продажи',
    difficulty: 'medium',
    time_limit: timeLimit,
    goal: 'Цель',
    synopsis: 'Ситуация',
    first_role: 'Поставщик',
    second_role: 'Заказчик',
    first_role_preparations: 'Скрытая подготовка поставщика',
    second_role_preparations: 'Скрытая подготовка заказчика',
  }))
  globalThis.fetch = async () => new Response(JSON.stringify(cases), { status: 200 })

  try {
    const client = new BackendNegotiationClient(
      (operation) => operation('access-token'),
      { baseUrl: '/api', timeoutMs: 1_000 },
    )

    const result = await client.listCases()

    expect(cases.map((item) => item.time_limit)).toEqual([600, 610])
    expect(result.map((item) => item.duration)).toEqual(['10 мин', '11 мин'])
  } finally {
    globalThis.fetch = originalFetch
  }
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
        selected_role: chatFixture.selected_role,
        preparations: chatFixture.preparations,
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
      caseId: '00000000-0000-4000-8000-000000000001', caseName: 'Повышение зарплаты', mode: 'voice', clientCommandId: 'create-1', preparations: '# Стратегия\n\n### Цель\nДоговориться', selectedRole: 1,
    })
    await client.activateSession(created.id)
    const loaded = await client.getSession(created.id)
    const listed = await client.listSessions()

    expect(created.mode).toBe('voice')
    expect(loaded.messages).toHaveLength(2)
    expect(listed).toHaveLength(2)
    expect(requests[0]).toMatchObject({
      url: '/api/v1/chats/', method: 'POST', body: JSON.stringify({ name: 'Повышение зарплаты', case_uuid: '00000000-0000-4000-8000-000000000001', preparations: '# Стратегия\n\n### Цель\nДоговориться', selected_role: 1 }),
    })
    expect(requests.some((request) => request.url === '/api/v1/chats/active' && request.method === 'PUT')).toBe(true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('real negotiation client starts evaluation without a request body and reads pending state', async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<{ url: string; method: string; body: BodyInit | null | undefined }> = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    requests.push({ url, method: init?.method ?? 'GET', body: init?.body })
    if (url.endsWith('/evaluate')) {
      return new Response(JSON.stringify(evaluateTriggerFixture), { status: 202 })
    }
    return new Response(JSON.stringify({ status: 'pending', result: null, error: null }), { status: 200 })
  }

  try {
    const client = new BackendNegotiationClient(
      (operation) => operation('access-token'),
      { baseUrl: '/api', timeoutMs: 1_000 },
    )

    await expect(client.finishSession({
      sessionId: chatFixture.uuid,
      clientCommandId: 'finish-command-not-sent',
    })).resolves.toEqual({ status: 'processing' })
    await expect(client.getResult(chatFixture.uuid)).resolves.toEqual({ status: 'processing' })

    expect(requests).toEqual([
      {
        url: `/api/v1/chats/${chatFixture.uuid}/evaluate`,
        method: 'POST',
        body: undefined,
      },
      {
        url: `/api/v1/chats/${chatFixture.uuid}/result`,
        method: 'GET',
        body: undefined,
      },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('real negotiation client recovers already-running evaluation and sanitizes endpoint errors', async () => {
  const originalFetch = globalThis.fetch
  const responses = [
    new Response(JSON.stringify({
      code: 'already_evaluating',
      message: 'Internal evaluation job detail',
    }), { status: 409 }),
    new Response(JSON.stringify({
      code: 'chat_not_found',
      message: 'Internal chat lookup detail',
    }), { status: 404 }),
  ]
  globalThis.fetch = async () => responses.shift() ?? new Response(null, { status: 500 })

  try {
    const client = new BackendNegotiationClient(
      (operation) => operation('access-token'),
      { baseUrl: '/api', timeoutMs: 1_000 },
    )

    await expect(client.finishSession({
      sessionId: chatFixture.uuid,
      clientCommandId: 'finish-1',
    })).resolves.toEqual({ status: 'processing' })

    const rejected: unknown = await client.finishSession({
      sessionId: chatFixture.uuid,
      clientCommandId: 'finish-2',
    }).then(() => null, (error: unknown) => error)
    expect(rejected).toMatchObject({
      message: 'Переговоры не найдены.',
      reason: 'http',
      status: 404,
      code: 'chat_not_found',
    })
    expect(rejected).not.toHaveProperty('message', 'Internal chat lookup detail')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('real negotiation client parses a completed server result against the remote transcript', async () => {
  const originalFetch = globalThis.fetch
  const requests: string[] = []
  globalThis.fetch = async (input) => {
    const url = String(input)
    requests.push(url)
    if (url.endsWith('/result')) {
      return new Response(JSON.stringify(evaluationResultFixture), { status: 200 })
    }
    return new Response(JSON.stringify(chatFixture), { status: 200 })
  }

  try {
    const client = new BackendNegotiationClient(
      (operation) => operation('access-token'),
      { baseUrl: '/api', timeoutMs: 1_000 },
    )
    const result = await client.getResult(chatFixture.uuid)

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.result).toMatchObject({
        sessionId: chatFixture.uuid,
        source: 'server',
        contractVersion: '2.0.0-rc.1',
      })
    }
    expect(requests).toEqual([
      `/api/v1/chats/${chatFixture.uuid}/result`,
      `/api/v1/chats/${chatFixture.uuid}`,
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('real negotiation client hides failed job details and reports a missing evaluation', async () => {
  const originalFetch = globalThis.fetch
  const responses = [
    new Response(JSON.stringify({
      status: 'failed', result: null, error: 'Provider token and internal trace',
    }), { status: 200 }),
    new Response(JSON.stringify({
      code: 'evaluation_not_found', message: 'Internal lookup detail',
    }), { status: 404 }),
  ]
  globalThis.fetch = async () => responses.shift() ?? new Response(null, { status: 500 })

  try {
    const client = new BackendNegotiationClient(
      (operation) => operation('access-token'),
      { baseUrl: '/api', timeoutMs: 1_000 },
    )

    await expect(client.getResult(chatFixture.uuid)).resolves.toEqual({
      status: 'failed',
      message: 'Не удалось подготовить разбор переговоров.',
    })
    await expect(client.getResult(chatFixture.uuid)).resolves.toEqual({
      status: 'failed',
      message: 'Разбор переговоров ещё не запускался.',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('real negotiation client requires authorization for backend evaluation operations', async () => {
  const negotiation = new BackendNegotiationClient()
  const audio = new AudioEngineClient()

  const calls = [
    negotiation.createSession({ caseId: 'case-1', mode: 'text', clientCommandId: 'command-1', preparations: '', selectedRole: 0 }),
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
  for (const result of results) {
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
      negotiation.createSession({ caseId: 'case-1', mode: 'text', clientCommandId: 'create-1', preparations: '', selectedRole: 0 }),
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

  expect(result).toEqual(['http', 'http', 'feature-unavailable', 'feature-unavailable', 'http', 'http', 'http', 'http', 'feature-unavailable'])
  expect(domainRequests).toHaveLength(6)
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
