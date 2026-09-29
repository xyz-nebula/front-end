import { useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { useAuth, useAuthHomePath } from '@/auth/useAuth'
import { ArenaCubeMark } from '@/components/ui/ArenaCubeMark'
import '@/styles/session.css'

type SessionLoadingMode = 'booting' | 'signing-out'

export function SessionLoading({ mode = 'booting' }: { mode?: SessionLoadingMode }) {
  const signingOut = mode === 'signing-out'
  const homePath = useAuthHomePath()

  return (
    <main className="session-state-page" aria-live="polite" aria-label={signingOut ? 'Завершаем сессию' : 'Проверяем сессию'}>
      <header className="session-state-page__header">
        <Link className="session-state-page__brand" to={homePath} aria-label="Арена переговоров — на главную">
          <ArenaCubeMark />
          <span>Арена переговоров</span>
        </Link>
      </header>
      <section className="session-state-card session-state-card--loading" role="status">
        <div className="session-state-card__mark" aria-hidden="true"><span className="session-state-card__spinner" /></div>
        <h1>{signingOut ? 'Завершаем сессию' : 'Проверяем сессию'}</h1>
        <p>{signingOut ? 'Подождите, пока мы безопасно завершим вход.' : 'Подождите, пока мы восстановим доступ к вашему аккаунту.'}</p>
      </section>
    </main>
  )
}

function SessionRecovery() {
  const { logout, retrySession } = useAuth()
  const homePath = useAuthHomePath()

  return (
    <main className="session-state-page session-state-page--recovery">
      <header className="session-state-page__header">
        <Link className="session-state-page__brand" to={homePath} aria-label="Арена переговоров — на главную">
          <ArenaCubeMark />
          <span>Арена переговоров</span>
        </Link>
      </header>
      <section className="session-state-card" role="alert">
        <div className="session-state-card__mark session-state-card__mark--error" aria-hidden="true">
          <svg viewBox="0 0 48 48"><path d="M24 11v17" /><path d="M24 36h.01" /></svg>
        </div>
        <h1>Не удалось проверить сессию</h1>
        <p>Мы сохранили данные входа. Проверьте интернет и попробуйте подключиться ещё раз.</p>
        <div className="session-state-card__actions">
          <button className="session-state-card__primary" type="button" onClick={() => void retrySession()}>Повторить</button>
          <button className="session-state-card__secondary" type="button" onClick={() => void logout()}>Выйти</button>
        </div>
      </section>
    </main>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { logoutRequested, status } = useAuth()
  const location = useLocation()

  if (status === 'booting' || status === 'signing-out') return <SessionLoading mode={status} />
  if (status === 'restore-error') return <SessionRecovery />
  if (status === 'unauthenticated') {
    if (logoutRequested) return <Navigate to="/login" replace />
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return children
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'booting' || status === 'signing-out') return <SessionLoading mode={status} />
  if (status === 'restore-error') return <SessionRecovery />
  if (status === 'authenticated') return <Navigate to="/home" replace />
  return children
}

export function ActivationRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [enteredWithoutSession, setEnteredWithoutSession] = useState(status === 'unauthenticated')

  if (status === 'unauthenticated' && !enteredWithoutSession) setEnteredWithoutSession(true)
  if (status === 'booting' || status === 'signing-out') return <SessionLoading mode={status} />
  if (status === 'restore-error') return <SessionRecovery />
  if (status === 'authenticated' && !enteredWithoutSession) {
    return <Navigate to="/home" replace />
  }
  return children
}
