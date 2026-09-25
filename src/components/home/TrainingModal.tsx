import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import profileArtwork from '@/assets/home/profile-kirill.webp'
import directorArtwork from '@/assets/home/role-director.webp'
import { clearPendingSessionCreate, getOrCreatePendingSessionCreate, type PendingSessionCreate } from '@/features/arena/pendingSessionCreate'
import { useDomainServices } from '@/services/domainServices'
import { isServiceError } from '@/types/api'
import type { TrainingCase } from '@/types/case'
import type { NegotiationMode } from '@/types/negotiation'

interface TrainingModalProps {
  item: TrainingCase
  onClose: () => void
}

interface CaseBrief {
  situation: string[]
  roles: [string, string]
  summaries: [string, string]
}

const caseBriefs: Record<string, CaseBrief> = {
  'salary-review': {
    situation: [
      'Вы считаете, что ваши результаты и выросшая ответственность заслуживают пересмотра зарплаты. Руководитель ценит ваш вклад, но бюджет команды ограничен и решение потребует убедительных аргументов.',
      'Подготовьте конкретные достижения и обсудите условия, которые устроят обе стороны. У руководителя могут быть свои критерии и сроки для повышения.',
    ],
    roles: ['Сотрудник', 'Руководитель'],
    summaries: ['Добивается пересмотра условий и готов подтвердить свой вклад.', 'Отвечает за бюджет команды и принимает решение о повышении.'],
  },
  'difficult-employee': {
    situation: ['Работа сотрудника стала менее предсказуемой: задачи задерживаются, а обратная связь вызывает защитную реакцию.', 'Обсудите конкретные примеры, выясните причины и договоритесь о понятных следующих шагах.'],
    roles: ['Руководитель', 'Сотрудник'],
    summaries: ['Хочет сохранить доверие и вернуть результативную работу.', 'Объясняет свою позицию и ожидания от руководителя.'],
  },
  'missed-deadline': {
    situation: ['Важный срок сорван, и это влияет на работу всей команды. Причины задержки и новый реалистичный план пока не согласованы.', 'Выясните, что произошло, определите последствия и договоритесь о сроках восстановления.'],
    roles: ['Заказчик', 'Подрядчик'],
    summaries: ['Отвечает за общий срок и хочет восстановить контроль над проектом.', 'Объясняет задержку и предлагает план завершения работы.'],
  },
  refund: {
    situation: ['Купленный продукт не оправдал ожиданий, но менеджер не спешит подтверждать возврат.', 'Сформулируйте факты и желаемое решение, сохраняя спокойный и конструктивный тон.'],
    roles: ['Покупатель', 'Менеджер'],
    summaries: ['Добивается справедливого возврата денег.', 'Проверяет условия возврата и защищает интересы компании.'],
  },
  'price-talks': {
    situation: ['Покупатель просит дополнительную скидку, которая заметно сократит маржу сделки.', 'Проверьте интересы другой стороны и предложите обмен условиями вместо уступки в цене без компенсации.'],
    roles: ['Продавец', 'Закупщик'],
    summaries: ['Сохраняет ценность предложения и маржу.', 'Ищет лучшие условия для своей компании.'],
  },
  'team-conflict': {
    situation: ['Между коллегами накопилось напряжение, и рабочее обсуждение быстро переходит в взаимные претензии.', 'Помогите сторонам отделить факты от эмоций и вернуться к общей задаче.'],
    roles: ['Тимлид', 'Сотрудник'],
    summaries: ['Помогает команде договориться и продолжить работу.', 'Рассказывает о своих потребностях и причинах конфликта.'],
  },
}

export function TrainingModal({ item, onClose }: TrainingModalProps) {
  const navigate = useNavigate()
  const { isRealVoice, negotiationClient } = useDomainServices()
  const [mode, setMode] = useState<NegotiationMode>(isRealVoice ? 'voice' : 'text')
  const [role, setRole] = useState<0 | 1>(0)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingCreateRef = useRef<PendingSessionCreate | null>(null)
  const startingRef = useRef(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const brief = caseBriefs[item.id]

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !isStarting) onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
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
    <div className="home-case-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isStarting && onClose()}>
      <section className="home-case-modal" role="dialog" aria-modal="true" aria-labelledby="training-modal-title">
        <div className="home-case-modal__scroll">
          <button className="home-case-modal__close" ref={closeButtonRef} type="button" onClick={onClose} disabled={isStarting} aria-label="Закрыть">×</button>
          <div className="home-case-modal__badges"><span>{item.category}</span><span>{item.difficulty}</span><span>{item.duration}</span></div>
          <h2 id="training-modal-title">{item.title}</h2>
          <p className="home-case-modal__intro">{item.description}</p>
          <div className="home-case-modal__section"><h3>Ситуация</h3>{brief.situation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          <div className="home-case-modal__section">
            <h3>Выберите свою роль</h3>
            <p>Вторая роль автоматически станет AI-оппонентом.</p>
            <div className="home-case-modal__roles" role="radiogroup" aria-label="Выберите свою роль">
              {brief.roles.map((title, index) => <label className={`home-case-modal__role ${role === index ? 'is-selected' : ''}`} key={title}>
                <input type="radio" name="case-role" checked={role === index} onChange={() => setRole(index as 0 | 1)} disabled={isStarting} />
                <img src={/руководител|директор/i.test(title) ? directorArtwork : profileArtwork} alt="" />
                <span className="home-case-modal__role-copy"><span className="home-case-modal__role-badge">{role === index ? 'Ваша роль' : 'AI-оппонент'}</span><strong>{title}</strong><small>{brief.summaries[index]}</small></span>
                <span className="home-case-modal__radio-mark" aria-hidden="true">{role === index ? '✓' : ''}</span>
              </label>)}
            </div>
            <p className="home-case-modal__demo-note">Выбор роли показан для демо и пока не влияет на сценарий переговоров.</p>
          </div>
          <fieldset className="home-case-modal__modes" disabled={isStarting}>
            <legend>Формат тренировки</legend>
            {!isRealVoice && <label className={mode === 'text' ? 'is-selected' : ''}><input type="radio" name="training-mode" value="text" checked={mode === 'text'} onChange={() => setMode('text')} />Текст</label>}
            <label className={mode === 'voice' ? 'is-selected' : ''}><input type="radio" name="training-mode" value="voice" checked={mode === 'voice'} onChange={() => setMode('voice')} />Голос</label>
          </fieldset>
          {error && <div className="form-alert home-case-modal__error" role="alert">{error}</div>}
        </div>
        <div className="home-case-modal__footer"><button className="arena-home__primary-button" type="button" onClick={() => void startTraining()} disabled={isStarting}>{isStarting ? 'Создаём арену…' : 'Начать тренировку'} <span aria-hidden="true">→</span></button></div>
      </section>
    </div>
  )
}
