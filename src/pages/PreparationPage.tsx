import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import profileArtwork from '@/assets/home/profile-kirill.webp'
import { ArenaCubeMark } from '@/components/ui/ArenaCubeMark'
import { AppButton } from '@/components/ui/AppButton'
import { clearPendingSessionCreate, getOrCreatePendingSessionCreate, type PendingSessionCreate } from '@/features/arena/pendingSessionCreate'
import {
  completedPreparationSteps,
  PREPARATION_STEP_IDS,
  readPreparationDraft,
  savePreparationDraft,
  saveSessionPreparation,
  serializePreparation,
  type PreparationStepId,
} from '@/features/preparation/preparation'
import { useDomainServices } from '@/services/domainServices'
import { isServiceError } from '@/types/api'
import type { TrainingCase } from '@/types/case'
import type { NegotiationMode } from '@/types/negotiation'
import type { PreparationDraft } from '@/types/preparation'
import '@/styles/preparation.css'

type PreparationSectionId = 'analysis' | 'strategy' | 'tactics'

interface StepInfo { id: PreparationStepId; label: string; section: PreparationSectionId }
interface SectionInfo { id: PreparationSectionId; label: string; steps: PreparationStepId[] }

const steps: StepInfo[] = [
  { id: 'root-conflict', label: 'Корневой конфликт', section: 'analysis' },
  { id: 'strategic-goal', label: 'Стратегическая цель', section: 'analysis' },
  { id: 'proposals', label: 'Предложения', section: 'analysis' },
  { id: 'layers', label: 'Анализ по слоям', section: 'analysis' },
  { id: 'swot', label: 'SWOT-анализ', section: 'strategy' },
  { id: 'negotiation-goal', label: 'Цель на переговоры', section: 'strategy' },
  { id: 'bargaining', label: 'Грани торга', section: 'strategy' },
  { id: 'batna', label: 'BATNA', section: 'strategy' },
  { id: 'scenario', label: 'Сценарий', section: 'tactics' },
  { id: 'opening', label: 'Загрузка', section: 'tactics' },
]

const sections: SectionInfo[] = [
  { id: 'analysis', label: 'Анализ ситуации', steps: ['root-conflict', 'strategic-goal', 'proposals', 'layers'] },
  { id: 'strategy', label: 'Стратегия', steps: ['swot', 'negotiation-goal', 'bargaining', 'batna'] },
  { id: 'tactics', label: 'Тактика', steps: ['scenario', 'opening'] },
]

interface PreparationFieldProps {
  label: string
  help: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

function PreparationField({ label, help, placeholder, value, onChange }: PreparationFieldProps) {
  return (
    <label className="preparation-field">
      <span className="preparation-field__title">{label}</span>
      <span className="preparation-field__help">{help}</span>
      <textarea aria-label={label} maxLength={2000} rows={4} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      <small>{value.length}/2000</small>
    </label>
  )
}

interface PreparationSectionProps {
  id: PreparationStepId
  title: string
  description: string
  children: React.ReactNode
}

function PreparationSection({ id, title, description, children }: PreparationSectionProps) {
  return <section className="preparation-card" id={`preparation-${id}`} aria-labelledby={`preparation-${id}-title`}>
    <header><div><span>Шаг {PREPARATION_STEP_IDS.indexOf(id) + 1}</span><h2 id={`preparation-${id}-title`}>{title}</h2></div><p>{description}</p></header>
    <div className="preparation-card__fields">{children}</div>
  </section>
}

function parseRole(value: string | null): 0 | 1 | null { return value === '0' ? 0 : value === '1' ? 1 : null }
function parseMode(value: string | null): NegotiationMode | null { return value === 'text' || value === 'voice' ? value : null }
function parseSection(value: string | null): PreparationSectionId {
  return value === 'strategy' || value === 'tactics' ? value : 'analysis'
}
function preparationFingerprint(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function PreparationPage() {
  const { caseId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const roleIndex = parseRole(searchParams.get('role'))
  const mode = parseMode(searchParams.get('mode'))
  const activeSectionId = parseSection(searchParams.get('section'))
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0]
  const navigate = useNavigate()
  const { negotiationClient } = useDomainServices()
  const [cases, setCases] = useState<TrainingCase[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<PreparationDraft>(() => roleIndex === null ? readPreparationDraft(caseId, 0) : readPreparationDraft(caseId, roleIndex))
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saved')
  const [activeStep, setActiveStep] = useState<PreparationStepId>(activeSection.steps[0])
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const pendingRef = useRef<PendingSessionCreate | null>(null)

  const trainingCase = cases.find((item) => item.id === caseId)
  const completed = useMemo(() => completedPreparationSteps(draft), [draft])
  const progress = completed.length * 10

  const loadCases = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try { setCases(await negotiationClient.listCases()) }
    catch (caught) { setLoadError(caught instanceof Error ? caught.message : 'Не удалось загрузить кейс.') }
    finally { setLoading(false) }
  }, [negotiationClient])

  useEffect(() => {
    let active = true
    void negotiationClient.listCases().then((items) => {
      if (active) setCases(items)
    }).catch((caught: unknown) => {
      if (active) setLoadError(caught instanceof Error ? caught.message : 'Не удалось загрузить кейс.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [negotiationClient])

  useEffect(() => {
    if (roleIndex === null) return
    const timer = window.setTimeout(() => {
      try { savePreparationDraft(caseId, roleIndex, draft); setSaveState('saved') }
      catch { setSaveState('error') }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [caseId, draft, roleIndex])

  useEffect(() => {
    if (searchParams.get('section') === activeSectionId) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('section', activeSectionId)
    setSearchParams(nextParams, { replace: true })
  }, [activeSectionId, searchParams, setSearchParams])

  const patchDraft = <K extends keyof PreparationDraft>(key: K, value: PreparationDraft[K]) => {
    setSaveState('saving')
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const selectSection = (sectionId: PreparationSectionId) => {
    const section = sections.find((item) => item.id === sectionId) ?? sections[0]
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('section', section.id)
    setSearchParams(nextParams, { replace: true })
    setActiveStep(section.steps[0])
    window.requestAnimationFrame(() => document.querySelector('.preparation-layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const scrollToStep = (id: PreparationStepId) => {
    setActiveStep(id)
    document.getElementById(`preparation-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const sectionIndex = sections.findIndex((section) => section.id === activeSectionId)
  const sectionCompleted = (section: SectionInfo) => section.steps.filter((step) => completed.includes(step)).length

  const renderPreparationNavigation = (mobile = false) => <nav aria-label={mobile ? 'Разделы подготовки на мобильном устройстве' : 'Разделы подготовки'}>
    {sections.map((section) => {
      const isActive = section.id === activeSectionId
      return <section className={isActive ? 'is-active' : ''} key={section.id}>
        <button className="preparation-section-toggle" type="button" aria-expanded={isActive} onClick={() => selectSection(section.id)}>
          <span><strong>{section.label}</strong><small>{sectionCompleted(section)} из {section.steps.length}</small></span><i aria-hidden="true">{isActive ? '⌃' : '⌄'}</i>
        </button>
        {isActive && <div className="preparation-section-steps">{steps.filter((step) => step.section === section.id).map((step) => <button type="button" className={activeStep === step.id ? 'is-active' : ''} onClick={() => scrollToStep(step.id)} key={step.id}><span className={completed.includes(step.id) ? 'is-complete' : ''}>{completed.includes(step.id) ? '✓' : ''}</span>{step.label}</button>)}</div>}
      </section>
    })}
  </nav>

  const startDuel = async () => {
    if (!trainingCase || roleIndex === null || mode === null || isStarting) return
    const preparations = serializePreparation(draft)
    const sourceContext = `preparation:${trainingCase.id}:${roleIndex}:${mode}:${preparationFingerprint(preparations)}`
    const storageKey = `arena.pending-create.${trainingCase.id}.${roleIndex}.${mode}`
    const command = getOrCreatePendingSessionCreate(storageKey, {
      sourceContext, caseId: trainingCase.id, mode,
    }, pendingRef.current)
    pendingRef.current = command
    setIsStarting(true)
    setStartError(null)
    try {
      const session = await negotiationClient.createSession({
        caseId: trainingCase.id,
        caseName: trainingCase.title,
        mode,
        clientCommandId: command.clientCommandId,
        preparations,
      })
      saveSessionPreparation(session.id, {
        caseId: trainingCase.id,
        caseTitle: trainingCase.title,
        userRole: trainingCase.roles[roleIndex],
        opponentRole: trainingCase.roles[roleIndex === 0 ? 1 : 0],
        draft,
      })
      clearPendingSessionCreate(storageKey)
      navigate(`/arena/${session.id}`)
    } catch (caught) {
      setStartError(isServiceError(caught) || caught instanceof Error ? caught.message : 'Не удалось начать поединок.')
      setIsStarting(false)
    }
  }

  if (roleIndex === null || mode === null) return <main className="arena-state"><span className="arena-state__mark">!</span><h1>Не выбран формат подготовки</h1><p>Вернитесь к кейсам и выберите свою роль и формат тренировки.</p><AppButton to="/home">К кейсам</AppButton></main>
  if (loading) return <main className="arena-state" aria-live="polite"><span className="arena-state__spinner" /><h1>Загружаем подготовку…</h1></main>
  if (loadError || !trainingCase) return <main className="arena-state"><span className="arena-state__mark">!</span><h1>Не удалось открыть кейс</h1><p>{loadError ?? 'Кейс не найден.'}</p><div><AppButton type="button" onClick={() => void loadCases()}>Повторить</AppButton><AppButton to="/home" variant="secondary">К кейсам</AppButton></div></main>

  return <div className="preparation-page">
    <header className="preparation-header"><div className="preparation-shell preparation-header__inner">
      <Link className="preparation-header__brand" to="/"><ArenaCubeMark /><span>АРЕНА</span></Link>
      <div className="preparation-header__profile"><span>🔥 <strong>4</strong></span><img src={profileArtwork} alt="" /></div>
    </div></header>
    <main className="preparation-shell preparation-main">
      <div className="preparation-context">
        <Link to="/home">← Назад</Link><div><strong>{trainingCase.title}</strong><span>Вы: {trainingCase.roles[roleIndex]}</span></div>
        <span className={`preparation-save is-${saveState}`} role="status">{saveState === 'saving' ? 'Сохраняем…' : saveState === 'error' ? 'Не сохранено' : 'Сохранено ✓'}</span>
      </div>
      <section className="preparation-intro">
        <div><h1>Подготовка к переговорам</h1><p>Сформируйте свою позицию перед поединком. Все поля необязательны — начать можно в любой момент.</p></div>
        <div className="preparation-progress"><span>Заполнено {completed.length} из 10</span><div role="progressbar" aria-label="Прогресс подготовки" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div></div>
        <button className="preparation-start" type="button" disabled={isStarting} onClick={() => void startDuel()}>{isStarting ? 'Создаём поединок…' : 'Начать поединок'} <span>→</span></button>
      </section>
      {startError && <div className="form-alert preparation-error" role="alert">{startError}</div>}
      <div className="preparation-mobile-nav">{renderPreparationNavigation(true)}</div>
      <div className="preparation-layout">
        <aside className="preparation-sidebar">{renderPreparationNavigation()}</aside>
        <div className="preparation-content">
          {activeSectionId === 'analysis' && <>
            <PreparationSection id="root-conflict" title="Корневой конфликт" description="Посмотрите на ситуацию с позиции беспристрастного наблюдателя."><PreparationField label="Корневой конфликт" help="Проблема, затрагивающая интересы всех сторон." placeholder="Опишите главное противоречие между сторонами…" value={draft.rootConflict} onChange={(value) => patchDraft('rootConflict', value)} /></PreparationSection>
            <PreparationSection id="strategic-goal" title="Стратегическая цель ситуации" description="Сформулируйте более широкий желаемый результат для всех участников."><PreparationField label="Стратегическая цель" help="Результат, который разрешает корневой конфликт и учитывает интересы сторон." placeholder="Как должна измениться ситуация в результате…" value={draft.strategicGoal} onChange={(value) => patchDraft('strategicGoal', value)} /></PreparationSection>
            <PreparationSection id="proposals" title="Предложения, решающие конфликт" description="Соберите несколько возможных решений, не ограничиваясь одним вариантом."><PreparationField label="Предложения" help="Варианты, способные снять корневое противоречие." placeholder="Перечислите возможные решения, каждое с новой строки…" value={draft.proposals} onChange={(value) => patchDraft('proposals', value)} /></PreparationSection>
            <PreparationSection id="layers" title="Анализ по слоям" description="Разложите ситуацию на отдельные аспекты, влияющие на позиции сторон.">
            <div className="preparation-grid">{([
              ['economic', 'Экономический слой', 'Материальная выгода и ресурсы сторон.'], ['legal', 'Юридический слой', 'Законы, договоры, полномочия и правила.'], ['technical', 'Технический слой', 'Объективные факты: кто, что, где и когда.'], ['technological', 'Технологический слой', 'Как устроен процесс и что должно произойти дальше.'], ['emotional', 'Эмоциональный слой', 'Что участники чувствуют прямо сейчас.'], ['psychological', 'Психологический слой', 'Мотивы, ожидания, страхи и потребности.'], ['aesthetic', 'Эстетический слой', 'Насколько решение выглядит достойно или неловко.'], ['ethical', 'Этический слой', 'Представления о справедливости и порядочности.'],
            ] as const).map(([key, label, help]) => <PreparationField key={key} label={label} help={help} placeholder="Что важно учесть в этом слое…" value={draft.layers[key]} onChange={(value) => patchDraft('layers', { ...draft.layers, [key]: value })} />)}</div>
            </PreparationSection>
          </>}
          {activeSectionId === 'strategy' && <>
            <PreparationSection id="swot" title="SWOT-анализ" description="Оцените внутренние стороны вашей позиции и внешние обстоятельства."><div className="preparation-grid">{([
            ['strengths', 'Сильные стороны', 'Что усиливает вашу переговорную позицию.'], ['weaknesses', 'Слабые стороны', 'Что делает позицию уязвимой.'], ['opportunities', 'Возможности', 'Внешние обстоятельства, которые можно использовать.'], ['threats', 'Угрозы', 'Риски, способные ухудшить позицию или сорвать договорённость.'],
            ] as const).map(([key, label, help]) => <PreparationField key={key} label={label} help={help} placeholder={`Опишите ${label.toLocaleLowerCase('ru-RU')}…`} value={draft.swot[key]} onChange={(value) => patchDraft('swot', { ...draft.swot, [key]: value })} />)}</div></PreparationSection>
            <PreparationSection id="negotiation-goal" title="Цель на переговоры" description="Определите конкретный и проверяемый результат именно этого разговора."><PreparationField label="Цель на переговоры" help="Реалистичный результат, связанный с вашими интересами." placeholder="О чём вы хотите договориться…" value={draft.negotiationGoal} onChange={(value) => patchDraft('negotiationGoal', value)} /></PreparationSection>
            <PreparationSection id="bargaining" title="Грани торга" description="Заранее определите пространство, в котором готовы договариваться."><div className="preparation-grid">{([
            ['declared', 'Заявляемая позиция', 'Стартовые условия, оставляющие пространство для уступок.'], ['desired', 'Желаемая позиция', 'Конкретный результат, который полностью вас устраивает.'], ['redLine', 'Красная черта', 'Минимально приемлемый результат, хуже которого соглашаться невыгодно.'],
            ] as const).map(([key, label, help]) => <PreparationField key={key} label={label} help={help} placeholder={`Сформулируйте: ${label.toLocaleLowerCase('ru-RU')}…`} value={draft.bargaining[key]} onChange={(value) => patchDraft('bargaining', { ...draft.bargaining, [key]: value })} />)}</div></PreparationSection>
            <PreparationSection id="batna" title="BATNA" description="Подготовьте лучший вариант действий, если договориться не получится."><PreparationField label="BATNA" help="Ответ на вопрос: «Что я буду делать, если мы не придём к соглашению?»" placeholder="Опишите реалистичную альтернативу соглашению…" value={draft.batna} onChange={(value) => patchDraft('batna', value)} /></PreparationSection>
          </>}
          {activeSectionId === 'tactics' && <>
            <PreparationSection id="scenario" title="Сценарий" description="Продумайте маршрут разговора, сохраняя возможность адаптироваться."><PreparationField label="Сценарий" help="Вопросы, темы, аргументы, варианты решений и фиксация договорённостей." placeholder="Опишите последовательность шагов переговоров…" value={draft.scenario} onChange={(value) => patchDraft('scenario', value)} /></PreparationSection>
            <PreparationSection id="opening" title="Загрузка" description="Подготовьте короткую первую реплику, которая задаст направление разговора."><PreparationField label="Загрузка" help="Короткое начало без пересказа кейса, желательно с открытым вопросом." placeholder="Сформулируйте первую реплику до 30 секунд…" value={draft.opening} onChange={(value) => patchDraft('opening', value)} /></PreparationSection>
          </>}
          <div className="preparation-bottom">
            {sectionIndex > 0 && <button className="preparation-bottom__back" type="button" onClick={() => selectSection(sections[sectionIndex - 1].id)}><span>←</span> Назад</button>}
            <button className="preparation-bottom__next" type="button" disabled={isStarting} onClick={sectionIndex === sections.length - 1 ? () => void startDuel() : () => selectSection(sections[sectionIndex + 1].id)}>{sectionIndex === sections.length - 1 ? isStarting ? 'Создаём поединок…' : 'Начать поединок' : 'Далее'} <span>→</span></button>
          </div>
        </div>
      </div>
    </main>
  </div>
}
