import { Link } from 'react-router-dom'

import coachArtwork from '@/assets/judge/coach.webp'
import hiringJudgeArtwork from '@/assets/judge/hiring.webp'
import sendingToNegotiationsJudgeArtwork from '@/assets/judge/sending-to-negotiations.webp'
import trusteeOfPropertyJudgeArtwork from '@/assets/judge/trustee-of-property.webp'
import { AppButton } from '@/components/ui/AppButton'
import { createMockResultAnalysis } from '@/mocks/resultAnalysis'
import type { DuelPreparation } from '@/mocks/duelPreparation'
import type {
  NegotiationCoachEpisode,
  NegotiationMessage,
  NegotiationPlanStatus,
  NegotiationResult,
  NegotiationSession,
} from '@/types/negotiation'

interface ResultAnalysisProps {
  result: NegotiationResult
  session: NegotiationSession
  preparation: DuelPreparation | null
  isDemo: boolean
  isRestarting: boolean
  error: string | null
  onRepeat: () => void
}

const statusLabels: Record<NegotiationPlanStatus, string> = {
  followed: 'Следовал',
  adapted: 'Адаптировал',
  unused: 'Не использовал',
}

const judgeArtwork = [
  hiringJudgeArtwork,
  sendingToNegotiationsJudgeArtwork,
  trusteeOfPropertyJudgeArtwork,
] as const

function formatDuration(session: NegotiationSession): string | null {
  if (!session.finishedAt) return null
  const durationMs = Date.parse(session.finishedAt) - Date.parse(session.startedAt)
  if (!Number.isFinite(durationMs) || durationMs < 0) return null
  const totalSeconds = Math.floor(durationMs / 1_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function Icon({ children, tone = 'blue' }: { children: string; tone?: 'blue' | 'green' | 'red' }) {
  return <span className={`result-icon result-icon--${tone}`} aria-hidden="true">{children}</span>
}

function CoachColumn({ title, tone, items }: { title: string; tone: 'green' | 'red'; items: NegotiationCoachEpisode[] }) {
  return (
    <section className={`result-coach__column is-${tone}`}>
      <h3><Icon tone={tone}>{tone === 'green' ? '✓' : '×'}</Icon>{title}</h3>
      <div className="result-coach__episodes">
        {items.map((item, index) => (
          <article key={`${item.quote}-${index}`}>
            <strong>«{item.quote}»</strong>
            <dl>
              <div><dt>Действие:</dt><dd>{item.action}</dd></div>
              <div><dt>Изменение:</dt><dd>{item.change}</dd></div>
              <div><dt>Последствие:</dt><dd>{item.consequence}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  )
}

function Transcript({ messages }: { messages: NegotiationMessage[] }) {
  return (
    <details className="result-transcript">
      <summary><span><Icon>▤</Icon>Полный транскрипт</span><span aria-hidden="true">⌄</span></summary>
      <div className="result-transcript__body">
        {messages.length === 0
          ? <p className="result-transcript__empty">В этой тренировке не сохранилось реплик.</p>
          : messages.map((message) => (
            <article className={`result-transcript__message is-${message.speaker}`} key={message.id}>
              <span>{message.speaker === 'user' ? 'Вы' : 'AI-оппонент'}</span>
              <p>{message.text}</p>
            </article>
          ))}
      </div>
    </details>
  )
}

export function ResultAnalysis({ result, session, preparation, isDemo, isRestarting, error, onRepeat }: ResultAnalysisProps) {
  const analysis = result.analysis ?? createMockResultAnalysis(session, result.outcome)
  const duration = formatDuration(session)
  const userRole = preparation?.userRole ?? 'Участник'
  const opponentRole = preparation?.opponentRole ?? 'AI-оппонент'
  const success = result.outcome === 'victory'

  return (
    <>
      <nav className="result-breadcrumbs" aria-label="Хлебные крошки">
        <Link to="/home">Кейсы</Link><span>/</span><span>Результат</span>
      </nav>
      <section className="result-intro">
        <h1>Разбор поединка</h1>
        <p>{userRole} → {opponentRole}{duration && <> <span>·</span> {duration}</>} <span>·</span> {session.mode === 'voice' ? 'Голос' : 'Текст'}</p>
      </section>
      {isDemo && <p className="result-demo-note" role="note">Это демонстрационный разбор интерфейса. Оценка и рекомендации не получены от backend или AI-сервиса.</p>}

      <section className={`result-outcome ${success ? 'is-success' : 'is-failure'}`} aria-labelledby="result-outcome-title">
        <div className="result-outcome__summary">
          <small>Итог переговоров</small>
          <div>
            <h2 id="result-outcome-title">{analysis.agreement.title}</h2>
            <span><Icon tone={success ? 'green' : 'red'}>{success ? '✓' : '!'}</Icon>{success ? 'Успешный результат' : 'Нужна ещё попытка'}</span>
          </div>
          <p>{result.summary}</p>
        </div>
        <div className="result-outcome__facts">
          <article>
            <Icon>▤</Icon>
            <div><h3>Договорённости</h3><ul>{analysis.agreement.points.map((point) => <li key={point}>{point}</li>)}</ul></div>
          </article>
          <article>
            <Icon>⚖</Icon>
            <div><h3>Цена результата</h3><p>{analysis.agreement.tradeoff}</p></div>
          </article>
          <article>
            <Icon>◷</Icon>
            <div><h3>Что будет дальше</h3><p>{analysis.agreement.nextStep}</p></div>
          </article>
        </div>
      </section>

      <section className="result-section result-judges" aria-labelledby="result-judges-title">
        <h2 id="result-judges-title">Что решили судьи</h2>
        <div className="result-judges__grid">
          {analysis.judges.slice(0, 3).map((judge, index) => (
            <article className={`result-judge is-${judge.verdict}`} key={`${judge.name}-${index}`}>
              <header>
                <span className="result-judge__avatar result-judge__avatar--photo" aria-hidden="true">
                  <img src={judgeArtwork[index]} alt="" width={192} height={192} loading="lazy" decoding="async" />
                </span>
                <div><h3>{judge.name}</h3><p>{judge.question}</p></div>
              </header>
              <span className="result-judge__verdict"><Icon tone={judge.verdict === 'user' ? 'blue' : 'red'}>{judge.verdict === 'user' ? '✓' : '!'}</Icon>{judge.verdict === 'user' ? 'Выбираю вас' : 'Выбираю AI-оппонента'}</span>
              <p className="result-judge__criterion"><strong>Критерий:</strong> {judge.criterion}</p>
              <blockquote>«{judge.quote}»</blockquote>
              <dl>
                <div><dt>Наблюдение:</dt><dd>{judge.observation}</dd></div>
                <div><dt>Эффект:</dt><dd>{judge.effect}</dd></div>
                <div><dt>Сравнение:</dt><dd>{judge.comparison}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="result-section result-coach" aria-labelledby="result-coach-title">
        <h2 id="result-coach-title">Разбор тренера</h2>
        <p className="result-coach__summary">
          <span className="result-judge__avatar result-judge__avatar--photo" aria-hidden="true">
            <img src={coachArtwork} alt="" width={192} height={192} loading="lazy" decoding="async" />
          </span>
          {analysis.coachSummary}
        </p>
        <div className="result-coach__grid">
          <CoachColumn title="Что сработало" tone="green" items={analysis.worked} />
          <CoachColumn title="Что помешало" tone="red" items={analysis.hindered} />
        </div>
      </section>

      <section className="result-section result-plan" aria-labelledby="result-plan-title">
        <h2 id="result-plan-title">План vs реальность</h2>
        <div className="result-plan__table">
          {analysis.planComparison.map((item, index) => (
            <article key={`${item.plan}-${index}`}>
              <div><Icon>{index === 0 ? '◎' : index === 1 ? '▤' : '◆'}</Icon><p><strong>Планировали:</strong> {item.plan}</p></div>
              <span className={`is-${item.status}`}>{statusLabels[item.status]}</span>
              <p>{item.reality}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="result-section result-next" aria-labelledby="result-next-title">
        <h2 id="result-next-title">Что попробовать в следующей попытке</h2>
        <ol>{result.recommendations.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol>
      </section>

      <div className="result-actions">
        <AppButton type="button" onClick={onRepeat} disabled={isRestarting}>{isRestarting ? 'Создаём раунд…' : 'Повторить кейс'}</AppButton>
        <AppButton to="/home" variant="secondary">К кейсам</AppButton>
      </div>
      <p className="result-actions__note">Повтор сохранит вашу роль и скрытую позицию AI, чтобы честно проверить новую стратегию.</p>
      {error && <p className="result-error" role="alert">{error}</p>}
      <Transcript messages={session.messages} />
    </>
  )
}
