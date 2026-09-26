import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { TotpModal } from '@/components/auth/TotpModal'
import { CaseCard } from '@/components/home/CaseCard'
import { TrainingModal } from '@/components/home/TrainingModal'
import { ArenaCubeMark } from '@/components/ui/ArenaCubeMark'
import heroArtwork from '@/assets/home/hero-negotiation.webp'
import profileArtwork from '@/assets/home/profile-kirill.webp'
import { caseArtwork } from '@/mocks/caseArtwork'
import { useDomainServices } from '@/services/domainServices'
import type { TrainingCase } from '@/types/case'
import type { NegotiationSessionSummary } from '@/types/negotiation'
import '@/styles/home.css'

function trainingTitle(item: NegotiationSessionSummary, cases: TrainingCase[]) {
  return cases.find((trainingCase) => trainingCase.id === item.caseId || trainingCase.title === item.name)?.title
    ?? item.name ?? 'Переговоры с AI'
}

function trainingStatus(item: NegotiationSessionSummary) {
  if (item.status === 'active') return 'В процессе'
  if (item.score !== undefined) return `Результат ${item.score}/100`
  if (item.backendStatus === 'victory') return 'Договорённость достигнута'
  if (item.backendStatus === 'defeat') return 'Решение отложено'
  return 'Завершено'
}

function trainingCountLabel(count: number) {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'тренировок'
  if (lastDigit === 1) return 'тренировка'
  if (lastDigit >= 2 && lastDigit <= 4) return 'тренировки'
  return 'тренировок'
}

export function HomePage() {
  const { dismissMemorySessionNotice, externalSessionVersion, logout, showMemorySessionNotice } = useAuth()
  const { negotiationClient } = useDomainServices()
  const [selectedCase, setSelectedCase] = useState<TrainingCase | null>(null)
  const [securityModalVersion, setSecurityModalVersion] = useState<number | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [history, setHistory] = useState<NegotiationSessionSummary[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [cases, setCases] = useState<TrainingCase[]>([])
  const [casesLoading, setCasesLoading] = useState(true)
  const [casesError, setCasesError] = useState<string | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const recommendedCase = cases[0]
  const activeSession = history.find((item) => item.status === 'active')
  const activeCase = activeSession && cases.find((item) => item.id === activeSession.caseId)
  const displayedCase = activeCase ?? recommendedCase
  const visibleHistory = showAllHistory ? history : history.slice(0, 3)

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    await logout().catch(() => setIsLoggingOut(false))
  }

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await negotiationClient.listSessions())
      setHistoryError(null)
    } catch (caught) {
      setHistoryError(caught instanceof Error ? caught.message : 'Не удалось загрузить историю.')
    } finally {
      setHistoryLoading(false)
    }
  }, [negotiationClient])

  const loadCases = useCallback(async () => {
    setCasesLoading(true)
    try {
      setCases(await negotiationClient.listCases())
      setCasesError(null)
    } catch (caught) {
      setCasesError(caught instanceof Error ? caught.message : 'Не удалось загрузить кейсы.')
    } finally {
      setCasesLoading(false)
    }
  }, [negotiationClient])

  useEffect(() => {
    let active = true
    void negotiationClient.listSessions().then((sessions) => {
      if (active) setHistory(sessions)
    }).catch((caught: unknown) => {
      if (active) setHistoryError(caught instanceof Error ? caught.message : 'Не удалось загрузить историю.')
    }).finally(() => {
      if (active) setHistoryLoading(false)
    })
    return () => { active = false }
  }, [negotiationClient])

  useEffect(() => {
    let active = true
    void negotiationClient.listCases().then((items) => {
      if (active) setCases(items)
    }).catch((caught: unknown) => {
      if (active) setCasesError(caught instanceof Error ? caught.message : 'Не удалось загрузить кейсы.')
    }).finally(() => {
      if (active) setCasesLoading(false)
    })
    return () => { active = false }
  }, [negotiationClient])

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

  return (
    <div className="arena-home">
      <header className="arena-home__header">
        <div className="arena-home__shell arena-home__header-inner">
          <Link className="arena-home__brand" to="/" aria-label="Арена — на главную"><ArenaCubeMark /><span>АРЕНА</span></Link>
          <div className="arena-home__header-actions">
            <span className="arena-home__streak" aria-label="Демо: серия 4 дня"><span aria-hidden="true">🔥</span><span>Серия: <strong>4 дня</strong></span></span>
            <div className="arena-home__profile" ref={profileRef}>
              <button className="arena-home__profile-toggle" type="button" aria-label="Меню профиля" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}>
                <img src={profileArtwork} alt="" />
              </button>
              {profileOpen && <div className="arena-home__profile-menu">
                <span className="arena-home__profile-name">Кирилл <small>Демо-профиль</small></span>
                <button type="button" onClick={() => { setProfileOpen(false); setSecurityModalVersion(externalSessionVersion) }}>Настроить 2FA</button>
                <button type="button" disabled={isLoggingOut} onClick={() => void handleLogout()}>{isLoggingOut ? 'Выходим…' : 'Выйти'}</button>
              </div>}
            </div>
          </div>
        </div>
      </header>

      <main className="arena-home__shell arena-home__main">
        {showMemorySessionNotice && <div className="memory-session-notice" role="status"><span aria-hidden="true">!</span><p><strong>Сессия действует только в этой вкладке.</strong> После перезагрузки потребуется войти снова.</p><button type="button" onClick={dismissMemorySessionNotice} aria-label="Закрыть уведомление">×</button></div>}

        <section className="arena-home__welcome">
          <h1>Добро пожаловать, Кирилл</h1>
          <p>Продолжай тренировки и развивай переговорные навыки</p>
        </section>

        <div className="arena-home__overview">
          <section className="arena-home__continue" aria-labelledby={historyLoading ? undefined : 'continue-title'} aria-label={historyLoading ? 'Тренировка' : undefined}>
            {historyLoading ? <div className="arena-home__continue-skeleton" role="status" aria-label="Загружаем тренировку">
              <span className="arena-home__skeleton-title" />
              <div><span className="arena-home__skeleton-image" /><span className="arena-home__skeleton-copy" /></div>
            </div> : <>
              <div className="arena-home__continue-head"><h2 id="continue-title">{activeSession ? 'Продолжить тренировку' : 'Начать тренировку'}</h2><span>▣ &nbsp;{activeSession ? 'В процессе' : 'Рекомендуем'}</span></div>
              <div className="arena-home__continue-body">
                <img src={activeSession && displayedCase ? caseArtwork[displayedCase.id] ?? heroArtwork : heroArtwork} alt="" />
                <div className="arena-home__continue-info">
                  <h3>{displayedCase?.title ?? (casesLoading ? 'Загружаем кейс…' : 'Выберите кейс')}</h3>
                  <p>{displayedCase ? `${displayedCase.category} · ${displayedCase.duration}` : 'Подготовьтесь и проведите переговоры с AI'}</p>
                  <div className="arena-home__preparation"><span>Подготовка: <strong>65%</strong></span><div role="meter" aria-label="Демо: прогресс подготовки" aria-valuenow={65} aria-valuemin={0} aria-valuemax={100}><i /></div></div>
                  {activeSession
                    ? <Link className="arena-home__primary-button" to={`/arena/${activeSession.id}`}>Продолжить <span aria-hidden="true">→</span></Link>
                    : <button className="arena-home__primary-button" type="button" disabled={!recommendedCase} onClick={() => recommendedCase && setSelectedCase(recommendedCase)}>Начать кейс <span aria-hidden="true">→</span></button>}
                </div>
              </div>
            </>}
          </section>

          <section className="arena-home__progress" aria-labelledby="progress-title">
            <h2 id="progress-title">Мой прогресс</h2>
            <div className="arena-home__level"><div><strong>Уровень 4</strong><span>720 / 900 XP</span><div className="arena-home__bar"><i /></div></div><img src={profileArtwork} alt="" /></div>
            <div className="arena-home__progress-stats"><div><span className="arena-home__bars" aria-hidden="true"><i /><i /><i /></span><p><strong>{historyLoading ? '—' : history.length}</strong><span>{historyLoading ? 'загрузка' : trainingCountLabel(history.length)}</span></p></div><div><span aria-hidden="true">🔥</span><p><strong>Серия: 4 дня</strong><span>Отличная динамика!</span></p></div></div>
          </section>
        </div>

        <section className="arena-home__cases" id="cases" aria-labelledby="home-cases-title">
          <div className="arena-home__section-head"><h2 id="home-cases-title">Кейсы</h2></div>
          {casesLoading && <p className="arena-home__history-state" role="status">Загружаем кейсы…</p>}
          {casesError && <div className="arena-home__history-state" role="alert">{casesError} <button type="button" onClick={() => void loadCases()}>Повторить</button></div>}
          {!casesLoading && !casesError && <div className="arena-home__case-grid">{cases.map((item) => <CaseCard key={item.id} item={item} onSelect={setSelectedCase} />)}</div>}
        </section>

        <section className="arena-home__history" aria-labelledby="home-history-title">
          <div className="arena-home__section-head"><h2 id="home-history-title">Последние тренировки</h2>{history.length > 3 && <button type="button" onClick={() => setShowAllHistory((value) => !value)} aria-expanded={showAllHistory}>{showAllHistory ? 'Свернуть' : 'Все поединки'} <span aria-hidden="true">→</span></button>}</div>
          <div className="arena-home__history-list">
            {historyLoading && <p className="arena-home__history-state" role="status">Загружаем историю…</p>}
            {historyError && <div className="arena-home__history-state" role="alert">{historyError} <button type="button" onClick={() => { setHistoryLoading(true); setHistoryError(null); void loadHistory() }}>Повторить</button></div>}
            {!historyLoading && !historyError && history.length === 0 && <p className="arena-home__history-state">Здесь появятся ваши тренировки. Выберите кейс и начните первый раунд.</p>}
            {!historyLoading && !historyError && visibleHistory.map((item) => {
              const title = trainingTitle(item, cases)
              return <div className="arena-home__history-row" key={item.id}>
                <img src={caseArtwork[item.caseId] ?? heroArtwork} alt="" />
                <div className="arena-home__history-title"><strong>{title}</strong><span>{item.mode === 'voice' ? 'Голос' : 'Текст'}</span></div>
                <span className={`arena-home__history-status ${item.status === 'active' ? 'is-active' : item.backendStatus === 'victory' ? 'is-success' : item.backendStatus === 'defeat' ? 'is-failure' : 'is-neutral'}`}>{trainingStatus(item)}</span>
                <time dateTime={item.startedAt}>{new Date(item.startedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</time>
                <Link to={item.status === 'active' ? `/arena/${item.id}` : `/result/${item.id}`} aria-label={`Открыть тренировку «${title}»`}>{item.status === 'active' ? 'Продолжить' : 'Разбор'} <span aria-hidden="true">→</span></Link>
              </div>
            })}
          </div>
        </section>
      </main>
      {selectedCase && <TrainingModal item={selectedCase} onClose={() => setSelectedCase(null)} />}
      {securityModalVersion === externalSessionVersion && <TotpModal onClose={() => setSecurityModalVersion(null)} />}
    </div>
  )
}
