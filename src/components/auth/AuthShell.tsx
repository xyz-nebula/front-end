import type { ReactNode } from 'react'

import { Logo } from '@/components/ui/Logo'

interface AuthShellProps {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  wide?: boolean
}

export function AuthShell({ eyebrow, title, description, children, wide = false }: AuthShellProps) {
  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-label="Арена переговоров">
        <Logo inverse />
        <div className="auth-showcase__copy">
          <p>Практика сложных разговоров</p>
          <h2>Ошибайся здесь,<br /><span>а не в жизни.</span></h2>
          <div className="auth-showcase__note"><i /> Безопасная тренировка перед важным разговором</div>
        </div>
        <div className="auth-showcase__rings" aria-hidden="true"><span /><span /><span /></div>
      </section>

      <section className="auth-panel">
        <div className={`auth-card ${wide ? 'auth-card--wide' : ''}`}>
          <Logo compact />
          <header className="auth-card__header">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {children}
        </div>
      </section>
    </main>
  )
}
