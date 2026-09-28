import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import profileArtwork from '@/assets/home/profile-kirill.webp'
import directorArtwork from '@/assets/home/role-director.webp'
import { useDomainServices } from '@/services/domainServices'
import { useProductTour } from '@/features/product-tour/useProductTour'
import type { TrainingCase } from '@/types/case'
import type { NegotiationMode } from '@/types/negotiation'

interface TrainingModalProps {
  item: TrainingCase
  onClose: () => void
}

const SWIPE_CLOSE_THRESHOLD = 90

export function TrainingModal({ item, onClose }: TrainingModalProps) {
  const navigate = useNavigate()
  const { isRealVoice } = useDomainServices()
  const productTour = useProductTour()
  const { send: sendTourEvent, state: tourState } = productTour
  const isTourCase = tourState?.status === 'active'
    && tourState.caseId === item.id
    && (tourState.stepId === 'role' || tourState.stepId === 'voice-format')
  const [mode, setMode] = useState<NegotiationMode>(isRealVoice || isTourCase ? 'voice' : 'text')
  const effectiveMode = isTourCase ? 'voice' : mode
  const [role, setRole] = useState<0 | 1 | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const backgroundElements = [...(backdropRef.current?.parentElement?.children ?? [])]
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdropRef.current)
      .map((element) => ({ element, wasInert: element.inert }))
    backgroundElements.forEach(({ element }) => { element.inert = true })

    const focusableElements = () => [...(modalRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []), ...document.querySelectorAll<HTMLElement>('[data-product-tour-tooltip] button:not([disabled])')]
      .filter((element) => !element.hidden && element.getClientRects().length > 0)
    const containsFocus = (node: Node | null) => Boolean(
      node && (modalRef.current?.contains(node) || document.querySelector('[data-product-tour-tooltip]')?.contains(node)),
    )

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = focusableElements()
      if (focusable.length === 0) {
        event.preventDefault()
        closeButtonRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (!containsFocus(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !containsFocus(event.target)) {
        closeButtonRef.current?.focus()
      }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      backgroundElements.forEach(({ element, wasInert }) => { element.inert = wasInert })
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])

  const startPreparation = () => {
    if (role === null) return
    const selectedMode = effectiveMode
    navigate(`/cases/${encodeURIComponent(item.id)}/preparation?role=${role}&mode=${selectedMode}&section=analysis`)
  }

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return
    dragStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointer events used by tests do not create an active browser pointer.
    }
    setIsDragging(true)
    setDragOffset(0)
  }

  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    setDragOffset(deltaY > 0 && Math.abs(deltaX) < deltaY ? deltaY : 0)
  }

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const start = dragStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    dragStartRef.current = null
    setIsDragging(false)
    if (!cancelled && deltaY >= SWIPE_CLOSE_THRESHOLD && deltaY > Math.abs(deltaX)) {
      onClose()
      return
    }
    setDragOffset(0)
  }

  return (
    <div className="home-case-backdrop" ref={backdropRef} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        ref={modalRef}
        className={`home-case-modal ${isDragging ? 'is-dragging' : ''}`}
        style={{ '--modal-drag-offset': `${dragOffset}px` } as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-modal-title"
      >
        <div
          className="home-case-modal__drag-handle"
          aria-hidden="true"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={finishDrag}
          onPointerCancel={(event) => finishDrag(event, true)}
        ><span /></div>
        <div className="home-case-modal__scroll">
          <button className="home-case-modal__close" ref={closeButtonRef} type="button" onClick={onClose} aria-label="Закрыть">×</button>
          <div className="home-case-modal__badges"><span>{item.category}</span><span>{item.difficulty}</span><span>{item.duration}</span></div>
          <h2 id="training-modal-title">{item.title}</h2>
          <p className="home-case-modal__intro">{item.description}</p>
          <div className="home-case-modal__section"><h3>Ситуация</h3><p>{item.synopsis}</p><p>{item.description}</p></div>
          <div className="home-case-modal__section">
            <h3>Выберите свою роль</h3>
            <p>Вторая роль автоматически станет AI-оппонентом.</p>
            <div className="home-case-modal__roles" role="radiogroup" aria-label="Выберите свою роль" data-tour-id="role-selector">
              {item.roles.map((title, index) => <label className={`home-case-modal__role ${role === index ? 'is-selected' : role !== null ? 'is-opponent' : ''}`} key={title}>
                <input type="radio" name="case-role" checked={role === index} onChange={() => {
                  const roleIndex = index as 0 | 1
                  setRole(roleIndex)
                  sendTourEvent({ type: 'role-selected', roleIndex })
                }} />
                <img src={/руководител|директор/i.test(title) ? directorArtwork : profileArtwork} alt="" width={400} height={400} loading="lazy" decoding="async" />
                <span className="home-case-modal__role-copy">{role !== null && <span className="home-case-modal__role-badge">{role === index ? 'Ваша роль' : 'AI-оппонент'}</span>}<strong>{title}</strong><small>{item.roleSummaries[index]}</small></span>
                <span className="home-case-modal__radio-mark" aria-hidden="true">{role === index ? '✓' : ''}</span>
              </label>)}
            </div>
            <p className="home-case-modal__demo-note">Выбранная роль сохранится в подготовке и поединке.</p>
          </div>
          <fieldset className="home-case-modal__modes">
            <legend>Формат тренировки</legend>
            {!isRealVoice && !isTourCase && <label className={mode === 'text' ? 'is-selected' : ''}><input type="radio" name="training-mode" value="text" checked={mode === 'text'} onChange={() => setMode('text')} />Текст</label>}
            <label className={effectiveMode === 'voice' ? 'is-selected' : ''}><input type="radio" name="training-mode" value="voice" checked={effectiveMode === 'voice'} onChange={() => setMode('voice')} />Голос</label>
          </fieldset>
        </div>
        <div className="home-case-modal__footer" data-tour-id="voice-preparation"><button className="arena-home__primary-button" type="button" onClick={startPreparation} disabled={role === null}>Начать подготовку <span aria-hidden="true">→</span></button></div>
      </section>
    </div>
  )
}
