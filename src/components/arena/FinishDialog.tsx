import { useEffect, useRef, type RefObject } from 'react'

import { AppButton } from '@/components/ui/AppButton'

interface FinishDialogProps {
  onCancel: () => void
  onConfirm: () => void
  busy?: boolean
  error?: string | null
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function FinishDialog({ onCancel, onConfirm, busy = false, error = null, returnFocusRef }: FinishDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const onCancelRef = useRef(onCancel)
  const busyRef = useRef(busy)

  useEffect(() => { onCancelRef.current = onCancel }, [onCancel])
  useEffect(() => { busyRef.current = busy }, [busy])

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const returnFocusTarget = returnFocusRef?.current ?? trigger
    const background = [...(backdropRef.current?.parentElement?.children ?? [])]
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdropRef.current)
      .map((element) => ({ element, inert: element.inert }))
    const focusable = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []), ...document.querySelectorAll<HTMLElement>('[data-product-tour-tooltip] button:not([disabled])')]
      .filter((element) => element.getClientRects().length > 0)
    const containsFocus = (node: Node | null) => Boolean(
      node && (dialogRef.current?.contains(node) || document.querySelector('[data-product-tour-tooltip]')?.contains(node)),
    )
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault()
        onCancelRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      if (!containsFocus(document.activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !containsFocus(event.target)) focusable()[0]?.focus()
    }
    const overflow = document.body.style.overflow
    background.forEach(({ element }) => { element.inert = true })
    document.body.style.overflow = 'hidden'
    focusable()[0]?.focus()
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      document.body.style.overflow = overflow
      background.forEach(({ element, inert }) => { element.inert = inert })
      window.requestAnimationFrame(() => {
        if (returnFocusTarget?.isConnected) returnFocusTarget.focus()
      })
    }
  }, [returnFocusRef])

  return (
    <div className="modal-backdrop" ref={backdropRef} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <section className="finish-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="finish-dialog-title" data-tour-id="finish-dialog">
        <p className="eyebrow">Завершение тренировки</p>
        <h2 id="finish-dialog-title">Закончить переговоры?</h2>
        <p>После завершения новые реплики добавить не получится. Ответы уже сохранены и попадут в разбор.</p>
        {error && <p className="finish-dialog__error" role="alert">{error}</p>}
        <div>
          <AppButton type="button" variant="secondary" onClick={onCancel} disabled={busy}>Продолжить диалог</AppButton>
          <AppButton type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Завершаем…' : 'Завершить'}</AppButton>
        </div>
      </section>
    </div>
  )
}
