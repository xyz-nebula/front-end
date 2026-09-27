import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuthRuntime } from '@/auth/runtime'
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
  const invitationConsideredRef = useRef(false)
  const navigate = useNavigate()

  useEffect(() => subscribeToProductTourStorage(ownerKey, (state) => {
    setSnapshot((current) => ({ ...current, state }))
  }), [ownerKey])

  const persist = useCallback((next: ProductTourState) => {
    const storageAvailable = writeProductTourState(ownerKey, next)
    setSnapshot({ state: next, storageAvailable })
  }, [ownerKey])

  const send = useCallback((event: ProductTourEvent) => {
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
    persist(next)
    setInvitationOpen(false)

    if (!shouldResume || next.stepId === 'case' || next.stepId === 'role' || next.stepId === 'voice-format') {
      navigate('/home')
      return
    }
    if (next.stepId === 'analysis' || next.stepId === 'strategy' || next.stepId === 'tactics' || next.stepId === 'start-duel') {
      if (!next.caseId || next.roleIndex === undefined) {
        navigate('/home')
        return
      }
      const section = next.stepId === 'analysis' ? 'analysis' : next.stepId === 'strategy' ? 'strategy' : 'tactics'
      navigate(`/cases/${encodeURIComponent(next.caseId)}/preparation?role=${next.roleIndex}&mode=voice&section=${section}`)
      return
    }
    if (next.stepId === 'result') {
      navigate(next.sessionId ? `/result/${encodeURIComponent(next.sessionId)}` : '/home')
      return
    }
    navigate(next.sessionId ? `/arena/${encodeURIComponent(next.sessionId)}` : '/home')
  }, [navigate, persist, snapshot.state])

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
    startOrResume,
    beginFromInvitation,
    deferInvitation,
    disableInvitation,
    considerInvitation,
    send,
  }), [beginFromInvitation, considerInvitation, deferInvitation, disableInvitation, invitationOpen, menuLabel, ownerKey, send, snapshot, startOrResume])

  return <ProductTourContext.Provider value={value}>{children}</ProductTourContext.Provider>
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
        startOrResume: () => undefined,
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
