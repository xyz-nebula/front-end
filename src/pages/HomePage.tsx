import { useEffect, useRef, useState } from 'react'

import { useAuth } from '@/auth/useAuth'
import { TotpModal } from '@/components/auth/TotpModal'
import { CaseCatalog, HomeHeader, HomeOverview, TrainingHistory } from '@/components/home/HomeDashboardSections'
import { TrainingModal } from '@/components/home/TrainingModal'
import { useHomeDashboardData } from '@/features/home/useHomeDashboardData'
import { useDomainServices } from '@/services/domainServices'
import type { TrainingCase } from '@/types/case'
import '@/styles/home.css'

export function HomePage() {
  const { dismissMemorySessionNotice, externalSessionVersion, logout, showMemorySessionNotice } = useAuth()
  const { negotiationClient } = useDomainServices()
  const dashboard = useHomeDashboardData(negotiationClient)
  const [selectedCase, setSelectedCase] = useState<TrainingCase | null>(null)
  const [securityModalVersion, setSecurityModalVersion] = useState<number | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const recommendedCase = dashboard.cases[0]
  const activeSession = dashboard.history.find((item) => item.status === 'active')
  const activeCase = activeSession && dashboard.cases.find((item) => item.id === activeSession.caseId)
  const displayedCase = activeCase ?? recommendedCase

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    await logout().catch(() => setIsLoggingOut(false))
  }

  useEffect(() => {
    if (!profileOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) setProfileOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileOpen])

  return <div className="arena-home">
    <HomeHeader
      externalSessionVersion={externalSessionVersion}
      isLoggingOut={isLoggingOut}
      profileOpen={profileOpen}
      profileRef={profileRef}
      onLogout={() => void handleLogout()}
      onProfileToggle={() => setProfileOpen((value) => !value)}
      onSecurityOpen={(version) => { setProfileOpen(false); setSecurityModalVersion(version) }}
    />

    <main className="arena-home__shell arena-home__main">
      {showMemorySessionNotice && <div className="memory-session-notice" role="status"><span aria-hidden="true">!</span><p><strong>Сессия действует только в этой вкладке.</strong> После перезагрузки потребуется войти снова.</p><button type="button" onClick={dismissMemorySessionNotice} aria-label="Закрыть уведомление">×</button></div>}
      <section className="arena-home__welcome"><h1>Добро пожаловать, Кирилл</h1><p>Продолжай тренировки и развивай переговорные навыки</p></section>
      <HomeOverview activeSession={activeSession} casesLoading={dashboard.casesLoading} displayedCase={displayedCase} historyCount={dashboard.history.length} historyLoading={dashboard.historyLoading} recommendedCase={recommendedCase} onCaseSelect={setSelectedCase} />
      <CaseCatalog cases={dashboard.cases} error={dashboard.casesError} loading={dashboard.casesLoading} onRetry={() => void dashboard.loadCases()} onSelect={setSelectedCase} />
      <TrainingHistory cases={dashboard.cases} error={dashboard.historyError} history={dashboard.history} loading={dashboard.historyLoading} showAll={showAllHistory} onRetry={() => void dashboard.loadHistory()} onToggleAll={() => setShowAllHistory((value) => !value)} />
    </main>
    {selectedCase && <TrainingModal item={selectedCase} onClose={() => setSelectedCase(null)} />}
    {securityModalVersion === externalSessionVersion && <TotpModal onClose={() => setSecurityModalVersion(null)} />}
  </div>
}
