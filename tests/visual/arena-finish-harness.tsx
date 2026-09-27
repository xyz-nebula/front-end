import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AuthRuntimeContext } from '@/auth/runtime'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import { ProductTourContext } from '@/features/product-tour/useProductTour'
import { ArenaPage } from '@/pages/ArenaPage'
import type { RunAuthorized } from '@/services/serviceAdapters'
import type { AudioClient } from '@/services/contracts/audioClient'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import { DomainServicesContext } from '@/services/domainServices'
import type { AudioConnectionState, AudioEngineEvent, AudioInputFrame } from '@/types/audio'
import type { AudioTicket, NegotiationSession } from '@/types/negotiation'

class FailingAudioClient implements AudioClient {
  disconnectCalls = 0
  stopCalls = 0

  getState(): AudioConnectionState { return 'connected' }
  async connect(input: { sessionId: string; ticket: AudioTicket }) { void input }
  sendAudio(frame: AudioInputFrame) { void frame }
  sendControl() {
    this.stopCalls += 1
    throw new Error('audio control unavailable')
  }
  subscribe(listener: (event: AudioEngineEvent) => void) {
    void listener
    return () => undefined
  }
  subscribeState(listener: (state: AudioConnectionState) => void) {
    void listener
    return () => undefined
  }
  async disconnect() {
    this.disconnectCalls += 1
    throw new Error('audio disconnect unavailable')
  }
}

function voiceSession(): NegotiationSession {
  return {
    id: 'voice-finish',
    caseId: 'salary-review',
    mode: 'voice',
    status: 'active',
    startedAt: '2026-09-23T08:00:00.000Z',
    messages: [],
  }
}

export async function runAudioFinishFailureScenario() {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const audioClient = new FailingAudioClient()
  const finishCommands: string[] = []
  let finishAttempt = 0
  const unavailable = async (): Promise<never> => { throw new Error('Unexpected negotiation call') }
  const negotiationClient: NegotiationClient = {
    createSession: unavailable,
    getSession: () => Promise.resolve(voiceSession()),
    activateSession: async () => undefined,
    sendTextTurn: unavailable,
    createAudioTicket: unavailable,
    finishSession: (input) => {
      finishCommands.push(input.clientCommandId)
      finishAttempt += 1
      return finishAttempt === 1
        ? Promise.reject(new Error('Backend finish unavailable'))
        : Promise.resolve({ status: 'processing' })
    },
    getResult: unavailable,
    listSessions: unavailable,
  }
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
    menuLabel: 'Пройти тур' as const, startOrResume: () => undefined,
  }
  const unhandled: string[] = []
  const onUnhandled = (event: PromiseRejectionEvent) => {
    unhandled.push(String(event.reason))
    event.preventDefault()
  }
  window.addEventListener('unhandledrejection', onUnhandled)

  const flush = async () => {
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 5))
    })
  }
  const finishButton = () => host.querySelector<HTMLButtonElement>('button[aria-label="Завершить"]')
  const confirmButton = () => [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
    .find((candidate) => candidate.textContent?.trim() === 'Завершить')

  try {
    await act(async () => {
      root.render(
        <AuthContext.Provider value={authValue}>
          <AuthRuntimeContext.Provider value={{ mockOwnerKey: 'harness-owner', tourOwnerKey: 'harness-tour-owner', runAuthorized }}>
            <ProductTourContext.Provider value={tourValue}>
              <DomainServicesContext.Provider value={{ negotiationClient, createAudioClient: () => audioClient }}>
                <MemoryRouter initialEntries={['/arena/voice-finish']}>
                  <Routes>
                    <Route path="/arena/:sessionId" element={<ArenaPage />} />
                    <Route path="/result/:sessionId" element={<div data-testid="result-route">Результат</div>} />
                  </Routes>
                </MemoryRouter>
              </DomainServicesContext.Provider>
            </ProductTourContext.Provider>
          </AuthRuntimeContext.Provider>
        </AuthContext.Provider>,
      )
    })
    for (let attempt = 0; attempt < 20 && finishButton()?.disabled !== false; attempt += 1) await flush()
    await act(async () => { finishButton()?.click() })
    await act(async () => { confirmButton()?.click() })
    await flush()
    const afterFailure = {
      dialogOpen: Boolean(host.querySelector('[role="dialog"]')),
      error: host.querySelector('[role="dialog"] [role="alert"]')?.textContent ?? null,
    }
    await act(async () => { confirmButton()?.click() })
    await flush()
    return {
      afterFailure,
      finishCommands,
      audio: { stopCalls: audioClient.stopCalls, disconnectCalls: audioClient.disconnectCalls },
      reachedResult: Boolean(host.querySelector('[data-testid="result-route"]')),
      unhandled,
    }
  } finally {
    window.removeEventListener('unhandledrejection', onUnhandled)
    await act(async () => root.unmount())
    host.remove()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = false
  }
}
