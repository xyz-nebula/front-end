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

  useEffect(() => subscribeToProductTourStorage(ownerKey, (state) => {
    setSnapshot((current) => current.state?.status === 'active' ? current : { ...current, state })
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
      if (next.status === 'active') return { ...current, state: next }
      return { state: next, storageAvailable: writeProductTourState(ownerKey, next) }
    })
  }, [ownerKey])

  const startTour = useCallback(() => {
    const current = snapshot.state
    const closed = transitionProductTour(current, { type: 'dismiss' })
    const next = transitionProductTour(current, { type: 'start' })
    if (!next) return
    setInvitationOpen(false)
    setError(null)
    setResultReady(false)
    setScenarioError(null)
    const storageAvailable = closed ? writeProductTourState(ownerKey, closed) : snapshot.storageAvailable
    setSnapshot({ state: next, storageAvailable })
    navigate('/home')
  }, [navigate, ownerKey, snapshot.state, snapshot.storageAvailable])

  const dismissTour = useCallback(() => {
    send({ type: 'dismiss' })
    setError(null)
    setScenarioError(null)
  }, [send])

  const dismissError = useCallback(() => {
    dismissTour()
  }, [dismissTour])

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
    const timer = window.setTimeout(() => send({ type: 'dismiss' }), 100)
    return () => window.clearTimeout(timer)
  }, [error, location.pathname, send, snapshot.state])

  const considerInvitation = useCallback((catalogReady: boolean) => {
    if (!catalogReady || invitationConsideredRef.current) return
    invitationConsideredRef.current = true
    if (!snapshot.state && !isProductTourPromptDeferred(ownerKey)) setInvitationOpen(true)
  }, [ownerKey, snapshot.state])

  const beginFromInvitation = useCallback(() => {
    startTour()
  }, [startTour])

  const deferInvitation = useCallback(() => {
    deferProductTourPrompt(ownerKey)
    setInvitationOpen(false)
  }, [ownerKey])

  const disableInvitation = useCallback(() => {
    const next = transitionProductTour(snapshot.state, { type: 'dismiss' })
    if (next) persist(next)
    setInvitationOpen(false)
  }, [persist, snapshot.state])

  const menuLabel = snapshot.state?.status === 'active'
    || snapshot.state?.status === 'paused'
    || snapshot.state?.status === 'completed'
    ? 'Пройти тур заново'
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
    startTour,
    dismissTour,
    dismissError,
    reportTargetUnavailable,
    beginFromInvitation,
    deferInvitation,
    disableInvitation,
    considerInvitation,
    send,
  }), [beginFromInvitation, clearScenarioError, considerInvitation, deferInvitation, dismissError, dismissTour, disableInvitation, error, invitationOpen, menuLabel, ownerKey, reportScenarioError, reportTargetUnavailable, resultReady, retryScenario, scenarioError, send, snapshot, startTour])

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
        startTour: () => undefined,
        dismissTour: () => undefined,
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
