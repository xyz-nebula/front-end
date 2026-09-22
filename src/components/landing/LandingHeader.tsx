import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const navLinks = [
  { label: 'Зачем', to: '#problem' },
  { label: 'Как это работает', to: '#how-it-works' },
  { label: 'AI-оппонент', to: '#ai-opponent' },
  { label: 'Для команд', to: '#teams' },
] as const

type SectionId = (typeof navLinks)[number]['to']

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
  const [activeSection, setActiveSection] = useState<SectionId | null>(null)
  const [isCompact, setIsCompact] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsOpen(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus())
    }
  }, [])

  useEffect(() => {
    const updateHeader = () => setIsCompact(window.scrollY > 20)
    updateHeader()
    window.addEventListener('scroll', updateHeader, { passive: true })
    return () => window.removeEventListener('scroll', updateHeader)
  }, [])

  useEffect(() => {
    const sections = navLinks
      .map(({ to }) => document.querySelector<HTMLElement>(to))
      .filter((section): section is HTMLElement => section !== null)

    const visibleSections = new Map<string, IntersectionObserverEntry>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visibleSections.set(entry.target.id, entry)
          else visibleSections.delete(entry.target.id)
        }

        const current = [...visibleSections.values()].sort((first, second) => {
          const firstDistance = Math.abs(first.boundingClientRect.top - 88)
          const secondDistance = Math.abs(second.boundingClientRect.top - 88)
          return firstDistance - secondDistance
        })[0]

        if (current) setActiveSection(`#${current.target.id}` as SectionId)
        else if (window.scrollY < window.innerHeight * 0.45) setActiveSection(null)
      },
      { rootMargin: '-80px 0px -55% 0px', threshold: [0, 0.1, 0.35, 0.7] },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const focusFirstLinkFrame = window.requestAnimationFrame(() => {
      headerRef.current?.querySelector<HTMLElement>('#arena-navigation a')?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu(true)
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) closeMenu(true)
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) closeMenu()
    }

    const handleResize = () => {
      if (window.innerWidth > 768) closeMenu()
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('focusin', handleFocusIn)
    window.addEventListener('resize', handleResize)

    return () => {
      window.cancelAnimationFrame(focusFirstLinkFrame)
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('click', handleDocumentClick)
      document.removeEventListener('focusin', handleFocusIn)
      window.removeEventListener('resize', handleResize)
    }
  }, [closeMenu, isOpen])

  return (
    <header
      className={`arena-header ${isCompact ? 'is-compact' : ''}`}
      ref={headerRef}
      data-state={isCompact ? 'compact' : 'transparent'}
    >
      <div className="arena-shell arena-header__inner">
        <ArenaBrand />

        <nav
          id="arena-navigation"
          className={`arena-header__nav ${isOpen ? 'is-open' : ''}`}
          aria-label="Навигация по лендингу"
        >
          {navLinks.map((link) => (
            <a
              key={link.to}
              href={link.to}
              aria-current={activeSection === link.to ? 'location' : undefined}
              onClick={() => closeMenu(isOpen)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="arena-header__actions">
          <Link className="arena-header__cta" to="/home">Начать</Link>
          <button
            ref={menuButtonRef}
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
