import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { Logo } from '@/components/ui/Logo'

export function SessionLoading() {
  return (
    <main className="session-loading" aria-live="polite" aria-label="Проверяем сессию">
      <Logo />
      <span className="session-loading__spinner" aria-hidden="true" />
      <p>Проверяем сессию…</p>
    </main>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { logoutRequested, status } = useAuth()
  const location = useLocation()

  if (status === 'booting' || status === 'signing-out') return <SessionLoading />
  if (status === 'unauthenticated') {
    if (logoutRequested) return <Navigate to="/auth" replace />
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return children
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'booting' || status === 'signing-out') return <SessionLoading />
  if (status === 'authenticated') return <Navigate to="/home" replace />
  return children
}
