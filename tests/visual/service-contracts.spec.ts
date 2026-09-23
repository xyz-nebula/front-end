import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

import { parseServiceConfig } from '../../src/services/config'
import { AudioEngineClient } from '../../src/services/real/audioEngineClient'
import { BackendNegotiationClient } from '../../src/services/real/backendNegotiationClient'
import {
  parseAudioEngineEvent,
  parseAudioTicket,
  parseBackendError,
  parseNegotiationResultState,
  parseNegotiationSession,
  parseSessionList,
  parseTextTurnResult,
  toAudioInputFrameDto,
  toCreateSessionDto,
  toTextTurnDto,
} from '../../src/services/real/targetContract'
import { AUDIO_FORMAT } from '../../src/types/audio'
import { isServiceError } from '../../src/types/api'
import {
  audioEventFixtures,
  audioTicketFixture,
  backendErrorFixture,
  resultFixtures,
  sessionFixture,
  sessionListFixture,
  textTurnFixture,
  transcriptCommitFixture,
} from '../fixtures/serviceContracts'

test('target backend DTO fixtures validate and map to camelCase', () => {
  const session = parseNegotiationSession(sessionFixture)
  const turn = parseTextTurnResult(textTurnFixture)
  const ticket = parseAudioTicket(audioTicketFixture)
  const resultStates = resultFixtures.map(parseNegotiationResultState)
  const sessions = parseSessionList(sessionListFixture)

  expect(session.caseId).toBe('supplier-deadline')
  expect(session.messages.map((message) => message.sequence)).toEqual([1, 2])
  expect(turn.userMessage.speaker).toBe('user')
  expect(turn.aiMessage.speaker).toBe('ai')
  expect(ticket).toEqual({
    ticket: audioTicketFixture.ticket,
    expiresAt: audioTicketFixture.expires_at,
    protocol: 'audio-engine.v1',
  })
  expect(resultStates.map((state) => state.status)).toEqual(['processing', 'ready', 'failed'])
  expect(sessions[0].finishedAt).toBe(sessionListFixture[0].finished_at)
  const backendError = parseBackendError(backendErrorFixture, 409)
  expect(backendError).toMatchObject({
    reason: 'http',
    status: 409,
    code: 'SESSION_ALREADY_FINISHED',
    field: 'session_id',
  })
  expect(transcriptCommitFixture.event_id).toBe('audio-event-1')
})

test('target audio event fixtures validate and preserve event semantics', () => {
  const events = audioEventFixtures.map(parseAudioEngineEvent)

  expect(events.map((event) => event.type)).toEqual([
    'transcript_partial',
    'message_committed',
    'audio_frame',
    'error',
    'closed',
  ])
  expect(events[0]).toEqual({
    type: 'transcript_partial',
    speaker: 'user',
    text: 'Предлагаю согласовать',
  })
  expect(events[1]).toMatchObject({ eventId: 'audio-event-1' })
  expect(events[4]).toMatchObject({ reconnectAllowed: true })
})

test('invalid DTO and event payloads fail with a typed invalid-response error', () => {
  for (const parse of [
    () => parseNegotiationSession({ ...sessionFixture, messages: 'invalid' }),
    () => parseAudioTicket({ ...audioTicketFixture, protocol: 'legacy' }),
    () => parseAudioEngineEvent({ type: 'audio_frame', sequence: 1 }),
    () => parseNegotiationResultState({ status: 'ready' }),
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
  expect(toCreateSessionDto({ caseId: 'case-1', mode: 'voice' })).toEqual({
    case_id: 'case-1',
    mode: 'voice',
  })
  expect(toTextTurnDto('Добрый день')).toEqual({ text: 'Добрый день' })
  expect(toAudioInputFrameDto({
    sequence: 1,
    timestamp: 1_795_507_202_000,
    format: AUDIO_FORMAT,
    payload: 'AAECAw==',
  })).toEqual({
    type: 'audio_input',
    sequence: 1,
    timestamp: 1_795_507_202_000,
    format: { codec: 'pcm_s16le', sample_rate: 24_000, channels: 1, bit_depth: 16 },
    payload: 'AAECAw==',
  })
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
    apiTimeoutMs: 20_000,
    mockLatencyMs: 350,
  })

  expect(() => parseServiceConfig({})).toThrow(/VITE_AUTH_SOURCE/)
  expect(() => parseServiceConfig({
    VITE_AUTH_SOURCE: 'automatic',
    VITE_NEGOTIATION_SOURCE: 'mock',
    VITE_AUDIO_SOURCE: 'mock',
  })).toThrow(/VITE_AUTH_SOURCE/)
})

test('real negotiation and audio stubs return feature-unavailable without network work', async () => {
  const negotiation = new BackendNegotiationClient()
  const audio = new AudioEngineClient()

  const calls = [
    negotiation.createSession({ caseId: 'case-1', mode: 'text', clientCommandId: 'command-1' }),
    negotiation.getSession('session-1'),
    negotiation.sendTextTurn({ sessionId: 'session-1', text: 'Текст', clientTurnId: 'turn-1' }),
    negotiation.createAudioTicket('session-1'),
    negotiation.finishSession({ sessionId: 'session-1', clientCommandId: 'command-2' }),
    negotiation.getResult('session-1'),
    negotiation.listSessions(),
    audio.connect({ sessionId: 'session-1', ticket: parseAudioTicket(audioTicketFixture) }),
  ]
  const results = await Promise.allSettled(calls)

  expect(results).toHaveLength(8)
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

test('real stubs make no HTTP or WebSocket requests in the browser', async ({ page }) => {
  const domainRequests: string[] = []
  page.on('request', (request) => {
    if (/\/api\/v1\/(negotiations|chat)\b/.test(request.url())) domainRequests.push(request.url())
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
      negotiation.createSession({ caseId: 'case-1', mode: 'text', clientCommandId: 'create-1' }),
      negotiation.getSession('session-1'),
      negotiation.sendTextTurn({ sessionId: 'session-1', text: 'Текст', clientTurnId: 'turn-1' }),
      negotiation.createAudioTicket('session-1'),
      negotiation.finishSession({ sessionId: 'session-1', clientCommandId: 'finish-1' }),
      negotiation.getResult('session-1'),
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

  expect(result).toEqual(Array(8).fill('feature-unavailable'))
  expect(domainRequests).toEqual([])
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
