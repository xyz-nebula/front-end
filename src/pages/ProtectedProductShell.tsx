import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'

import { useAuthRuntime } from '@/auth/runtime'
import { migratePreparationStorageOwner } from '@/features/preparation/preparation'
import { ProductTourProvider } from '@/features/product-tour/ProductTourContext'
import '@/styles/product-tour.css'

export function ProtectedProductShell() {
  const { mockOwnerKey, preparationOwnerKey } = useAuthRuntime()
  const migrationKey = mockOwnerKey && preparationOwnerKey && mockOwnerKey !== preparationOwnerKey
    ? `${mockOwnerKey}\u0000${preparationOwnerKey}`
    : null
  const [completedMigrationKey, setCompletedMigrationKey] = useState<string | null>(null)

  useEffect(() => {
    if (!migrationKey || !mockOwnerKey || !preparationOwnerKey) return
    let cancelled = false
    void Promise.resolve().then(() => {
      migratePreparationStorageOwner(mockOwnerKey, preparationOwnerKey)
      if (!cancelled) setCompletedMigrationKey(migrationKey)
    })
    return () => { cancelled = true }
  }, [migrationKey, mockOwnerKey, preparationOwnerKey])

  if (migrationKey && completedMigrationKey !== migrationKey) {
    return <main className="arena-state" aria-live="polite"><span className="arena-state__spinner" /><h1>Загружаем данные…</h1></main>
  }

  return (
    <ProductTourProvider>
      <Outlet />
    </ProductTourProvider>
  )
}
