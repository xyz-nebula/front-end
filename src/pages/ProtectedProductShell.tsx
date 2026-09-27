import { Outlet } from 'react-router-dom'

import { ProductTourProvider } from '@/features/product-tour/ProductTourContext'

export function ProtectedProductShell() {
  return (
    <ProductTourProvider>
      <Outlet />
    </ProductTourProvider>
  )
}
