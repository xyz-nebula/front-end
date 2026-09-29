import { useEffect, useState } from 'react'

import { useAuth } from '@/auth/useAuth'
import { useAuthRuntime } from '@/auth/runtime'
import { ProductHeader } from '@/components/chrome/ProductHeader'
import { CaseCatalog, HomeOverview, TrainingHistory } from '@/components/home/HomeDashboardSections'
import { TrainingModal } from '@/components/home/TrainingModal'
import { ProductTourInvitation } from '@/components/product-tour/ProductTourInvitation'
import { useHomeDashboardData } from '@/features/home/useHomeDashboardData'
import { clearRecentPreparation, preparationProgressPercent, readPreparationDraft, readRecentPreparation } from '@/features/preparation/preparation'
import { useProductTour } from '@/features/product-tour/useProductTour'
import { useDomainServices } from '@/services/domainServices'
import type { TrainingCase } from '@/types/case'
import '@/styles/home.css'

export function HomePage() {
  const { dismissMemorySessionNotice, showMemorySessionNotice } = useAuth()
  const { preparationOwnerKey } = useAuthRuntime()
  const { negotiationClient } = useDomainServices()
  const dashboard = useHomeDashboardData(negotiationClient)
  const productTour = useProductTour()
  const { considerInvitation } = productTour
  const [selectedCase, setSelectedCase] = useState<TrainingCase | null>(null)
  const [dismissedTourCaseId, setDismissedTourCaseId] = useState<string | null>(null)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const recommendedCase = dashboard.cases[0]
  const recentPreparation = preparationOwnerKey ? readRecentPreparation(preparationOwnerKey) : null
  const recentCase = recentPreparation
    ? dashboard.cases.find((item) => item.id === recentPreparation.caseId)
    : undefined
  const recentDraft = recentPreparation && recentCase && preparationOwnerKey
    ? readPreparationDraft(preparationOwnerKey, recentPreparation.caseId, recentPreparation.roleIndex)
    : null
  const preparationResume = recentPreparation && recentCase && recentDraft
    ? {
        href: `/cases/${encodeURIComponent(recentPreparation.caseId)}/preparation?${new URLSearchParams({ role: String(recentPreparation.roleIndex), mode: recentPreparation.mode, section: recentPreparation.sectionId })}`,
        progress: preparationProgressPercent(recentDraft),
      }
    : undefined
  const displayedCase = recentCase ?? recommendedCase

  useEffect(() => {
    considerInvitation(!dashboard.casesLoading && !dashboard.casesError && dashboard.cases.length > 0)
  }, [considerInvitation, dashboard.cases.length, dashboard.casesError, dashboard.casesLoading])

  useEffect(() => {
    if (!preparationOwnerKey || dashboard.casesLoading || dashboard.casesError || !recentPreparation || recentCase) return
    clearRecentPreparation(preparationOwnerKey)
  }, [dashboard.casesError, dashboard.casesLoading, preparationOwnerKey, recentCase, recentPreparation])

  const tourState = productTour.state
  const restoredCase = tourState?.status === 'active'
    && (tourState.stepId === 'role' || tourState.stepId === 'voice-format')
    && tourState.caseId !== dismissedTourCaseId
    ? dashboard.cases.find((item) => item.id === tourState.caseId) ?? null
    : null
  const modalCase = selectedCase ?? restoredCase

  const selectCase = (item: TrainingCase) => {
    const caseIndex = dashboard.cases.findIndex((candidate) => candidate.id === item.id)
    productTour.send({ type: 'case-opened', caseId: item.id, caseIndex: Math.max(0, caseIndex) })
    setDismissedTourCaseId(null)
    setSelectedCase(item)
  }

  const closeCase = () => {
    if (modalCase && modalCase.id === tourState?.caseId) setDismissedTourCaseId(modalCase.id)
    setSelectedCase(null)
  }

  return <div className="arena-home">
    <ProductHeader variant="home" actions={<span className="arena-home__streak" aria-label="Демо: серия 4 дня"><span aria-hidden="true">🔥</span><span>Серия: <strong>4 дня</strong></span></span>} />

    <main className="arena-home__shell arena-home__main">
      {showMemorySessionNotice && <div className="memory-session-notice" role="status"><span aria-hidden="true">!</span><p><strong>Сессия действует только в этой вкладке.</strong> После перезагрузки потребуется войти снова.</p><button type="button" onClick={dismissMemorySessionNotice} aria-label="Закрыть уведомление">×</button></div>}
      <section className="arena-home__welcome"><h1>Добро пожаловать</h1><p>Продолжай тренировки и развивай переговорные навыки</p></section>
      <HomeOverview casesLoading={dashboard.casesLoading} displayedCase={displayedCase} historyCount={dashboard.history.length} historyLoading={dashboard.historyLoading} preparationResume={preparationResume} recommendedCase={recommendedCase} onCaseSelect={selectCase} />
      <CaseCatalog cases={dashboard.cases} error={dashboard.casesError} loading={dashboard.casesLoading} onRetry={() => void dashboard.loadCases()} onSelect={selectCase} />
      <TrainingHistory cases={dashboard.cases} error={dashboard.historyError} history={dashboard.history} loading={dashboard.historyLoading} showAll={showAllHistory} onRetry={() => void dashboard.loadHistory()} onToggleAll={() => setShowAllHistory((value) => !value)} />
    </main>
    {modalCase && <TrainingModal item={modalCase} onClose={closeCase} />}
    {productTour.invitationOpen && <ProductTourInvitation
      onStart={productTour.beginFromInvitation}
      onLater={productTour.deferInvitation}
      onNever={productTour.disableInvitation}
    />}
  </div>
}
