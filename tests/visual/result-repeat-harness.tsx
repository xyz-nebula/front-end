import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { AuthRuntimeContext } from '@/auth/runtime'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import { ProductTourContext } from '@/features/product-tour/useProductTour'
import { ResultPage } from '@/pages/ResultPage'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import { DomainServicesContext } from '@/services/domainServices'
import type { RunAuthorized } from '@/services/serviceAdapters'
import type { NegotiationResultState, NegotiationSession } from '@/types/negotiation'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function sourceSession(id: string): NegotiationSession {
  return {
    id,
    caseId: 'salary-review',
    mode: 'text',
    status: 'finished',
    startedAt: '2026-09-23T08:00:00.000Z',
    finishedAt: '2026-09-23T08:05:00.000Z',
    messages: [],
  }
}

function createdSession(id: string): NegotiationSession {
  return { ...sourceSession(id), status: 'active', finishedAt: undefined }
}

const readyResult: NegotiationResultState = {
  status: 'ready',
  result: {
    sessionId: 'source',
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

function client(
  createSession: NegotiationClient['createSession'],
): NegotiationClient {
  const unavailable = async (): Promise<never> => { throw new Error('Unexpected negotiation call') }
  return {
    createSession,
    getSession: (sessionId) => Promise.resolve(sourceSession(sessionId)),
    sendTextTurn: unavailable,
    createAudioTicket: unavailable,
    finishSession: unavailable,
    getResult: () => Promise.resolve(readyResult),
    listSessions: unavailable,
  }
}

interface MountedResult {
  host: HTMLDivElement
  root: Root
  path: () => string
}

async function mountResult(sessionId: string, negotiationClient: NegotiationClient): Promise<MountedResult> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let currentPath = ''
  const runAuthorized: RunAuthorized = (operation) => operation('harness-access-token')
  const unavailableAuth = async (): Promise<never> => { throw new Error('Unexpected auth call') }
  const authValue: AuthContextValue = {
    status: 'authenticated', logoutRequested: false, persistence: 'memory', externalSessionVersion: 0,
    showMemorySessionNotice: false, dismissMemorySessionNotice: () => undefined,
    retrySession: async () => undefined, register: unavailableAuth, activate: unavailableAuth,
    login: unavailableAuth, logout: async () => undefined, enrollTotp: unavailableAuth,
    confirmTotp: unavailableAuth, disableTotp: unavailableAuth,
  }
  const tourValue = {
    ownerKey: 'harness-tour-owner', state: null, storageAvailable: true,
    menuLabel: 'Пройти тур' as const, invitationOpen: false,
    startOrResume: () => undefined, beginFromInvitation: () => undefined,
    error: null, restart: () => undefined, dismissError: () => undefined, reportTargetUnavailable: () => undefined,
    scenarioError: null, retryScenario: () => undefined, reportScenarioError: () => undefined, clearScenarioError: () => undefined,
    deferInvitation: () => undefined, disableInvitation: () => undefined,
    considerInvitation: () => undefined, send: () => undefined,
  }

  function LocationProbe() {
    const location = useLocation()
    useLayoutEffect(() => { currentPath = location.pathname }, [location.pathname])
    return null
  }

  await act(async () => {
    root.render(
      <AuthContext.Provider value={authValue}>
        <AuthRuntimeContext.Provider value={{ mockOwnerKey: 'harness-owner', tourOwnerKey: 'harness-tour-owner', runAuthorized }}>
          <ProductTourContext.Provider value={tourValue}>
            <DomainServicesContext.Provider value={{
              negotiationClient,
              createAudioClient: () => { throw new Error('Audio is not used by this harness') as never },
            }}>
              <MemoryRouter initialEntries={[`/result/${sessionId}`]}>
                <LocationProbe />
                <Routes>
                  <Route path="/result/:sessionId" element={<ResultPage />} />
                  <Route path="/arena/:sessionId" element={<div>Арена</div>} />
                </Routes>
              </MemoryRouter>
            </DomainServicesContext.Provider>
          </ProductTourContext.Provider>
        </AuthRuntimeContext.Provider>
      </AuthContext.Provider>,
    )
  })
  await waitForButton(host)
  return { host, root, path: () => currentPath }
}

async function flush() {
  await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 5)) })
}

async function waitForButton(host: HTMLElement) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await flush()
    const button = [...host.querySelectorAll('button')].find((item) => item.textContent === 'Повторить кейс')
    if (button) return button
  }
  throw new Error('Repeat button did not appear')
}

async function clickRepeat(mounted: MountedResult, times = 1) {
  const button = await waitForButton(mounted.host)
  await act(async () => {
    for (let index = 0; index < times; index += 1) button.click()
    await Promise.resolve()
  })
  await flush()
}

async function dispose(mounted: MountedResult) {
  await act(async () => mounted.root.unmount())
  mounted.host.remove()
}

export async function runRepeatRecoveryScenario() {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  sessionStorage.clear()

  const retryCalls: string[] = []
  const rounds = new Map<string, NegotiationSession>()
  let loseFirstResponse = true
  const retryClient = client(async (input) => {
    retryCalls.push(input.clientCommandId)
    let round = rounds.get(input.clientCommandId)
    if (!round) {
      round = createdSession(`round-${rounds.size + 1}`)
      rounds.set(input.clientCommandId, round)
    }
    if (loseFirstResponse) {
      loseFirstResponse = false
      throw new Error('Ответ потерян после commit')
    }
    return round
  })
  const retryMount = await mountResult('source-retry', retryClient)
  await clickRepeat(retryMount)
  await clickRepeat(retryMount)
  const retry = {
    calls: [...retryCalls],
    rounds: rounds.size,
    path: retryMount.path(),
  }
  await dispose(retryMount)

  const reloadCalls: string[] = []
  let loseReloadResponse = true
  const reloadClient = client(async (input) => {
    reloadCalls.push(input.clientCommandId)
    if (loseReloadResponse) {
      loseReloadResponse = false
      throw new Error('Ответ потерян перед reload')
    }
    return createdSession('round-after-reload')
  })
  const beforeReload = await mountResult('source-reload', reloadClient)
  await clickRepeat(beforeReload)
  await dispose(beforeReload)
  const afterReload = await mountResult('source-reload', reloadClient)
  await clickRepeat(afterReload)
  const reload = { calls: [...reloadCalls], path: afterReload.path() }
  await dispose(afterReload)

  const storagePrototype = Object.getPrototypeOf(sessionStorage) as Storage
  const originalGetItem = storagePrototype.getItem
  const originalSetItem = storagePrototype.setItem
  const originalRemoveItem = storagePrototype.removeItem
  const memoryCalls: string[] = []
  let failMemoryOnce = true
  storagePrototype.getItem = () => { throw new Error('Storage unavailable') }
  storagePrototype.setItem = () => { throw new Error('Storage unavailable') }
  storagePrototype.removeItem = () => { throw new Error('Storage unavailable') }
  const memoryClient = client(async (input) => {
    memoryCalls.push(input.clientCommandId)
    if (failMemoryOnce) {
      failMemoryOnce = false
      throw new Error('Ответ потерян без storage')
    }
    return createdSession('round-memory')
  })
  const memoryMount = await mountResult('source-memory', memoryClient)
  await clickRepeat(memoryMount)
  await clickRepeat(memoryMount)
  const memory = { calls: [...memoryCalls], path: memoryMount.path() }
  await dispose(memoryMount)
  storagePrototype.getItem = originalGetItem
  storagePrototype.setItem = originalSetItem
  storagePrototype.removeItem = originalRemoveItem

  const doubleSubmit = deferred<NegotiationSession>()
  const doubleCalls: string[] = []
  const doubleClient = client((input) => {
    doubleCalls.push(input.clientCommandId)
    return doubleSubmit.promise
  })
  const doubleMount = await mountResult('source-double', doubleClient)
  await clickRepeat(doubleMount, 2)
  const callsBeforeResolve = [...doubleCalls]
  await act(async () => { doubleSubmit.resolve(createdSession('round-double')); await Promise.resolve() })
  await flush()
  const double = { callsBeforeResolve, path: doubleMount.path() }
  await dispose(doubleMount)

  const lateResponse = deferred<NegotiationSession>()
  const lateClient = client(() => lateResponse.promise)
  const lateMount = await mountResult('source-late', lateClient)
  await clickRepeat(lateMount)
  const homeLink = lateMount.host.querySelector<HTMLAnchorElement>('a[href="/home"]')
  if (!homeLink) throw new Error('Home link did not appear')
  await act(async () => { homeLink.click(); await Promise.resolve() })
  await act(async () => { lateResponse.resolve(createdSession('round-too-late')); await Promise.resolve() })
  await flush()
  const late = { path: lateMount.path() }
  await dispose(lateMount)

  const independentCalls: string[] = []
  const independentClient = client((input) => {
    independentCalls.push(input.clientCommandId)
    return Promise.resolve(createdSession(`round-independent-${independentCalls.length}`))
  })
  const firstIndependent = await mountResult('source-independent', independentClient)
  await clickRepeat(firstIndependent)
  await dispose(firstIndependent)
  const secondIndependent = await mountResult('source-independent', independentClient)
  await clickRepeat(secondIndependent)
  const independent = {
    calls: [...independentCalls],
    distinct: new Set(independentCalls).size,
    path: secondIndependent.path(),
  }
  await dispose(secondIndependent)

  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  return { retry, reload, memory, double, late, independent }
}
