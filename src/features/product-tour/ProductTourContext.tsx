import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuthRuntime } from '@/auth/runtime'
import { ProductTourLayer } from '@/components/product-tour/ProductTourLayer'
import { ProductTourContext, type ProductTourContextValue } from '@/features/product-tour/useProductTour'
import {
  deferProductTourPrompt,
  isProductTourPromptDeferred,
  readProductTourState,
  subscribeToProductTourStorage,
  writeProductTourState,
  type ProductTourState,
} from '@/features/product-tour/productTourStorage'
import { transitionProductTour, type ProductTourEvent } from '@/features/product-tour/productTourMachine'
import { useDomainServices } from '@/services/domainServices'

function ScopedProductTourProvider({ children, ownerKey }: { children: ReactNode; ownerKey: string }) {
  const [snapshot, setSnapshot] = useState(() => readProductTourState(ownerKey))
  const [invitationOpen, setInvitationOpen] = useState(false)
  const [resultReady, setResultReady] = useState(false)
  const [error, setError] = useState<ProductTourContextValue['error']>(null)
  const [scenarioError, setScenarioError] = useState<ProductTourContextValue['scenarioError']>(null)
  const scenarioRetryRef = useRef<() => void>(() => undefined)
  const invitationConsideredRef = useRef(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { negotiationClient } = useDomainServices()

  useEffect(() => subscribeToProductTourStorage(ownerKey, (state) => {
    setSnapshot((current) => ({ ...current, state }))
  }), [ownerKey])

  const persist = useCallback((next: ProductTourState) => {
    const storageAvailable = writeProductTourState(ownerKey, next)
    setSnapshot({ state: next, storageAvailable })
  }, [ownerKey])

  const send = useCallback((event: ProductTourEvent) => {
    if (event.type === 'result-ready') setResultReady(true)
    if (event.type === 'session-finished' || event.type === 'start') setResultReady(false)
    if (event.type === 'audio-connected' || event.type === 'result-ready' || event.type === 'start') setScenarioError(null)
    setSnapshot((current) => {
      const next = transitionProductTour(current.state, event)
      if (!next || next === current.state) return current
      return { state: next, storageAvailable: writeProductTourState(ownerKey, next) }
    })
  }, [ownerKey])

  const startOrResume = useCallback(() => {
    const current = snapshot.state
    const shouldResume = current?.status === 'paused' || current?.status === 'active'
    const next = transitionProductTour(current, { type: shouldResume ? 'resume' : 'start' })
    if (!next) return
    setInvitationOpen(false)
    setError(null)

    if (!shouldResume || next.stepId === 'case') {
      persist(next)
      navigate('/home')
      return
    }
    if (next.stepId === 'role' || next.stepId === 'voice-format') {
      const canRestore = Boolean(next.caseId) && (next.stepId === 'role' || next.roleIndex !== undefined)
      if (!canRestore) {
        const restarted = transitionProductTour(next, { type: 'start' })
        if (restarted) persist(restarted)
        navigate('/home')
        return
      }
      persist(next)
      navigate('/home')
      return
    }
    if (next.stepId === 'analysis' || next.stepId === 'strategy' || next.stepId === 'tactics' || next.stepId === 'start-duel') {
      if (!next.caseId || next.roleIndex === undefined) {
        const restarted = transitionProductTour(next, { type: 'start' })
        if (restarted) persist(restarted)
        navigate('/home')
        return
      }
      persist(next)
      const section = next.stepId === 'analysis' ? 'analysis' : next.stepId === 'strategy' ? 'strategy' : 'tactics'
      navigate(`/cases/${encodeURIComponent(next.caseId)}/preparation?role=${next.roleIndex}&mode=voice&section=${section}`)
      return
    }
    if (!next.sessionId) {
      setError('session-unavailable')
      return
    }
    const sessionId = next.sessionId
    void negotiationClient.getSession(sessionId).then(() => {
      persist(next)
      navigate(next.stepId === 'result'
        ? `/result/${encodeURIComponent(sessionId)}`
        : `/arena/${encodeURIComponent(sessionId)}`)
    }).catch(() => setError('session-unavailable'))
  }, [navigate, negotiationClient, persist, snapshot.state])

  const restart = useCallback(() => {
    const next = transitionProductTour(snapshot.state, { type: 'start' })
    if (next) persist(next)
    setError(null)
    navigate('/home')
  }, [navigate, persist, snapshot.state])

  const dismissError = useCallback(() => {
    send({ type: 'pause' })
    setError(null)
  }, [send])

  const reportTargetUnavailable = useCallback(() => {
    setError('target-unavailable')
  }, [])

  const reportScenarioError = useCallback((kind: NonNullable<ProductTourContextValue['scenarioError']>, retry: () => void) => {
    scenarioRetryRef.current = retry
    setScenarioError(kind)
  }, [])

  const clearScenarioError = useCallback(() => setScenarioError(null), [])
  const retryScenario = useCallback(() => {
    setScenarioError(null)
    scenarioRetryRef.current()
  }, [])

  useEffect(() => {
    const state = snapshot.state
    if (state?.status !== 'active' || error) return
    const isHomeStep = state.stepId === 'case' || state.stepId === 'role' || state.stepId === 'voice-format'
    if (location.pathname !== '/home' || isHomeStep) return
    const timer = window.setTimeout(() => send({ type: 'pause' }), 100)
    return () => window.clearTimeout(timer)
  }, [error, location.pathname, send, snapshot.state])

  const considerInvitation = useCallback((catalogReady: boolean) => {
    if (!catalogReady || invitationConsideredRef.current) return
    invitationConsideredRef.current = true
    if (!snapshot.state && !isProductTourPromptDeferred(ownerKey)) setInvitationOpen(true)
  }, [ownerKey, snapshot.state])

  const beginFromInvitation = useCallback(() => {
    const next = transitionProductTour(snapshot.state, { type: 'start' })
    if (next) persist(next)
    setInvitationOpen(false)
  }, [persist, snapshot.state])

  const deferInvitation = useCallback(() => {
    deferProductTourPrompt(ownerKey)
    setInvitationOpen(false)
  }, [ownerKey])

  const disableInvitation = useCallback(() => {
    const next = transitionProductTour(snapshot.state, { type: 'never' })
    if (next) persist(next)
    setInvitationOpen(false)
  }, [persist, snapshot.state])

  const menuLabel = snapshot.state?.status === 'completed'
    ? 'Пройти тур заново'
    : snapshot.state?.status === 'paused' || snapshot.state?.status === 'active'
      ? 'Продолжить тур'
      : 'Пройти тур'

  const value = useMemo<ProductTourContextValue>(() => ({
    ownerKey,
    state: snapshot.state,
    storageAvailable: snapshot.storageAvailable,
    menuLabel,
    invitationOpen,
    resultReady,
    error,
    scenarioError,
    retryScenario,
    reportScenarioError,
    clearScenarioError,
    startOrResume,
    restart,
    dismissError,
    reportTargetUnavailable,
    beginFromInvitation,
    deferInvitation,
    disableInvitation,
    considerInvitation,
    send,
  }), [beginFromInvitation, clearScenarioError, considerInvitation, deferInvitation, dismissError, disableInvitation, error, invitationOpen, menuLabel, ownerKey, reportScenarioError, reportTargetUnavailable, restart, resultReady, retryScenario, scenarioError, send, snapshot, startOrResume])

  return <ProductTourContext.Provider value={value}>{children}<ProductTourLayer /></ProductTourContext.Provider>
}

export function ProductTourProvider({ children }: { children: ReactNode }) {
  const { tourOwnerKey } = useAuthRuntime()
  if (!tourOwnerKey) {
    return (
      <ProductTourContext.Provider value={{
        ownerKey: null,
        state: null,
        storageAvailable: true,
        menuLabel: 'Пройти тур',
        invitationOpen: false,
        resultReady: false,
        error: null,
        scenarioError: null,
        retryScenario: () => undefined,
        reportScenarioError: () => undefined,
        clearScenarioError: () => undefined,
        startOrResume: () => undefined,
        restart: () => undefined,
        dismissError: () => undefined,
        reportTargetUnavailable: () => undefined,
        beginFromInvitation: () => undefined,
        deferInvitation: () => undefined,
        disableInvitation: () => undefined,
        considerInvitation: () => undefined,
        send: () => undefined,
      }}>
        {children}
      </ProductTourContext.Provider>
    )
  }
  return <ScopedProductTourProvider key={tourOwnerKey} ownerKey={tourOwnerKey}>{children}</ScopedProductTourProvider>
}
