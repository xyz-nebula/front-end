import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { TotpModal } from '@/components/auth/TotpModal'
import { CaseCard } from '@/components/home/CaseCard'
import { CaseIcon } from '@/components/home/CaseIcon'
import { TrainingModal } from '@/components/home/TrainingModal'
import { AppButton } from '@/components/ui/AppButton'
import { ArrowIcon } from '@/components/ui/ArrowIcon'
import { Logo } from '@/components/ui/Logo'
import { caseCategories, trainingCases } from '@/mocks/cases'
import { useDomainServices } from '@/services/domainServices'
import type { CaseCategory, TrainingCase } from '@/types/case'
import type { NegotiationSessionSummary } from '@/types/negotiation'

export function HomePage() {
  const { dismissMemorySessionNotice, externalSessionVersion, logout, showMemorySessionNotice } = useAuth()
  const { isRealVoice, negotiationClient } = useDomainServices()
  const [category, setCategory] = useState<CaseCategory>('Все')
  const [selectedCase, setSelectedCase] = useState<TrainingCase | null>(null)
  const [securityModalVersion, setSecurityModalVersion] = useState<number | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [history, setHistory] = useState<NegotiationSessionSummary[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const recommendedCase = trainingCases[0]
  const historyCountLabel = history.length === 1 ? 'сессия' : history.length >= 2 && history.length <= 4 ? 'сессии' : 'сессий'
  const visibleCases = useMemo(
    () => category === 'Все' ? trainingCases : trainingCases.filter((item) => item.category === category),
    [category],
  )

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    await logout().catch(() => undefined)
  }

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await negotiationClient.listSessions())
    } catch (caught) {
      setHistoryError(caught instanceof Error ? caught.message : 'Не удалось загрузить историю.')
    } finally {
      setHistoryLoading(false)
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

  return (
    <div className="app-home">
      <header className="app-header">
        <div className="app-shell app-header__inner">
          <Logo />
          <nav aria-label="Навигация приложения"><a className="is-active" href="#cases">Тренировки</a><a href="#progress">Мой прогресс</a></nav>
          <div className="app-header__actions">
            <button type="button" onClick={() => setSecurityModalVersion(externalSessionVersion)}><span className="app-header__shield" aria-hidden="true">✦</span><span>2FA</span></button>
            <button type="button" onClick={() => void handleLogout()} disabled={isLoggingOut}>{isLoggingOut ? 'Выходим…' : 'Выйти'}</button>
          </div>
        </div>
      </header>

      <main className="app-shell home-main">
        {showMemorySessionNotice && (
          <div className="memory-session-notice" role="status">
            <span aria-hidden="true">!</span>
            <p><strong>Сессия действует только в этой вкладке.</strong> После перезагрузки потребуется войти снова.</p>
            <button type="button" onClick={dismissMemorySessionNotice} aria-label="Закрыть уведомление">×</button>
          </div>
        )}
        <section className="welcome-section">
          <div><p>Добро пожаловать на Арену <span>✦</span></p><h1>Какой разговор<br />потренируем сегодня?</h1></div>
          <AppButton type="button" icon={<ArrowIcon />} onClick={() => setSelectedCase(recommendedCase)}>Начать тренировку</AppButton>
        </section>

        <section className="home-overview">
          <article className="recommended-card">
            <div className="recommended-card__copy">
              <span className="recommended-card__label"><i /> Рекомендуем сегодня</span>
              <p>{recommendedCase.category} · {recommendedCase.duration}</p>
              <h2>{recommendedCase.title}</h2>
              <p className="recommended-card__description">Встреча с руководителем уже близко. Потренируй аргументы и подготовься к неудобным вопросам.</p>
              <AppButton type="button" variant="light" icon={<ArrowIcon />} onClick={() => setSelectedCase(recommendedCase)}>Начать кейс</AppButton>
            </div>
            <div className="recommended-card__visual">
              <div className="recommended-card__target"><span>Ваша цель</span><strong>Договориться о пересмотре условий</strong></div>
              <div className="recommended-card__person"><div className="avatar avatar--large">А</div><div><span>Ваш оппонент</span><strong>{recommendedCase.opponent}</strong></div></div>
              <div className="recommended-card__orb"><CaseIcon name={recommendedCase.icon} /></div>
            </div>
          </article>

          <article className="progress-card" id="progress">
            <div className="progress-card__head"><div><span>Ваш прогресс · демо</span><strong>Сентябрь</strong></div><span className="trend">↗ +8%</span></div>
            <div className="progress-ring" style={{ '--progress': '72%' } as CSSProperties}><div><strong>7</strong><span>тренировок</span></div></div>
            <div className="progress-card__stats"><div><span>Средняя оценка</span><strong>74</strong></div><div><span>В практике</span><strong>1ч 24м</strong></div></div>
            <div className="progress-card__focus"><span>Фокус недели</span><strong>Больше открытых вопросов</strong><div><i /></div></div>
          </article>
        </section>

        <section className="catalog-section" id="cases">
          <div className="catalog-section__head"><div><p className="eyebrow">Библиотека практики</p><h2>Выбери ситуацию</h2></div><p>Каждый кейс можно проходить снова — оппонент будет реагировать по-новому.</p></div>
          <div className="category-tabs" role="tablist" aria-label="Категории кейсов">
            {caseCategories.map((item) => <button key={item} type="button" role="tab" aria-selected={category === item} className={category === item ? 'is-active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          <div className="case-grid">{visibleCases.map((item) => <CaseCard key={item.id} item={item} onSelect={setSelectedCase} />)}</div>
        </section>

        <section className="recent-section">
          <div className="recent-section__head"><div><p className="eyebrow">{isRealVoice ? 'История переговоров' : 'История · демо'}</p><h2>Последние тренировки</h2></div><span>{history.length} {historyCountLabel}</span></div>
          <div className="recent-table">
            {historyLoading && <p className="recent-empty" role="status">Загружаем историю…</p>}
            {historyError && <div className="recent-empty" role="alert">{historyError} <button type="button" onClick={() => { setHistoryLoading(true); setHistoryError(null); void loadHistory() }}>Повторить</button></div>}
            {!historyLoading && !historyError && history.length === 0 && <p className="recent-empty">Здесь появятся ваши тренировки. Выберите кейс и начните первый раунд.</p>}
            {!historyLoading && !historyError && history.map((item) => {
              const title = trainingCases.find(
                (trainingCase) => trainingCase.id === item.caseId || trainingCase.title === item.name,
              )?.title ?? item.name ?? 'Переговоры с AI'
              const status = item.score !== undefined
                ? `Результат ${item.score}/100`
                : item.backendStatus === 'victory'
                  ? 'Победа'
                  : item.backendStatus === 'defeat'
                    ? 'Поражение'
                    : item.status === 'active' ? 'В процессе' : 'Завершено'
              return <div className="recent-row" key={item.id}>
                <div className="recent-row__icon">{item.mode === 'voice' ? '◉' : '↗'}</div><div className="recent-row__name"><strong>{title}</strong><span>{new Date(item.startedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} · {item.mode === 'voice' ? 'голос' : 'текст'}</span><span className="recent-row__mobile-score">{status}</span></div><div className="recent-row__score"><span>{item.score === undefined ? 'Статус' : 'Результат'}</span><strong>{item.score === undefined ? status : <>{item.score}<small>/100</small></>}</strong></div><div className={`recent-row__change ${item.score === undefined ? 'is-neutral' : ''}`}>{item.score === undefined ? status : 'Готово'}</div>
                <Link className="recent-row__link" to={item.status === 'active' ? `/arena/${item.id}` : `/result/${item.id}`} aria-label={`Открыть тренировку «${title}»`}><ArrowIcon /></Link>
              </div>
            })}
          </div>
        </section>
      </main>

      <footer className="app-home__footer"><div className="app-shell"><Logo /><span>Тренируйся сегодня — говори увереннее завтра.</span><span>Прототип · 2026</span></div></footer>
      {selectedCase && <TrainingModal item={selectedCase} onClose={() => setSelectedCase(null)} />}
      {securityModalVersion === externalSessionVersion && <TotpModal onClose={() => setSecurityModalVersion(null)} />}
    </div>
  )
}
