import { Link } from 'react-router-dom'

import heroArtwork from '@/assets/home/hero-negotiation.webp'
import profileArtwork from '@/assets/home/profile.webp'
import { CaseCard } from '@/components/home/CaseCard'
import type { TrainingCase } from '@/types/case'
import type { NegotiationSessionSummary } from '@/types/negotiation'

function trainingTitle(item: NegotiationSessionSummary, cases: TrainingCase[]) {
  return cases.find((trainingCase) => trainingCase.id === item.caseId || trainingCase.title === item.name)?.title ?? item.name ?? 'Переговоры с AI'
}

function trainingArtwork(item: NegotiationSessionSummary, cases: TrainingCase[]): string {
  return cases.find((trainingCase) => trainingCase.id === item.caseId)?.presentation.artwork ?? heroArtwork
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

interface HomeOverviewProps {
  casesLoading: boolean
  displayedCase?: TrainingCase
  historyCount: number
  historyLoading: boolean
  preparationResume?: { href: string; progress: number }
  recommendedCase?: TrainingCase
  onCaseSelect: (item: TrainingCase) => void
}

export function HomeOverview({ casesLoading, displayedCase, historyCount, historyLoading, preparationResume, recommendedCase, onCaseSelect }: HomeOverviewProps) {
  return <div className="arena-home__overview">
    <section className="arena-home__continue" aria-labelledby={casesLoading ? undefined : 'continue-title'} aria-label={casesLoading ? 'Тренировка' : undefined}>
      {casesLoading ? <div className="arena-home__continue-skeleton" role="status" aria-label="Загружаем тренировку"><span className="arena-home__skeleton-title" /><div><span className="arena-home__skeleton-image" /><span className="arena-home__skeleton-copy" /></div></div> : <>
        <div className="arena-home__continue-head"><h2 id="continue-title">{preparationResume ? 'Продолжить подготовку' : 'Начать тренировку'}</h2><span>▣ &nbsp;{preparationResume ? 'Черновик' : 'Рекомендуем'}</span></div>
        <div className="arena-home__continue-body">
          <img src={preparationResume && displayedCase ? displayedCase.presentation.artwork ?? heroArtwork : heroArtwork} alt="" decoding="async" />
          <div className="arena-home__continue-info">
            <h3>{displayedCase?.title ?? (casesLoading ? 'Загружаем кейс…' : 'Выберите кейс')}</h3>
            <p>{displayedCase ? `${displayedCase.category} · ${displayedCase.duration}` : 'Подготовьтесь и проведите переговоры с AI'}</p>
            {preparationResume && <div className="arena-home__preparation"><span>Подготовка: <strong>{preparationResume.progress}%</strong></span><div role="meter" aria-label="Прогресс подготовки" aria-valuenow={preparationResume.progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${preparationResume.progress}%` }} /></div></div>}
            {preparationResume ? <Link className="arena-home__primary-button" to={preparationResume.href}>Продолжить <span aria-hidden="true">→</span></Link> : <button className="arena-home__primary-button" type="button" disabled={!recommendedCase} onClick={() => recommendedCase && onCaseSelect(recommendedCase)}>Начать кейс <span aria-hidden="true">→</span></button>}
          </div>
        </div>
      </>}
    </section>
    <section className="arena-home__progress" aria-labelledby="progress-title">
      <h2 id="progress-title">Мой прогресс</h2>
      <div className="arena-home__level"><div><strong>Уровень 4</strong><span>720 / 900 XP</span><div className="arena-home__bar"><i /></div></div><img src={profileArtwork} alt="" width={400} height={400} loading="lazy" decoding="async" /></div>
      <div className="arena-home__progress-stats"><div><span className="arena-home__bars" aria-hidden="true"><i /><i /><i /></span><p><strong>{historyLoading ? '—' : historyCount}</strong><span>{historyLoading ? 'загрузка' : trainingCountLabel(historyCount)}</span></p></div><div><span aria-hidden="true">🔥</span><p><strong>Серия: 4 дня</strong><span>Отличная динамика!</span></p></div></div>
    </section>
  </div>
}

interface CaseCatalogProps { cases: TrainingCase[]; error: string | null; loading: boolean; onRetry: () => void; onSelect: (item: TrainingCase) => void }

export function CaseCatalog({ cases, error, loading, onRetry, onSelect }: CaseCatalogProps) {
  return <section className="arena-home__cases" id="cases" aria-labelledby="home-cases-title">
    <div className="arena-home__section-head"><h2 id="home-cases-title">Кейсы</h2></div>
    {loading && <p className="arena-home__history-state" role="status">Загружаем кейсы…</p>}
    {error && <div className="arena-home__history-state" role="alert">{error} <button type="button" onClick={onRetry}>Повторить</button></div>}
    {!loading && !error && <div className="arena-home__case-grid">{cases.map((item) => <CaseCard key={item.id} item={item} onSelect={onSelect} />)}</div>}
  </section>
}

interface TrainingHistoryProps { cases: TrainingCase[]; error: string | null; history: NegotiationSessionSummary[]; loading: boolean; showAll: boolean; onRetry: () => void; onToggleAll: () => void }

export function TrainingHistory({ cases, error, history, loading, showAll, onRetry, onToggleAll }: TrainingHistoryProps) {
  const visibleHistory = showAll ? history : history.slice(0, 3)
  return <section className="arena-home__history" aria-labelledby="home-history-title">
    <div className="arena-home__section-head"><h2 id="home-history-title">Последние тренировки</h2>{history.length > 3 && <button type="button" onClick={onToggleAll} aria-expanded={showAll}>{showAll ? 'Свернуть' : 'Все поединки'} <span aria-hidden="true">→</span></button>}</div>
    <div className="arena-home__history-list">
      {loading && <p className="arena-home__history-state" role="status">Загружаем историю…</p>}
      {error && <div className="arena-home__history-state" role="alert">{error} <button type="button" onClick={onRetry}>Повторить</button></div>}
      {!loading && !error && history.length === 0 && <p className="arena-home__history-state">Здесь появятся ваши тренировки. Выберите кейс и начните первый раунд.</p>}
      {!loading && !error && visibleHistory.map((item) => {
        const title = trainingTitle(item, cases)
        return <div className="arena-home__history-row" key={item.id}>
          <img src={trainingArtwork(item, cases)} alt="" loading="lazy" decoding="async" />
          <div className="arena-home__history-title"><strong>{title}</strong><span>{item.mode === 'voice' ? 'Голос' : 'Текст'}</span></div>
          <span className={`arena-home__history-status ${item.status === 'active' ? 'is-active' : item.backendStatus === 'victory' ? 'is-success' : item.backendStatus === 'defeat' ? 'is-failure' : 'is-neutral'}`}>{trainingStatus(item)}</span>
          <time dateTime={item.startedAt}>{new Date(item.startedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</time>
          <Link to={item.status === 'active' ? `/arena/${item.id}` : `/result/${item.id}`} aria-label={`Открыть тренировку «${title}»`}>{item.status === 'active' ? 'Продолжить' : 'Разбор'} <span aria-hidden="true">→</span></Link>
        </div>
      })}
    </div>
  </section>
}
