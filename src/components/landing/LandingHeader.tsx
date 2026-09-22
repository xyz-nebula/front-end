import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const navLinks = [
  { label: 'Кейсы', to: '/home#cases' },
  { label: 'Как это работает', to: '#how-it-works' },
  { label: 'AI-оппонент', to: '#ai-opponent' },
]

function ArenaBrand() {
  return (
    <Link className="arena-brand" to="/" aria-label="Арена — на главную">
      <svg className="arena-brand__mark" viewBox="0 0 44 48" aria-hidden="true">
        <path d="M22 2 42 13.5 22 25 2 13.5 22 2Z" fill="#2582ff" />
        <path d="M2 13.5 22 25v21L2 34.5v-21Z" fill="#075dcc" />
        <path d="M22 25 42 13.5v21L22 46V25Z" fill="#f01925" />
        <path d="m22 2 20 11.5-8.3 4.8-20-11.5L22 2Z" fill="#50a1ff" />
        <path d="m22 25 11.7-6.7v21L22 46V25Z" fill="#d80d1b" />
      </svg>
      <span>АРЕНА</span>
    </Link>
  )
}

export function LandingHeader() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    const handleResize = () => {
      if (window.innerWidth > 768) setIsOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen])

  return (
    <header className="arena-header">
      <div className="arena-shell arena-header__inner">
        <ArenaBrand />

        <nav
          id="arena-navigation"
          className={`arena-header__nav ${isOpen ? 'is-open' : ''}`}
          aria-label="Основная навигация"
        >
          {navLinks.map((link) => (
            link.to.startsWith('#') ? (
              <a key={link.to} href={link.to} onClick={() => setIsOpen(false)}>
                {link.label}
              </a>
            ) : (
              <Link key={link.to} to={link.to} onClick={() => setIsOpen(false)}>
                {link.label}
              </Link>
            )
          ))}
        </nav>

        <div className="arena-header__actions">
          <Link className="arena-header__login" to="/home">Войти</Link>
          <button
            className={`arena-menu-toggle ${isOpen ? 'is-open' : ''}`}
            type="button"
            aria-label={isOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={isOpen}
            aria-controls="arena-navigation"
            onClick={() => setIsOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  )
}
