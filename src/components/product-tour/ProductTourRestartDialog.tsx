import { useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface ProductTourRestartDialogProps {
  onCancel: () => void
  onConfirm: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function ProductTourRestartDialog({ onCancel, onConfirm, returnFocusRef }: ProductTourRestartDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const trigger = returnFocusRef?.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    const portal = dialogRef.current?.parentElement
    const background = [...document.body.children]
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== portal)
      .map((element) => ({ element, inert: element.inert }))
    const focusable = () => [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
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
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) cancelButtonRef.current?.focus()
    }
    const overflow = document.body.style.overflow
    background.forEach(({ element }) => { element.inert = true })
    document.body.style.overflow = 'hidden'
    cancelButtonRef.current?.focus()
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      document.body.style.overflow = overflow
      background.forEach(({ element, inert }) => { element.inert = inert })
      window.requestAnimationFrame(() => trigger?.isConnected && trigger.focus())
    }
  }, [onCancel, returnFocusRef])

  return createPortal(
    <div className="product-tour-error-backdrop" role="presentation">
      <section ref={dialogRef} className="product-tour-error" role="dialog" aria-modal="true" aria-labelledby="product-tour-restart-title" aria-describedby="product-tour-restart-description">
        <span className="product-tour-error__eyebrow">Тур по продукту</span>
        <h2 id="product-tour-restart-title">Начать тур заново?</h2>
        <p id="product-tour-restart-description">Текущий прогресс тура будет сброшен. Продолжить с этого шага не получится.</p>
        <div className="product-tour-error__actions">
          <button ref={cancelButtonRef} type="button" onClick={onCancel}>Остаться</button>
          <button className="is-primary" type="button" onClick={onConfirm}>Начать заново</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
