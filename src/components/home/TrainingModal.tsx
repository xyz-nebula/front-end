import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppButton } from '@/components/ui/AppButton'
import { useDomainServices } from '@/services/domainServices'
import { isServiceError } from '@/types/api'
import type { NegotiationMode } from '@/types/negotiation'
import type { TrainingCase } from '@/types/case'

interface TrainingModalProps {
  item: TrainingCase
  onClose: () => void
}

export function TrainingModal({ item, onClose }: TrainingModalProps) {
  const navigate = useNavigate()
  const { negotiationClient } = useDomainServices()
  const [mode, setMode] = useState<NegotiationMode>('text')
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !isStarting) onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isStarting, onClose])

  const startTraining = async () => {
    if (isStarting || mode !== 'text') return
    const storageKey = `arena.pending-create.${item.id}.${mode}`
    let commandId: string
    try {
      commandId = window.sessionStorage.getItem(storageKey) ?? crypto.randomUUID()
      window.sessionStorage.setItem(storageKey, commandId)
    } catch {
      commandId = crypto.randomUUID()
    }

    setIsStarting(true)
    setError(null)
    try {
      const session = await negotiationClient.createSession({
        caseId: item.id,
        mode,
        clientCommandId: commandId,
      })
      try {
        window.sessionStorage.removeItem(storageKey)
      } catch {
        // Session creation has already been confirmed; storage cleanup is best-effort.
      }
      navigate(`/arena/${session.id}`)
    } catch (caught) {
      setError(isServiceError(caught) || caught instanceof Error
        ? caught.message
        : 'Не удалось начать тренировку. Попробуйте ещё раз.')
      setIsStarting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isStarting && onClose()}>
      <section className="training-modal" role="dialog" aria-modal="true" aria-labelledby="training-modal-title">
        <button className="training-modal__close" type="button" onClick={onClose} disabled={isStarting} aria-label="Закрыть">×</button>
        <p className="eyebrow">Подготовка к тренировке</p>
        <h2 id="training-modal-title">{item.title}</h2>
        <p className="training-modal__intro">{item.description}</p>
        <div className="training-modal__opponent">
          <div className="avatar">{item.opponent.charAt(0)}</div>
          <div><span>Ваш AI-оппонент</span><strong>{item.opponent}</strong></div>
        </div>
        <div className="training-modal__facts">
          <div><span>Время</span><strong>{item.duration}</strong></div>
          <div><span>Сложность</span><strong>{item.difficulty}</strong></div>
          <div><span>Формат</span><strong>{mode === 'text' ? 'Текстовый диалог' : 'Голосовой диалог'}</strong></div>
        </div>
        <fieldset className="training-modal__modes" disabled={isStarting}>
          <legend>Выберите формат</legend>
          <label className={mode === 'text' ? 'is-selected' : ''}>
            <input type="radio" name="training-mode" value="text" checked={mode === 'text'} onChange={() => setMode('text')} />
            <span aria-hidden="true">⌨</span><strong>Текст</strong><small>Обменивайтесь сообщениями в удобном темпе</small>
          </label>
          <label className="is-disabled" aria-disabled="true">
            <input type="radio" name="training-mode" value="voice" disabled />
            <span aria-hidden="true">◉</span><strong>Голос</strong><small>Скоро — живой разговор с AI-оппонентом</small>
          </label>
        </fieldset>
        <div className="training-modal__tip"><span>Совет</span>Сначала сформулируйте желаемый результат и минимально приемлемый исход.</div>
        {error && <div className="form-alert training-modal__error" role="alert">{error}</div>}
        <AppButton type="button" className="training-modal__button" onClick={() => void startTraining()} disabled={isStarting || mode !== 'text'}>{isStarting ? 'Создаём арену…' : 'Начать тренировку'}</AppButton>
        <small>Тренировка сохраняется автоматически — её можно продолжить после перезагрузки.</small>
      </section>
    </div>
  )
}
