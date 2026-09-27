import { useEffect, useRef, type RefObject } from 'react'

import type { TrainingCase } from '@/types/case'

interface CaseConditionDrawerProps {
  item: TrainingCase
  roleIndex: 0 | 1
  triggerRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}

export function CaseConditionDrawer({ item, roleIndex, triggerRef, onClose }: CaseConditionDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const trigger = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        event.preventDefault()
        closeButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      trigger?.focus()
    }
  }, [onClose, triggerRef])

  const opponentIndex = roleIndex === 0 ? 1 : 0

  return <div className="preparation-case-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="preparation-case-drawer" role="dialog" aria-modal="true" aria-labelledby="preparation-case-title">
      <header>
        <div><span>Условие кейса</span><h2 id="preparation-case-title">{item.title}</h2></div>
        <button ref={closeButtonRef} type="button" aria-label="Закрыть условие кейса" onClick={onClose}>×</button>
      </header>
      <div className="preparation-case-drawer__content">
        <div className="preparation-case-drawer__badges"><span>{item.category}</span><span>{item.difficulty}</span><span>{item.duration}</span></div>
        <section><h3>Ситуация</h3><p>{item.synopsis}</p>{item.description && item.description !== item.synopsis && <p>{item.description}</p>}</section>
        <section><h3>Участники</h3><div className="preparation-case-drawer__roles">
          <div><span>Ваша роль</span><strong>{item.roles[roleIndex]}</strong></div>
          <span aria-hidden="true">↔</span>
          <div><span>AI-оппонент</span><strong>{item.roles[opponentIndex]}</strong></div>
        </div></section>
      </div>
    </aside>
  </div>
}
