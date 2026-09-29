import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useAuthRuntime } from '@/auth/runtime'
import { CaseConditionDrawer } from '@/components/preparation/CaseConditionDrawer'
import { PreparationContext, PreparationHeader, PreparationOverview } from '@/components/preparation/PreparationChrome'
import { PreparationForm } from '@/components/preparation/PreparationForm'
import { PreparationNavigation } from '@/components/preparation/PreparationNavigation'
import { AppButton } from '@/components/ui/AppButton'
import { parsePreparationSection, preparationSections, type PreparationSectionId } from '@/features/preparation/metadata'
import type { PreparationStepId } from '@/features/preparation/preparation'
import { usePreparationCase } from '@/features/preparation/usePreparationCase'
import { usePreparationDraft } from '@/features/preparation/usePreparationDraft'
import { useStartNegotiation } from '@/features/preparation/useStartNegotiation'
import { useProductTour } from '@/features/product-tour/useProductTour'
import { useDomainServices } from '@/services/domainServices'
import type { NegotiationMode } from '@/types/negotiation'
import '@/styles/preparation.css'

function parseRole(value: string | null): 0 | 1 | null { return value === '0' ? 0 : value === '1' ? 1 : null }
function parseMode(value: string | null): NegotiationMode | null { return value === 'text' || value === 'voice' ? value : null }

export function PreparationPage() {
  const { caseId = '' } = useParams()
  const { mockOwnerKey } = useAuthRuntime()
  if (!mockOwnerKey) throw new Error('PreparationPage requires an authenticated owner.')
  const [searchParams, setSearchParams] = useSearchParams()
  const roleIndex = parseRole(searchParams.get('role'))
  const mode = parseMode(searchParams.get('mode'))
  const activeSectionId = parsePreparationSection(searchParams.get('section'))
  const activeSection = preparationSections.find((section) => section.id === activeSectionId) ?? preparationSections[0]
  const navigate = useNavigate()
  const { negotiationClient, supportsTextNegotiation } = useDomainServices()
  const productTour = useProductTour()
  const { send: sendTourEvent, state: tourState } = productTour
  const loadedCase = usePreparationCase(negotiationClient, caseId)
  const preparation = usePreparationDraft(mockOwnerKey, caseId, roleIndex)
  const [activeStep, setActiveStep] = useState<PreparationStepId>(activeSection.steps[0])
  const [caseDrawerOpen, setCaseDrawerOpen] = useState(false)
  const caseButtonRef = useRef<HTMLButtonElement>(null)
  const openArena = useCallback((sessionId: string) => {
    sendTourEvent({ type: 'session-created', sessionId, userMessages: 0, aiMessages: 0 })
    navigate(`/arena/${sessionId}`)
  }, [navigate, sendTourEvent])
  const starter = useStartNegotiation(negotiationClient, {
    draft: preparation.draft,
    mode,
    ownerKey: mockOwnerKey,
    roleIndex,
    supportsTextNegotiation,
    trainingCase: loadedCase.trainingCase,
  }, openArena)

  useEffect(() => {
    if (searchParams.get('section') === activeSectionId) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('section', activeSectionId)
    setSearchParams(nextParams, { replace: true })
  }, [activeSectionId, searchParams, setSearchParams])

  useEffect(() => {
    if (
      tourState?.status === 'active'
      && tourState.stepId === 'voice-format'
      && tourState.caseId === caseId
      && tourState.roleIndex === roleIndex
      && mode === 'voice'
    ) sendTourEvent({ type: 'preparation-opened' })
  }, [caseId, mode, roleIndex, sendTourEvent, tourState])

  useEffect(() => {
    const stepId = tourState?.status === 'active' ? tourState.stepId : null
    const desiredSection = stepId === 'analysis' || stepId === 'strategy'
      ? stepId
      : stepId === 'tactics' || stepId === 'start-duel' ? 'tactics' : null
    if (!desiredSection || desiredSection === activeSectionId) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('section', desiredSection)
    setSearchParams(nextParams, { replace: true })
  }, [activeSectionId, searchParams, setSearchParams, tourState])

  const selectSection = (sectionId: PreparationSectionId) => {
    const section = preparationSections.find((item) => item.id === sectionId) ?? preparationSections[0]
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('section', section.id)
    setSearchParams(nextParams, { replace: true })
    setActiveStep(section.steps[0])
    sendTourEvent({ type: 'section-opened', section: section.id })
    window.requestAnimationFrame(() => document.querySelector('.preparation-layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const scrollToStep = (id: PreparationStepId) => {
    setActiveStep(id)
    document.getElementById(`preparation-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const sectionIndex = preparationSections.findIndex((section) => section.id === activeSectionId)
  const closeCaseDrawer = useCallback(() => setCaseDrawerOpen(false), [])
  const tourStepId = tourState?.status === 'active' ? tourState.stepId : null
  const startNegotiation = () => {
    if (tourStepId === 'tactics') sendTourEvent({ type: 'next' })
    void starter.start()
  }
  const handleBottomNext = () => {
    if (tourStepId === 'tactics') {
      sendTourEvent({ type: 'next' })
      return
    }
    if (sectionIndex < preparationSections.length - 1) {
      selectSection(preparationSections[sectionIndex + 1].id)
      return
    }
    startNegotiation()
  }

  if (roleIndex === null || mode === null) return <main className="arena-state"><span className="arena-state__mark">!</span><h1>Не выбран формат подготовки</h1><p>Вернитесь к кейсам и выберите свою роль и формат тренировки.</p><AppButton to="/home">К кейсам</AppButton></main>
  if (mode === 'text' && !supportsTextNegotiation) return <main className="arena-state"><span className="arena-state__mark">!</span><h1>Текстовые переговоры недоступны</h1><p>В основном режиме тренировки проходят только голосом. Выберите голосовой формат в каталоге кейсов.</p><AppButton to="/home">К кейсам</AppButton></main>
  if (loadedCase.loading) return <main className="arena-state" aria-live="polite"><span className="arena-state__spinner" /><h1>Загружаем подготовку…</h1></main>
  if (loadedCase.error || !loadedCase.trainingCase) return <main className="arena-state"><span className="arena-state__mark">!</span><h1>Не удалось открыть кейс</h1><p>{loadedCase.error ?? 'Кейс не найден.'}</p><div><AppButton type="button" onClick={() => void loadedCase.load()}>Повторить</AppButton><AppButton to="/home" variant="secondary">К кейсам</AppButton></div></main>

  return <div className={`preparation-page ${tourStepId === 'start-duel' ? 'is-tour-start-duel' : ''}`}>
    <PreparationHeader />
    <main className="preparation-shell preparation-main">
      <PreparationContext caseButtonRef={caseButtonRef} item={loadedCase.trainingCase} roleIndex={roleIndex} saveState={preparation.saveState} onCaseOpen={() => setCaseDrawerOpen(true)} />
      <PreparationOverview completedCount={preparation.completed.length} isStarting={starter.isStarting} onStart={startNegotiation} />
      {starter.error && <div className="form-alert preparation-error" role="alert">{starter.error}</div>}
      <div className="preparation-mobile-nav"><PreparationNavigation mobile activeSectionId={activeSectionId} activeStep={activeStep} completed={preparation.completed} onSectionSelect={selectSection} onStepSelect={scrollToStep} /></div>
      <div className="preparation-layout" data-tour-id={`preparation-${activeSectionId}`}>
        <aside className="preparation-sidebar"><PreparationNavigation activeSectionId={activeSectionId} activeStep={activeStep} completed={preparation.completed} onSectionSelect={selectSection} onStepSelect={scrollToStep} /></aside>
        <div className="preparation-content">
          <PreparationForm activeSectionId={activeSectionId} draft={preparation.draft} updateDraft={preparation.updateDraft} />
          <div className="preparation-bottom">
            {sectionIndex > 0 && <button className="preparation-bottom__back" type="button" onClick={() => selectSection(preparationSections[sectionIndex - 1].id)}><span>←</span> Назад</button>}
            <button className="preparation-bottom__next" type="button" disabled={starter.isStarting} onClick={handleBottomNext} data-tour-id={sectionIndex === preparationSections.length - 1 && tourStepId !== 'tactics' ? 'start-duel' : 'preparation-next'}>{sectionIndex === preparationSections.length - 1 ? tourStepId === 'tactics' ? 'Далее' : starter.isStarting ? 'Создаём поединок…' : 'Начать поединок' : 'Далее'} <span>→</span></button>
          </div>
        </div>
      </div>
    </main>
    {caseDrawerOpen && <CaseConditionDrawer item={loadedCase.trainingCase} roleIndex={roleIndex} triggerRef={caseButtonRef} onClose={closeCaseDrawer} />}
  </div>
}
