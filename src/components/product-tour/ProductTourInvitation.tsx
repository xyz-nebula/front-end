import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ProductTourInvitationProps {
  onStart: () => void
  onLater: () => void
  onNever: () => void
}

export function ProductTourInvitation({ onStart, onLater, onNever }: ProductTourInvitationProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const startButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const trigger = document.querySelector<HTMLElement>('[aria-label="Меню профиля"]')
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    const portal = dialogRef.current?.parentElement
    const background = [...document.body.children]
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== portal)
      .map((element) => ({ element, inert: element.inert }))
    const focusable = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])].filter((element) => element.getClientRects().length > 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onLater()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) startButtonRef.current?.focus()
    }
    const overflow = document.body.style.overflow
    background.forEach(({ element }) => { element.inert = true })
    document.body.style.overflow = 'hidden'
    startButtonRef.current?.focus()
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      document.body.style.overflow = overflow
      background.forEach(({ element, inert }) => { element.inert = inert })
      window.requestAnimationFrame(() => trigger?.isConnected && trigger.focus())
    }
  }, [onLater])

  return createPortal(
    <div className="product-tour-invitation-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="product-tour-invitation"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-tour-invitation-title"
        aria-describedby="product-tour-invitation-description"
      >
        <p className="product-tour-invitation__eyebrow">Тур по продукту</p>
        <h1 id="product-tour-invitation-title">Познакомимся с Ареной?</h1>
        <p id="product-tour-invitation-description" className="product-tour-invitation__description">За 5–10 минут ты выберешь кейс, подготовишь позицию, проведёшь короткие голосовые переговоры с AI-оппонентом и получишь персональный разбор с рекомендациями. Понадобится микрофон.</p>
        <div className="product-tour-invitation__actions">
          <button ref={startButtonRef} type="button" onClick={onStart}>Начать тур</button>
          <button type="button" onClick={onLater}>Позже</button>
          <button type="button" onClick={onNever}>Больше не показывать</button>
        </div>
        <p className="product-tour-invitation__hint">Тур всегда можно запустить позже из меню профиля.</p>
      </section>
    </div>,
    document.body,
  )
}
