import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'

import { useArenaSession } from '@/features/arena/useArenaSession'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import { DomainServicesContext } from '@/services/domainServices'
import type {
  NegotiationResultState,
  NegotiationSession,
  TextTurnResult,
} from '@/types/negotiation'

type ArenaValue = ReturnType<typeof useArenaSession>

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: Error) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function session(id: string, caseId = 'salary-review'): NegotiationSession {
  return {
    id,
    caseId,
    mode: 'text',
    status: 'active',
    startedAt: '2026-09-23T08:00:00.000Z',
    messages: [],
  }
}

function turnResult(sessionId: string, text: string): TextTurnResult {
  return {
    userMessage: {
      id: `${sessionId}-user`, sequence: 1, speaker: 'user', text,
      createdAt: '2026-09-23T08:01:00.000Z',
    },
    aiMessage: {
      id: `${sessionId}-ai`, sequence: 2, speaker: 'ai', text: `Ответ ${sessionId}`,
      createdAt: '2026-09-23T08:01:01.000Z',
    },
    sessionStatus: 'active',
  }
}

function client(overrides: Partial<NegotiationClient>): NegotiationClient {
  const unavailable = async (): Promise<never> => {
    throw new Error('Unexpected negotiation client call')
  }
  return {
    createSession: unavailable,
    getSession: unavailable,
    sendTextTurn: unavailable,
    createAudioTicket: unavailable,
    finishSession: unavailable,
    getResult: unavailable,
    listSessions: unavailable,
    ...overrides,
  }
}

interface MountedHarness {
  value: () => ArenaValue
  render: (sessionId: string, negotiationClient: NegotiationClient) => Promise<void>
  flush: () => Promise<void>
  dispose: () => Promise<void>
}

async function mountHarness(
  initialSessionId: string,
  initialClient: NegotiationClient,
): Promise<MountedHarness> {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let latest: ArenaValue | null = null

  function Probe({ sessionId }: { sessionId: string }) {
    const value = useArenaSession(sessionId)
    useLayoutEffect(() => { latest = value }, [value])
    return null
  }

  const render = async (sessionId: string, negotiationClient: NegotiationClient) => {
    await act(async () => {
      root.render(
        <DomainServicesContext.Provider value={{
          negotiationClient,
          createAudioClient: () => { throw new Error('Audio is not used by this harness') as never },
        }}>
          <Probe sessionId={sessionId} />
        </DomainServicesContext.Provider>,
      )
    })
  }

  const flush = async () => {
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 5))
    })
  }

  await render(initialSessionId, initialClient)
  await flush()
  return {
    value: () => {
      if (!latest) throw new Error('Arena harness has not rendered')
      return latest
    },
    render,
    flush,
    dispose: async () => {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
        .IS_REACT_ACT_ENVIRONMENT = false
    },
  }
}

async function waitFor(
  harness: MountedHarness,
  predicate: (value: ArenaValue) => boolean,
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await harness.flush()
    if (predicate(harness.value())) return
  }
  throw new Error('Arena harness condition timed out')
}

export async function runLateLoadScenario() {
  const loadA = deferred<NegotiationSession>()
  const firstClient = client({
    getSession: (sessionId) => sessionId === 'arena-a'
      ? loadA.promise
      : Promise.resolve(session(sessionId)),
  })
  sessionStorage.setItem('arena.pending-turn.arena-a', JSON.stringify({
    id: 'pending-a', text: 'Черновик A',
  }))
  const harness = await mountHarness('arena-a', firstClient)
  await harness.render('arena-b', firstClient)
  await waitFor(harness, (value) => value.session?.id === 'arena-b')
  await act(async () => {
    loadA.resolve(session('arena-a'))
    await Promise.resolve()
  })
  const afterSessionChange = {
    sessionId: harness.value().session?.id,
    draft: harness.value().draft,
    viewState: harness.value().viewState,
  }

  const oldClientLoad = deferred<NegotiationSession>()
  const oldClient = client({ getSession: () => oldClientLoad.promise })
  const newClient = client({ getSession: () => Promise.resolve(session('shared-arena', 'supplier-deadline')) })
  await harness.render('shared-arena', oldClient)
  await harness.flush()
  await harness.render('shared-arena', newClient)
  await waitFor(harness, (value) => value.session?.caseId === 'supplier-deadline')
  await act(async () => {
    oldClientLoad.resolve(session('shared-arena', 'salary-review'))
    await Promise.resolve()
  })
  const afterClientChange = {
    sessionId: harness.value().session?.id,
    caseId: harness.value().session?.caseId,
  }
  await harness.dispose()
  return { afterSessionChange, afterClientChange }
}

export async function runLateTurnScenario() {
  const turnA = deferred<TextTurnResult>()
  const turnB = deferred<TextTurnResult>()
  const calls: Array<{ sessionId: string; commandId: string }> = []
  const negotiationClient = client({
    getSession: (sessionId) => Promise.resolve(session(sessionId)),
    sendTextTurn: (input) => {
      calls.push({ sessionId: input.sessionId, commandId: input.clientTurnId })
      return input.sessionId === 'arena-a' ? turnA.promise : turnB.promise
    },
  })
  const harness = await mountHarness('arena-a', negotiationClient)
  await waitFor(harness, (value) => value.viewState === 'ready')
  await act(async () => harness.value().setDraft('Реплика A'))
  await act(async () => { void harness.value().sendTextTurn() })
  await harness.flush()

  await harness.render('arena-b', negotiationClient)
  await waitFor(harness, (value) => value.viewState === 'ready')
  await act(async () => harness.value().setDraft('Реплика B'))
  await act(async () => { void harness.value().sendTextTurn() })
  await harness.flush()

  await act(async () => {
    turnA.reject(new Error('Старая ошибка A'))
    await Promise.resolve()
  })
  await act(async () => harness.value().setDraft('Повтор B'))
  await act(async () => { await harness.value().sendTextTurn() })
  const callsBeforeBCompletes = [...calls]

  await act(async () => {
    turnB.resolve(turnResult('arena-b', 'Реплика B'))
    await Promise.resolve()
  })
  await waitFor(harness, (value) => value.turnState === 'idle')
  const result = {
    callsBeforeBCompletes,
    sessionId: harness.value().session?.id,
    messageIds: harness.value().session?.messages.map((message) => message.id),
    error: harness.value().error,
    pendingA: sessionStorage.getItem('arena.pending-turn.arena-a'),
    pendingB: sessionStorage.getItem('arena.pending-turn.arena-b'),
  }
  await harness.dispose()
  return result
}

export async function runLateFinishScenario() {
  const finishA = deferred<NegotiationResultState>()
  const finishB = deferred<NegotiationResultState>()
  const calls: string[] = []
  const negotiationClient = client({
    getSession: (sessionId) => Promise.resolve(session(sessionId)),
    finishSession: (input) => {
      calls.push(input.sessionId)
      return input.sessionId === 'arena-a' ? finishA.promise : finishB.promise
    },
  })
  const harness = await mountHarness('arena-a', negotiationClient)
  await waitFor(harness, (value) => value.viewState === 'ready')
  await act(async () => { void harness.value().finishSession() })
  await harness.flush()
  await harness.render('arena-b', negotiationClient)
  await waitFor(harness, (value) => value.viewState === 'ready')
  await act(async () => { void harness.value().finishSession() })
  await harness.flush()

  await act(async () => {
    finishA.resolve({ status: 'processing' })
    await Promise.resolve()
  })
  await act(async () => { await harness.value().finishSession() })
  const beforeBCompletes = { calls: [...calls], viewState: harness.value().viewState }

  await act(async () => {
    finishB.resolve({ status: 'processing' })
    await Promise.resolve()
  })
  await waitFor(harness, (value) => value.viewState === 'finished')
  await harness.dispose()
  return beforeBCompletes
}

export async function runPendingRecoveryScenario() {
  const turnCalls: string[] = []
  const finishCalls: string[] = []
  sessionStorage.setItem('arena.pending-turn.turn-arena', JSON.stringify({
    id: 'original-turn-id', text: 'Восстановленная реплика',
  }))
  sessionStorage.setItem('arena.pending-finish.finish-arena', 'original-finish-id')
  const negotiationClient = client({
    getSession: (sessionId) => Promise.resolve(session(sessionId)),
    sendTextTurn: (input) => {
      turnCalls.push(input.clientTurnId)
      return Promise.resolve(turnResult(input.sessionId, input.text))
    },
    finishSession: (input) => {
      finishCalls.push(input.clientCommandId)
      return Promise.resolve({ status: 'processing' })
    },
  })
  const harness = await mountHarness('turn-arena', negotiationClient)
  await waitFor(harness, (value) => value.session?.messages.length === 2)
  await harness.render('finish-arena', negotiationClient)
  await waitFor(harness, (value) => value.viewState === 'finished')
  const result = {
    turnCalls,
    finishCalls,
    pendingTurn: sessionStorage.getItem('arena.pending-turn.turn-arena'),
    pendingFinish: sessionStorage.getItem('arena.pending-finish.finish-arena'),
  }
  await harness.dispose()
  return result
}

export async function runFinishRetryScenario() {
  const finishCalls: string[] = []
  let attempt = 0
  const negotiationClient = client({
    getSession: (sessionId) => Promise.resolve(session(sessionId)),
    finishSession: (input) => {
      finishCalls.push(input.clientCommandId)
      attempt += 1
      return attempt === 1
        ? Promise.resolve({ status: 'failed', message: 'Не удалось запустить разбор переговоров.' })
        : Promise.resolve({ status: 'processing' })
    },
  })
  const harness = await mountHarness('retry-finish-arena', negotiationClient)
  await waitFor(harness, (value) => value.viewState === 'ready')
  const firstResult = await act(async () => harness.value().finishSession())
  const afterFailure = {
    result: firstResult,
    viewState: harness.value().viewState,
    error: harness.value().error,
    pending: sessionStorage.getItem('arena.pending-finish.retry-finish-arena'),
  }
  const secondResult = await act(async () => harness.value().finishSession())
  const afterRetry = {
    result: secondResult,
    viewState: harness.value().viewState,
    pending: sessionStorage.getItem('arena.pending-finish.retry-finish-arena'),
  }
  await harness.dispose()
  return { finishCalls, afterFailure, afterRetry }
}
