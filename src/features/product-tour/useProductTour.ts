import { createContext, useContext } from 'react'

import type { ProductTourState } from '@/features/product-tour/productTourStorage'
import type { ProductTourEvent } from '@/features/product-tour/productTourMachine'

export interface ProductTourContextValue {
  ownerKey: string | null
  state: ProductTourState | null
  storageAvailable: boolean
  menuLabel: 'Пройти тур' | 'Пройти тур заново'
  invitationOpen: boolean
  resultReady?: boolean
  error: 'target-unavailable' | null
  scenarioError: 'microphone' | 'audio' | 'result' | null
  retryScenario: () => void
  reportScenarioError: (kind: 'microphone' | 'audio' | 'result', retry: () => void) => void
  clearScenarioError: () => void
  startTour: () => void
  dismissTour: () => void
  dismissError: () => void
  reportTargetUnavailable: () => void
  beginFromInvitation: () => void
  deferInvitation: () => void
  disableInvitation: () => void
  considerInvitation: (catalogReady: boolean) => void
  send: (event: ProductTourEvent) => void
}

export const ProductTourContext = createContext<ProductTourContextValue | null>(null)

export function useProductTour(): ProductTourContextValue {
  const context = useContext(ProductTourContext)
  if (!context) throw new Error('useProductTour must be used inside ProductTourProvider')
  return context
}
