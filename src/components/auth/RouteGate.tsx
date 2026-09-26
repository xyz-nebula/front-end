import { useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { AppButton } from '@/components/ui/AppButton'
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

function SessionRecovery() {
  const { logout, retrySession } = useAuth()

  return (
    <main className="session-recovery">
      <Logo />
      <section>
        <p className="eyebrow">Связь прервалась</p>
        <h1>Не удалось проверить сессию</h1>
        <p>Мы сохранили данные входа. Проверьте интернет и попробуйте подключиться ещё раз.</p>
        <div className="session-recovery__actions">
          <AppButton type="button" onClick={() => void retrySession()}>Повторить</AppButton>
          <AppButton type="button" variant="secondary" onClick={() => void logout()}>Выйти</AppButton>
        </div>
      </section>
    </main>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { logoutRequested, status } = useAuth()
  const location = useLocation()

  if (status === 'booting' || status === 'signing-out') return <SessionLoading />
  if (status === 'restore-error') return <SessionRecovery />
  if (status === 'unauthenticated') {
    if (logoutRequested) return <Navigate to="/login" replace />
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return children
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'booting' || status === 'signing-out') return <SessionLoading />
  if (status === 'restore-error') return <SessionRecovery />
  if (status === 'authenticated') return <Navigate to="/home" replace />
  return children
}

export function ActivationRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [enteredWithoutSession, setEnteredWithoutSession] = useState(status === 'unauthenticated')

  if (status === 'unauthenticated' && !enteredWithoutSession) setEnteredWithoutSession(true)
  if (status === 'booting' || status === 'signing-out') return <SessionLoading />
  if (status === 'restore-error') return <SessionRecovery />
  if (status === 'authenticated' && !enteredWithoutSession) {
    return <Navigate to="/home" replace />
  }
  return children
}
