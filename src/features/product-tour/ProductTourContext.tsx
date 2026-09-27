import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuthRuntime } from '@/auth/runtime'
import { ProductTourContext, type ProductTourContextValue } from '@/features/product-tour/useProductTour'
import {
  readProductTourState,
  subscribeToProductTourStorage,
  writeProductTourState,
  PRODUCT_TOUR_VERSION,
  type ProductTourState,
} from '@/features/product-tour/productTourStorage'

function ScopedProductTourProvider({ children, ownerKey }: { children: ReactNode; ownerKey: string }) {
  const [snapshot, setSnapshot] = useState(() => readProductTourState(ownerKey))
  const navigate = useNavigate()

  useEffect(() => subscribeToProductTourStorage(ownerKey, (state) => {
    setSnapshot((current) => ({ ...current, state }))
  }), [ownerKey])

  const startOrResume = useCallback(() => {
    const current = snapshot.state
    const shouldResume = current?.status === 'paused' || current?.status === 'active'
    const next: ProductTourState = shouldResume
      ? { ...current, status: 'active', updatedAt: new Date().toISOString() }
      : {
          schemaVersion: 1,
          tourVersion: PRODUCT_TOUR_VERSION,
          status: 'active',
          stepId: 'case',
          updatedAt: new Date().toISOString(),
        }
    const storageAvailable = writeProductTourState(ownerKey, next)
    setSnapshot({ state: next, storageAvailable })

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
  }, [navigate, ownerKey, snapshot.state])

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
    startOrResume,
  }), [menuLabel, ownerKey, snapshot, startOrResume])

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
        startOrResume: () => undefined,
      }}>
        {children}
      </ProductTourContext.Provider>
    )
  }
  return <ScopedProductTourProvider key={tourOwnerKey} ownerKey={tourOwnerKey}>{children}</ScopedProductTourProvider>
}
