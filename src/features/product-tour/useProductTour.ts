import { createContext, useContext } from 'react'

import type { ProductTourState } from '@/features/product-tour/productTourStorage'

export interface ProductTourContextValue {
  ownerKey: string | null
  state: ProductTourState | null
  storageAvailable: boolean
}

export const ProductTourContext = createContext<ProductTourContextValue | null>(null)

export function useProductTour(): ProductTourContextValue {
  const context = useContext(ProductTourContext)
  if (!context) throw new Error('useProductTour must be used inside ProductTourProvider')
  return context
}
