import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import {
  negotiationResultPollingPolicy,
  useNegotiationResult,
  type NegotiationResultPollingPolicy,
} from '@/features/result/useNegotiationResult'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import type { NegotiationResultState, NegotiationSession } from '@/types/negotiation'

const processing: NegotiationResultState = { status: 'processing' }
const ready: NegotiationResultState = {
  status: 'ready',
  result: {
    sessionId: 'ready-session',
    source: 'mock',
    outcome: { status: 'failed', reason: 'analysis-unavailable' },
    judges: [
      { college: 'hiring', status: 'failed', reason: 'unavailable' },
      { college: 'negotiation', status: 'failed', reason: 'unavailable' },
      { college: 'ownership', status: 'failed', reason: 'unavailable' },
    ],
    trainer: { status: 'failed', reason: 'unavailable' },
  },
}
const unavailable = async (): Promise<never> => { throw new Error('Unexpected call') }

function session(id: string): NegotiationSession {
  return {
    id,
    caseId: 'case-1',
    mode: 'text',
    status: 'finished',
    startedAt: '2026-09-28T10:00:00.000Z',
    finishedAt: '2026-09-28T10:01:00.000Z',
    messages: [],
  }
}

function client(overrides: Partial<NegotiationClient>): NegotiationClient {
  return {
    createSession: unavailable,
    listCases: unavailable,
    getSession: unavailable,
    activateSession: unavailable,
    sendTextTurn: unavailable,
    createAudioTicket: unavailable,
    finishSession: unavailable,
    getResult: unavailable,
    listSessions: unavailable,
    ...overrides,
  }
}

interface MountedHook {
  root: Root
  retry: () => void
  setSessionId: (sessionId: string) => Promise<void>
  snapshot: () => ReturnType<typeof useNegotiationResult>
}

async function flush(milliseconds = 0) {
  await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, milliseconds)) })
}

async function mountHook(
  negotiationClient: NegotiationClient,
  policy: NegotiationResultPollingPolicy,
  initialSessionId = 'session-1',
): Promise<MountedHook> {
  const host = document.createElement('div')
  const root = createRoot(host)
  let sessionId = initialSessionId
  let current: ReturnType<typeof useNegotiationResult> | null = null
  function Probe() {
    current = useNegotiationResult(negotiationClient, sessionId, policy)
    return null
  }
  await act(async () => { root.render(<Probe />) })
  return {
    root,
    retry: () => (current as unknown as ReturnType<typeof useNegotiationResult>).retry(),
    setSessionId: async (nextSessionId) => {
      sessionId = nextSessionId
      await act(async () => { root.render(<Probe />) })
    },
    snapshot: () => current as unknown as ReturnType<typeof useNegotiationResult>,
  }
}

const fastPolicy: NegotiationResultPollingPolicy = {
  initialDelaysMs: [10, 20, 30],
  intervalMs: 40,
  deadlineMs: 120,
}

export async function runResultPollingResilienceScenario() {
  let pollCalls = 0
  const polling = await mountHook(client({
    getSession: (sessionId) => Promise.resolve(session(sessionId)),
    getResult: () => {
      pollCalls += 1
      return Promise.resolve(pollCalls === 5 ? ready : processing)
    },
  }), fastPolicy)
  await flush(115)
  const pollingResult = { calls: pollCalls, status: polling.snapshot().result?.status }
  await act(async () => polling.root.unmount())

  let resolveOldResult!: (value: NegotiationResultState) => void
  const oldResult = new Promise<NegotiationResultState>((resolve) => { resolveOldResult = resolve })
  const switched = await mountHook(client({
    getSession: (sessionId) => Promise.resolve(session(sessionId)),
    getResult: (sessionId) => sessionId === 'old' ? oldResult : Promise.resolve(ready),
  }), fastPolicy, 'old')
  await flush()
  await switched.setSessionId('new')
  await flush()
  resolveOldResult({ status: 'failed', message: 'Устаревший результат' })
  await flush()
  const switchedResult = {
    result: switched.snapshot().result?.status,
    session: switched.snapshot().session?.id,
  }
  await act(async () => switched.root.unmount())

  let resolveFirstRequest!: (value: NegotiationResultState) => void
  const firstRequest = new Promise<NegotiationResultState>((resolve) => { resolveFirstRequest = resolve })
  let activeRequests = 0
  let maximumActiveRequests = 0
  let deduplicatedCalls = 0
  const deduplicated = await mountHook(client({
    getSession: (sessionId) => Promise.resolve(session(sessionId)),
    getResult: async () => {
      deduplicatedCalls += 1
      activeRequests += 1
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests)
      const value = deduplicatedCalls === 1 ? await firstRequest : ready
      activeRequests -= 1
      return value
    },
  }), fastPolicy)
  await flush()
  await act(async () => deduplicated.retry())
  await flush()
  resolveFirstRequest(processing)
  await flush(15)
  const deduplicationResult = {
    calls: deduplicatedCalls,
    maximumActiveRequests,
    status: deduplicated.snapshot().result?.status,
  }
  await act(async () => deduplicated.root.unmount())

  let deadlineCalls = 0
  let deadlinePassed = false
  const deadlinePolicy: NegotiationResultPollingPolicy = {
    initialDelaysMs: [5],
    intervalMs: 10,
    deadlineMs: 25,
  }
  const deadline = await mountHook(client({
    getSession: (sessionId) => Promise.resolve(session(sessionId)),
    getResult: () => {
      deadlineCalls += 1
      return Promise.resolve(deadlinePassed ? ready : processing)
    },
  }), deadlinePolicy)
  await flush(35)
  const deadlineResult = {
    error: deadline.snapshot().error,
    processingStatus: deadline.snapshot().result?.status,
  }
  deadlinePassed = true
  await act(async () => deadline.retry())
  await flush()
  const retriedResult = {
    calls: deadlineCalls,
    error: deadline.snapshot().error,
    status: deadline.snapshot().result?.status,
  }
  await act(async () => deadline.root.unmount())

  let unmountedCalls = 0
  const unmounted = await mountHook(client({
    getSession: (sessionId) => Promise.resolve(session(sessionId)),
    getResult: () => {
      unmountedCalls += 1
      return Promise.resolve(processing)
    },
  }), fastPolicy)
  await flush()
  await act(async () => unmounted.root.unmount())
  await flush(20)

  return {
    defaultPolicy: negotiationResultPollingPolicy,
    polling: pollingResult,
    switched: switchedResult,
    deduplication: deduplicationResult,
    deadline: deadlineResult,
    retried: retriedResult,
    unmountedCalls,
  }
}
