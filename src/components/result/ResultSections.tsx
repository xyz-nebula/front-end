import coachArtwork from '@/assets/judge/coach.webp'
import hiringJudgeArtwork from '@/assets/judge/hiring.webp'
import sendingToNegotiationsJudgeArtwork from '@/assets/judge/sending-to-negotiations.webp'
import trusteeOfPropertyJudgeArtwork from '@/assets/judge/trustee-of-property.webp'
import type { NegotiationCoachingPoint, NegotiationJudge, NegotiationJudgeCollege, NegotiationMessage, NegotiationOutcome, NegotiationOutcomeKind, NegotiationPlanStatus, NegotiationTrainer } from '@/types/negotiation'

const statusLabels: Record<NegotiationPlanStatus, string> = { followed: 'Следовал', adapted: 'Адаптировал', unused: 'Не использовал' }
const outcomeLabels: Record<NegotiationOutcomeKind, string> = {
  agreement: 'Договорённость достигнута',
  'partial-agreement': 'Достигнута частичная договорённость',
  deferred: 'Решение отложено',
  'no-agreement': 'Договорённость не достигнута',
  'not-assessable': 'Недостаточно данных для оценки',
}
const judgeMeta: Record<NegotiationJudgeCollege, { name: string; question: string; artwork: string }> = {
  hiring: { name: 'Нанимающий на работу', question: 'Пошёл бы я работать к этому человеку?', artwork: hiringJudgeArtwork },
  negotiation: { name: 'Отправляющий на переговоры', question: 'Кого я отправлю вместо себя на сложные переговоры?', artwork: sendingToNegotiationsJudgeArtwork },
  ownership: { name: 'Доверяющий собственность', question: 'Кому я доверю значимый ресурс?', artwork: trusteeOfPropertyJudgeArtwork },
}

export function ResultIcon({ children, tone = 'blue' }: { children: string; tone?: 'blue' | 'green' | 'red' }) {
  return <span className={`result-icon result-icon--${tone}`} aria-hidden="true">{children}</span>
}

export function ResultOutcome({ outcome }: { outcome: NegotiationOutcome }) {
  if (outcome.status === 'failed') return <section className="result-outcome" aria-labelledby="result-outcome-title"><div className="result-outcome__summary"><small>Итог переговоров</small><h2 id="result-outcome-title">Итог недоступен</h2><p>Остальные части разбора можно посмотреть ниже.</p></div></section>
  const success = outcome.kind === 'agreement'
  return <section className={`result-outcome ${success ? 'is-success' : ''}`} aria-labelledby="result-outcome-title">
    <div className="result-outcome__summary"><small>Итог переговоров</small><div><h2 id="result-outcome-title">{outcomeLabels[outcome.kind]}</h2><span><ResultIcon tone={success ? 'green' : 'blue'}>{success ? '✓' : '!'}</ResultIcon>{outcomeLabels[outcome.kind]}</span></div><p>{outcome.summary}</p></div>
    <div className="result-outcome__facts">
      <article><ResultIcon>▤</ResultIcon><div><h3>Договорённости</h3>{outcome.agreedTerms.length > 0 ? <ul>{outcome.agreedTerms.map((point) => <li key={point}>{point}</li>)}</ul> : <p>Нет зафиксированных договорённостей.</p>}</div></article>
      <article><ResultIcon>⚖</ResultIcon><div><h3>Открытые вопросы</h3>{outcome.openPoints.length > 0 ? <ul>{outcome.openPoints.map((point) => <li key={point}>{point}</li>)}</ul> : <p>Открытых вопросов не осталось.</p>}</div></article>
      <article><ResultIcon>◷</ResultIcon><div><h3>Что будет дальше</h3><p>{outcome.nextStep ?? 'Следующий шаг не определён.'}</p></div></article>
    </div>
  </section>
}

export function ResultJudges({ judges }: { judges: NegotiationJudge[] }) {
  return <section className="result-section result-judges" aria-labelledby="result-judges-title"><h2 id="result-judges-title">Что решили судьи</h2><div className="result-judges__grid">{judges.map((judge) => {
    const meta = judgeMeta[judge.college]
    return <article className={`result-judge ${judge.status === 'ready' ? `is-${judge.verdict.choice}` : ''}`} key={judge.college}>
      <header><span className="result-judge__avatar result-judge__avatar--photo" aria-hidden="true"><img src={meta.artwork} alt="" width={192} height={192} loading="lazy" decoding="async" /></span><div><h3>{meta.name}</h3><p>{meta.question}</p></div></header>
      {judge.status === 'failed' ? <p>Вердикт недоступен.</p> : <><span className="result-judge__verdict"><ResultIcon tone={judge.verdict.choice === 'user' ? 'blue' : 'red'}>{judge.verdict.choice === 'user' ? '✓' : '!'}</ResultIcon>{judge.verdict.choice === 'user' ? 'Выбираю вас' : 'Выбираю AI-оппонента'}</span><p className="result-judge__criterion"><strong>Критерий:</strong> {judge.verdict.criterion}</p><blockquote>«{judge.verdict.evidence.quote}»</blockquote><dl><div><dt>Наблюдение:</dt><dd>{judge.verdict.observation}</dd></div><div><dt>Эффект:</dt><dd>{judge.verdict.effect}</dd></div><div><dt>Сравнение:</dt><dd>{judge.verdict.comparison}</dd></div></dl></>}
    </article>
  })}</div></section>
}

function CoachColumn({ title, tone, items }: { title: string; tone: 'green' | 'red'; items: NegotiationCoachingPoint[] }) {
  return <section className={`result-coach__column is-${tone}`}><h3><ResultIcon tone={tone}>{tone === 'green' ? '✓' : '×'}</ResultIcon>{title}</h3><div className="result-coach__episodes">{items.map((item, index) => <article key={`${item.evidence.quote}-${index}`}><strong>«{item.evidence.quote}»</strong><dl><div><dt>Действие:</dt><dd>{item.action}</dd></div><div><dt>Изменение:</dt><dd>{item.situationChange}</dd></div><div><dt>Последствие:</dt><dd>{item.consequence}</dd></div></dl></article>)}</div></section>
}

export function ResultCoach({ trainer }: { trainer: NegotiationTrainer }) {
  if (trainer.status === 'failed') return <section className="result-section result-coach"><h2>Разбор тренера</h2><p>Разбор тренера недоступен.</p></section>
  return <section className="result-section result-coach" aria-labelledby="result-coach-title"><h2 id="result-coach-title">Разбор тренера</h2><p className="result-coach__summary"><span className="result-judge__avatar result-judge__avatar--photo" aria-hidden="true"><img src={coachArtwork} alt="" width={192} height={192} loading="lazy" decoding="async" /></span>{trainer.feedback.summary}</p><div className="result-coach__grid"><CoachColumn title="Что сработало" tone="green" items={trainer.feedback.strengths} /><CoachColumn title="Что помешало" tone="red" items={trainer.feedback.mistakes} /></div></section>
}

export function ResultPlan({ trainer }: { trainer: NegotiationTrainer }) {
  if (trainer.status === 'failed' || trainer.feedback.planVsReality === null) return null
  return <section className="result-section result-plan" aria-labelledby="result-plan-title"><h2 id="result-plan-title">План vs реальность</h2><p>{trainer.feedback.planVsReality.summary}</p><div className="result-plan__table">{trainer.feedback.planVsReality.items.map((item, index) => <article key={`${item.preparationText}-${index}`}><div><ResultIcon>{index === 0 ? '◎' : index === 1 ? '▤' : '◆'}</ResultIcon><p><strong>Планировали:</strong> {item.preparationText}</p></div><span className={`is-${item.status}`}>{statusLabels[item.status]}</span><p>{item.observation}</p></article>)}</div></section>
}

export function ResultNextSteps({ trainer }: { trainer: NegotiationTrainer }) {
  if (trainer.status === 'failed') return null
  return <section className="result-section result-next" aria-labelledby="result-next-title"><h2 id="result-next-title">Что попробовать в следующей попытке</h2><ol>{trainer.feedback.nextTry.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol></section>
}

export function ResultTranscript({ messages }: { messages: NegotiationMessage[] }) {
  return <details className="result-transcript"><summary><span><ResultIcon>▤</ResultIcon>Полный транскрипт</span><span aria-hidden="true">⌄</span></summary><div className="result-transcript__body">{messages.length === 0 ? <p className="result-transcript__empty">В этой тренировке не сохранилось реплик.</p> : messages.map((message) => <article className={`result-transcript__message is-${message.speaker}`} key={message.id}><span>{message.speaker === 'user' ? 'Вы' : 'AI-оппонент'}</span><p>{message.text}</p></article>)}</div></details>
}
