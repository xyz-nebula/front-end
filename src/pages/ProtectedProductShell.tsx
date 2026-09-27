import { Outlet } from 'react-router-dom'

import { ProductTourProvider } from '@/features/product-tour/ProductTourContext'
import '@/styles/product-tour.css'

export function ProtectedProductShell() {
  return (
    <ProductTourProvider>
      <Outlet />
    </ProductTourProvider>
  )
}
