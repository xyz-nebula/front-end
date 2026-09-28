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
  const { negotiationClient } = useDomainServices()
  const loadedCase = usePreparationCase(negotiationClient, caseId)
  const preparation = usePreparationDraft(mockOwnerKey, caseId, roleIndex)
  const [activeStep, setActiveStep] = useState<PreparationStepId>(activeSection.steps[0])
  const [caseDrawerOpen, setCaseDrawerOpen] = useState(false)
  const caseButtonRef = useRef<HTMLButtonElement>(null)
  const openArena = useCallback((sessionId: string) => navigate(`/arena/${sessionId}`), [navigate])
  const starter = useStartNegotiation(negotiationClient, {
    draft: preparation.draft,
    mode,
    ownerKey: mockOwnerKey,
    roleIndex,
    trainingCase: loadedCase.trainingCase,
  }, openArena)

  useEffect(() => {
    if (searchParams.get('section') === activeSectionId) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('section', activeSectionId)
    setSearchParams(nextParams, { replace: true })
  }, [activeSectionId, searchParams, setSearchParams])

  const selectSection = (sectionId: PreparationSectionId) => {
    const section = preparationSections.find((item) => item.id === sectionId) ?? preparationSections[0]
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

  const sectionIndex = preparationSections.findIndex((section) => section.id === activeSectionId)
  const closeCaseDrawer = useCallback(() => setCaseDrawerOpen(false), [])

  if (roleIndex === null || mode === null) return <main className="arena-state"><span className="arena-state__mark">!</span><h1>Не выбран формат подготовки</h1><p>Вернитесь к кейсам и выберите свою роль и формат тренировки.</p><AppButton to="/home">К кейсам</AppButton></main>
  if (loadedCase.loading) return <main className="arena-state" aria-live="polite"><span className="arena-state__spinner" /><h1>Загружаем подготовку…</h1></main>
  if (loadedCase.error || !loadedCase.trainingCase) return <main className="arena-state"><span className="arena-state__mark">!</span><h1>Не удалось открыть кейс</h1><p>{loadedCase.error ?? 'Кейс не найден.'}</p><div><AppButton type="button" onClick={() => void loadedCase.load()}>Повторить</AppButton><AppButton to="/home" variant="secondary">К кейсам</AppButton></div></main>

  return <div className="preparation-page">
    <PreparationHeader />
    <main className="preparation-shell preparation-main">
      <PreparationContext caseButtonRef={caseButtonRef} item={loadedCase.trainingCase} roleIndex={roleIndex} saveState={preparation.saveState} onCaseOpen={() => setCaseDrawerOpen(true)} />
      <PreparationOverview completedCount={preparation.completed.length} isStarting={starter.isStarting} onStart={() => void starter.start()} />
      {starter.error && <div className="form-alert preparation-error" role="alert">{starter.error}</div>}
      <div className="preparation-mobile-nav"><PreparationNavigation mobile activeSectionId={activeSectionId} activeStep={activeStep} completed={preparation.completed} onSectionSelect={selectSection} onStepSelect={scrollToStep} /></div>
      <div className="preparation-layout">
        <aside className="preparation-sidebar"><PreparationNavigation activeSectionId={activeSectionId} activeStep={activeStep} completed={preparation.completed} onSectionSelect={selectSection} onStepSelect={scrollToStep} /></aside>
        <div className="preparation-content">
          <PreparationForm activeSectionId={activeSectionId} draft={preparation.draft} updateDraft={preparation.updateDraft} />
          <div className="preparation-bottom">
            {sectionIndex > 0 && <button className="preparation-bottom__back" type="button" onClick={() => selectSection(preparationSections[sectionIndex - 1].id)}><span>←</span> Назад</button>}
            <button className="preparation-bottom__next" type="button" disabled={starter.isStarting} onClick={sectionIndex === preparationSections.length - 1 ? () => void starter.start() : () => selectSection(preparationSections[sectionIndex + 1].id)}>{sectionIndex === preparationSections.length - 1 ? starter.isStarting ? 'Создаём поединок…' : 'Начать поединок' : 'Далее'} <span>→</span></button>
          </div>
        </div>
      </div>
    </main>
    {caseDrawerOpen && <CaseConditionDrawer item={loadedCase.trainingCase} roleIndex={roleIndex} triggerRef={caseButtonRef} onClose={closeCaseDrawer} />}
  </div>
}
