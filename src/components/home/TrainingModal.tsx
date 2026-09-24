import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppButton } from '@/components/ui/AppButton'
import {
  clearPendingSessionCreate,
  getOrCreatePendingSessionCreate,
  type PendingSessionCreate,
} from '@/features/arena/pendingSessionCreate'
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
  const { isRealVoice, negotiationClient } = useDomainServices()
  const [mode, setMode] = useState<NegotiationMode>(isRealVoice ? 'voice' : 'text')
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingCreateRef = useRef<PendingSessionCreate | null>(null)
  const startingRef = useRef(false)

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
    if (startingRef.current) return
    const storageKey = `arena.pending-create.${item.id}.${mode}`
    const command = getOrCreatePendingSessionCreate(storageKey, {
      sourceContext: `training:${item.id}:${mode}`,
      caseId: item.id,
      mode,
    }, pendingCreateRef.current)
    pendingCreateRef.current = command

    startingRef.current = true
    setIsStarting(true)
    setError(null)
    try {
      const session = await negotiationClient.createSession({
        caseId: item.id,
        caseName: item.title,
        mode,
        clientCommandId: command.clientCommandId,
      })
      clearPendingSessionCreate(storageKey)
      pendingCreateRef.current = null
      navigate(`/arena/${session.id}`)
    } catch (caught) {
      setError(isServiceError(caught) || caught instanceof Error
        ? caught.message
        : 'Не удалось начать тренировку. Попробуйте ещё раз.')
      startingRef.current = false
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
          <legend>{isRealVoice ? 'Доступный формат' : 'Выберите формат'}</legend>
          {!isRealVoice && <label className={mode === 'text' ? 'is-selected' : ''}>
            <input type="radio" name="training-mode" value="text" checked={mode === 'text'} onChange={() => setMode('text')} />
            <span aria-hidden="true">⌨</span><strong>Текст</strong><small>Обменивайтесь сообщениями в удобном темпе</small>
          </label>}
          <label className={mode === 'voice' ? 'is-selected' : ''}>
            <input type="radio" name="training-mode" value="voice" checked={mode === 'voice'} onChange={() => setMode('voice')} />
            <span aria-hidden="true">◉</span><strong>Голос</strong><small>{isRealVoice ? 'Разговор через микрофон с AI-оппонентом' : 'Демо-диалог с озвученным ответом оппонента'}</small>
          </label>
        </fieldset>
        {isRealVoice && <div className="training-modal__real-note" role="note">Карточка задаёт название разговора. Роль и сценарий пока не передаются AI-оппоненту.</div>}
        <div className="training-modal__tip"><span>Совет</span>Сначала сформулируйте желаемый результат и минимально приемлемый исход.</div>
        {error && <div className="form-alert training-modal__error" role="alert">{error}</div>}
        <AppButton type="button" className="training-modal__button" onClick={() => void startTraining()} disabled={isStarting}>{isStarting ? 'Создаём арену…' : 'Начать тренировку'}</AppButton>
        <small>Тренировка сохраняется автоматически — её можно продолжить после перезагрузки.</small>
      </section>
    </div>
  )
}
