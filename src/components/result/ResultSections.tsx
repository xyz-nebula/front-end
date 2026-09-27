import coachArtwork from '@/assets/judge/coach.webp'
import hiringJudgeArtwork from '@/assets/judge/hiring.webp'
import sendingToNegotiationsJudgeArtwork from '@/assets/judge/sending-to-negotiations.webp'
import trusteeOfPropertyJudgeArtwork from '@/assets/judge/trustee-of-property.webp'
import type { NegotiationCoachEpisode, NegotiationMessage, NegotiationPlanStatus, NegotiationResultAnalysis } from '@/types/negotiation'

const statusLabels: Record<NegotiationPlanStatus, string> = { followed: 'Следовал', adapted: 'Адаптировал', unused: 'Не использовал' }
const judgeArtwork = [hiringJudgeArtwork, sendingToNegotiationsJudgeArtwork, trusteeOfPropertyJudgeArtwork] as const

export function ResultIcon({ children, tone = 'blue' }: { children: string; tone?: 'blue' | 'green' | 'red' }) {
  return <span className={`result-icon result-icon--${tone}`} aria-hidden="true">{children}</span>
}

export function ResultOutcome({ analysis, outcome, summary }: { analysis: NegotiationResultAnalysis; outcome: 'victory' | 'defeat'; summary: string }) {
  const success = outcome === 'victory'
  return <section className={`result-outcome ${success ? 'is-success' : 'is-failure'}`} aria-labelledby="result-outcome-title">
    <div className="result-outcome__summary"><small>Итог переговоров</small><div><h2 id="result-outcome-title">{analysis.agreement.title}</h2><span><ResultIcon tone={success ? 'green' : 'red'}>{success ? '✓' : '!'}</ResultIcon>{success ? 'Успешный результат' : 'Нужна ещё попытка'}</span></div><p>{summary}</p></div>
    <div className="result-outcome__facts">
      <article><ResultIcon>▤</ResultIcon><div><h3>Договорённости</h3><ul>{analysis.agreement.points.map((point) => <li key={point}>{point}</li>)}</ul></div></article>
      <article><ResultIcon>⚖</ResultIcon><div><h3>Цена результата</h3><p>{analysis.agreement.tradeoff}</p></div></article>
      <article><ResultIcon>◷</ResultIcon><div><h3>Что будет дальше</h3><p>{analysis.agreement.nextStep}</p></div></article>
    </div>
  </section>
}

export function ResultJudges({ analysis }: { analysis: NegotiationResultAnalysis }) {
  return <section className="result-section result-judges" aria-labelledby="result-judges-title">
    <h2 id="result-judges-title">Что решили судьи</h2>
    <div className="result-judges__grid">{analysis.judges.slice(0, 3).map((judge, index) => <article className={`result-judge is-${judge.verdict}`} key={`${judge.name}-${index}`}>
      <header><span className="result-judge__avatar result-judge__avatar--photo" aria-hidden="true"><img src={judgeArtwork[index]} alt="" width={192} height={192} loading="lazy" decoding="async" /></span><div><h3>{judge.name}</h3><p>{judge.question}</p></div></header>
      <span className="result-judge__verdict"><ResultIcon tone={judge.verdict === 'user' ? 'blue' : 'red'}>{judge.verdict === 'user' ? '✓' : '!'}</ResultIcon>{judge.verdict === 'user' ? 'Выбираю вас' : 'Выбираю AI-оппонента'}</span>
      <p className="result-judge__criterion"><strong>Критерий:</strong> {judge.criterion}</p><blockquote>«{judge.quote}»</blockquote>
      <dl><div><dt>Наблюдение:</dt><dd>{judge.observation}</dd></div><div><dt>Эффект:</dt><dd>{judge.effect}</dd></div><div><dt>Сравнение:</dt><dd>{judge.comparison}</dd></div></dl>
    </article>)}</div>
  </section>
}

function CoachColumn({ title, tone, items }: { title: string; tone: 'green' | 'red'; items: NegotiationCoachEpisode[] }) {
  return <section className={`result-coach__column is-${tone}`}><h3><ResultIcon tone={tone}>{tone === 'green' ? '✓' : '×'}</ResultIcon>{title}</h3><div className="result-coach__episodes">{items.map((item, index) => <article key={`${item.quote}-${index}`}><strong>«{item.quote}»</strong><dl><div><dt>Действие:</dt><dd>{item.action}</dd></div><div><dt>Изменение:</dt><dd>{item.change}</dd></div><div><dt>Последствие:</dt><dd>{item.consequence}</dd></div></dl></article>)}</div></section>
}

export function ResultCoach({ analysis }: { analysis: NegotiationResultAnalysis }) {
  return <section className="result-section result-coach" aria-labelledby="result-coach-title"><h2 id="result-coach-title">Разбор тренера</h2><p className="result-coach__summary"><span className="result-judge__avatar result-judge__avatar--photo" aria-hidden="true"><img src={coachArtwork} alt="" width={192} height={192} loading="lazy" decoding="async" /></span>{analysis.coachSummary}</p><div className="result-coach__grid"><CoachColumn title="Что сработало" tone="green" items={analysis.worked} /><CoachColumn title="Что помешало" tone="red" items={analysis.hindered} /></div></section>
}

export function ResultPlan({ analysis }: { analysis: NegotiationResultAnalysis }) {
  return <section className="result-section result-plan" aria-labelledby="result-plan-title"><h2 id="result-plan-title">План vs реальность</h2><div className="result-plan__table">{analysis.planComparison.map((item, index) => <article key={`${item.plan}-${index}`}><div><ResultIcon>{index === 0 ? '◎' : index === 1 ? '▤' : '◆'}</ResultIcon><p><strong>Планировали:</strong> {item.plan}</p></div><span className={`is-${item.status}`}>{statusLabels[item.status]}</span><p>{item.reality}</p></article>)}</div></section>
}

export function ResultNextSteps({ recommendations }: { recommendations: string[] }) {
  return <section className="result-section result-next" aria-labelledby="result-next-title"><h2 id="result-next-title">Что попробовать в следующей попытке</h2><ol>{recommendations.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol></section>
}

export function ResultTranscript({ messages }: { messages: NegotiationMessage[] }) {
  return <details className="result-transcript"><summary><span><ResultIcon>▤</ResultIcon>Полный транскрипт</span><span aria-hidden="true">⌄</span></summary><div className="result-transcript__body">{messages.length === 0 ? <p className="result-transcript__empty">В этой тренировке не сохранилось реплик.</p> : messages.map((message) => <article className={`result-transcript__message is-${message.speaker}`} key={message.id}><span>{message.speaker === 'user' ? 'Вы' : 'AI-оппонент'}</span><p>{message.text}</p></article>)}</div></details>
}
