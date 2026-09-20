import { useEffect, useState } from 'react'

import { AppButton } from '@/components/ui/AppButton'
import { Logo } from '@/components/ui/Logo'

const navLinks = [
  { label: 'Как это работает', href: '#how-it-works' },
  { label: 'Возможности', href: '#possibilities' },
  { label: 'О проекте', href: '#about' },
]

export function LandingHeader() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const close = () => setIsOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [isOpen])

  return (
    <header className="landing-header">
      <div className="page-shell landing-header__inner">
        <Logo />
        <nav className={`landing-nav ${isOpen ? 'is-open' : ''}`} aria-label="Основная навигация">
          {navLinks.map((link) => <a key={link.href} href={link.href} onClick={() => setIsOpen(false)}>{link.label}</a>)}
          <AppButton to="/home" className="landing-nav__cta">Начать тренировку</AppButton>
        </nav>
        <AppButton to="/home" className="landing-header__cta">Начать тренировку</AppButton>
        <button className={`menu-toggle ${isOpen ? 'is-open' : ''}`} type="button" aria-label={isOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={isOpen} onClick={() => setIsOpen((value) => !value)}>
          <span /><span />
        </button>
      </div>
    </header>
  )
}
