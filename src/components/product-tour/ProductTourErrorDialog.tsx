import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ProductTourErrorDialogProps {
  onClose: () => void
  onRestart: () => void
}

export function ProductTourErrorDialog({ onClose, onRestart }: ProductTourErrorDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const primaryButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const portal = dialogRef.current?.parentElement
    const background = [...document.body.children]
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== portal)
      .map((element) => ({ element, inert: element.inert }))
    const focusable = () => [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
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
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) primaryButtonRef.current?.focus()
    }
    const overflow = document.body.style.overflow
    background.forEach(({ element }) => { element.inert = true })
    document.body.style.overflow = 'hidden'
    primaryButtonRef.current?.focus()
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      document.body.style.overflow = overflow
      background.forEach(({ element, inert }) => { element.inert = inert })
      window.requestAnimationFrame(() => trigger?.isConnected && trigger.focus())
    }
  }, [onClose])

  return createPortal(
    <div className="product-tour-error-backdrop" role="presentation">
      <section ref={dialogRef} className="product-tour-error" role="dialog" aria-modal="true" aria-labelledby="product-tour-error-title" aria-describedby="product-tour-error-description">
        <span className="product-tour-error__eyebrow">Тур по продукту</span>
        <h2 id="product-tour-error-title">Не удалось продолжить тур</h2>
        <p id="product-tour-error-description">Нужный элемент не появился на странице. Начни тур заново или закрой его и вернись позже.</p>
        <div className="product-tour-error__actions">
          <button ref={primaryButtonRef} className="is-primary" type="button" onClick={onRestart}>Начать заново</button>
          <button type="button" onClick={onClose}>Закрыть тур</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
