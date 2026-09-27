import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { useAuthRuntime } from '@/auth/runtime'
import { ProductTourContext, type ProductTourContextValue } from '@/features/product-tour/useProductTour'
import {
  readProductTourState,
  subscribeToProductTourStorage,
} from '@/features/product-tour/productTourStorage'

function ScopedProductTourProvider({ children, ownerKey }: { children: ReactNode; ownerKey: string }) {
  const [snapshot, setSnapshot] = useState(() => readProductTourState(ownerKey))

  useEffect(() => subscribeToProductTourStorage(ownerKey, (state) => {
    setSnapshot((current) => ({ ...current, state }))
  }), [ownerKey])

  const value = useMemo<ProductTourContextValue>(() => ({
    ownerKey,
    state: snapshot.state,
    storageAvailable: snapshot.storageAvailable,
  }), [ownerKey, snapshot])

  return <ProductTourContext.Provider value={value}>{children}</ProductTourContext.Provider>
}

export function ProductTourProvider({ children }: { children: ReactNode }) {
  const { tourOwnerKey } = useAuthRuntime()
  if (!tourOwnerKey) {
    return (
      <ProductTourContext.Provider value={{ ownerKey: null, state: null, storageAvailable: true }}>
        {children}
      </ProductTourContext.Provider>
    )
  }
  return <ScopedProductTourProvider key={tourOwnerKey} ownerKey={tourOwnerKey}>{children}</ScopedProductTourProvider>
}
