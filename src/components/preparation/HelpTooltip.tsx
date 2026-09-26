import { useEffect, useId, useRef, useState } from 'react'

interface HelpTooltipProps {
  text: string
  label: string
}

export function HelpTooltip({ text, label }: HelpTooltipProps) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return <span className={`preparation-help ${open ? 'is-open' : ''}`} ref={rootRef}>
    <button type="button" aria-label={`Подсказка: ${label}`} aria-describedby={tooltipId} aria-expanded={open} onClick={() => setOpen((value) => !value)}>?</button>
    <span className="preparation-help__bubble" id={tooltipId} role="tooltip">{text}</span>
  </span>
}
