import { act } from 'react'
import { createRoot } from 'react-dom/client'

import { useHomeDashboardData } from '@/features/home/useHomeDashboardData'
import { usePreparationDraft } from '@/features/preparation/usePreparationDraft'
import { useNegotiationResult } from '@/features/result/useNegotiationResult'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import type { TrainingCase } from '@/types/case'
import type { NegotiationResultState, NegotiationSession, NegotiationSessionSummary } from '@/types/negotiation'

const trainingCase: TrainingCase = {
  id: 'case-1', title: 'Кейс', description: 'Описание', synopsis: 'Ситуация', category: 'Категория',
  duration: '10 минут', difficulty: 'Средне', opponent: 'Оппонент', roles: ['Роль A', 'Роль B'], roleSummaries: ['A', 'B'],
}

function session(id: string): NegotiationSession {
  return { id, caseId: 'case-1', mode: 'text', status: 'finished', startedAt: '2026-09-27T10:00:00.000Z', finishedAt: '2026-09-27T10:01:00.000Z', messages: [] }
}

const summary: NegotiationSessionSummary = { ...session('history-1') }
const ready: NegotiationResultState = { status: 'ready', result: { sessionId: 'new', source: 'mock', outcome: { status: 'failed', reason: 'analysis-unavailable' }, judges: [{ college: 'hiring', status: 'failed', reason: 'unavailable' }, { college: 'negotiation', status: 'failed', reason: 'unavailable' }, { college: 'ownership', status: 'failed', reason: 'unavailable' }], trainer: { status: 'failed', reason: 'unavailable' } } }
const unavailable = async (): Promise<never> => { throw new Error('Unexpected call') }

function createClient(overrides: Partial<NegotiationClient>): NegotiationClient {
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

async function flush(milliseconds = 0) {
  await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, milliseconds)) })
}

export async function runHomeDataHookScenario() {
  let historyCalls = 0
  const client = createClient({
    listCases: () => Promise.resolve([trainingCase]),
    listSessions: () => {
      historyCalls += 1
      return historyCalls === 1 ? Promise.reject(new Error('История недоступна')) : Promise.resolve([summary])
    },
  })
  const host = document.createElement('div')
  const root = createRoot(host)
  let value: ReturnType<typeof useHomeDashboardData> | null = null
  function Probe() { value = useHomeDashboardData(client); return null }
  await act(async () => { root.render(<Probe />) })
  await flush()
  const failed = value as unknown as ReturnType<typeof useHomeDashboardData>
  const initial = { cases: failed.cases.length, casesError: failed.casesError, historyError: failed.historyError }
  await act(async () => { await failed.loadHistory() })
  const retried = value as unknown as ReturnType<typeof useHomeDashboardData>
  const result = { initial, history: retried.history.length, historyError: retried.historyError, historyCalls }
  await act(async () => root.unmount())
  return result
}

export async function runPreparationDraftHookScenario() {
  const host = document.createElement('div')
  const root = createRoot(host)
  let owner = 'owner-a'
  let value: ReturnType<typeof usePreparationDraft> | null = null
  function Probe() { value = usePreparationDraft(owner, 'case-1', 0); return null }
  await act(async () => { root.render(<Probe />) })
  const initial = value as unknown as ReturnType<typeof usePreparationDraft>
  await act(async () => initial.updateDraft((draft) => ({ ...draft, rootConflict: 'Черновик A' })))
  await flush(430)
  owner = 'owner-b'
  await act(async () => { root.render(<Probe />) })
  await flush()
  const ownerB = (value as unknown as ReturnType<typeof usePreparationDraft>).draft.rootConflict
  owner = 'owner-a'
  await act(async () => { root.render(<Probe />) })
  await flush()
  const ownerA = (value as unknown as ReturnType<typeof usePreparationDraft>).draft.rootConflict
  await act(async () => root.unmount())
  return { ownerA, ownerB }
}

export async function runResultDataHookScenario() {
  let resolveOld!: (value: NegotiationSession) => void
  const oldSession = new Promise<NegotiationSession>((resolve) => { resolveOld = resolve })
  let newResultCalls = 0
  let retryAttempts = 0
  const client = createClient({
    getSession: (sessionId) => {
      if (sessionId === 'old') return oldSession
      if (sessionId === 'retry') {
        retryAttempts += 1
        return retryAttempts === 1 ? Promise.reject(new Error('Первый сбой')) : Promise.resolve(session('retry'))
      }
      return Promise.resolve(session(sessionId))
    },
    getResult: (sessionId) => {
      if (sessionId === 'new') {
        newResultCalls += 1
        return Promise.resolve(newResultCalls === 1 ? { status: 'processing' } : ready)
      }
      return Promise.resolve(ready)
    },
  })
  const host = document.createElement('div')
  const root = createRoot(host)
  let sessionId = 'old'
  let value: ReturnType<typeof useNegotiationResult> | null = null
  function Probe() { value = useNegotiationResult(client, sessionId); return null }
  await act(async () => { root.render(<Probe />) })
  sessionId = 'new'
  await act(async () => { root.render(<Probe />) })
  await flush(530)
  resolveOld(session('old'))
  await flush()
  const afterStale = value as unknown as ReturnType<typeof useNegotiationResult>

  sessionId = 'retry'
  await act(async () => { root.render(<Probe />) })
  await flush()
  const failed = value as unknown as ReturnType<typeof useNegotiationResult>
  const firstError = failed.error
  await act(async () => failed.retry())
  await flush()
  const retried = value as unknown as ReturnType<typeof useNegotiationResult>
  const result = { firstError, newResultCalls, readyStatus: afterStale.result?.status, staleSession: afterStale.session?.id, retriedSession: retried.session?.id, retryAttempts }
  await act(async () => root.unmount())
  return result
}
