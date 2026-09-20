import { useEffect } from 'react'

import { AppButton } from '@/components/ui/AppButton'
import type { TrainingCase } from '@/types/case'

interface TrainingModalProps {
  item: TrainingCase
  onClose: () => void
}

export function TrainingModal({ item, onClose }: TrainingModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="training-modal" role="dialog" aria-modal="true" aria-labelledby="training-modal-title">
        <button className="training-modal__close" type="button" onClick={onClose} aria-label="Закрыть">×</button>
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
          <div><span>Формат</span><strong>Текстовый диалог</strong></div>
        </div>
        <div className="training-modal__tip"><span>Совет</span>Сначала сформулируйте желаемый результат и минимально приемлемый исход.</div>
        <AppButton type="button" className="training-modal__button" onClick={onClose}>Начать демо-тренировку</AppButton>
        <small>В прототипе это окно демонстрирует этап подготовки к кейсу.</small>
      </section>
    </div>
  )
}
