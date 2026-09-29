import coachArtwork from '@/assets/judge/coach.webp'
import hiringJudgeArtwork from '@/assets/judge/hiring.webp'
import sendingToNegotiationsJudgeArtwork from '@/assets/judge/sending-to-negotiations.webp'
import trusteeOfPropertyJudgeArtwork from '@/assets/judge/trustee-of-property.webp'
import type {
  NegotiationCoachingPoint,
  NegotiationGoalStatus,
  NegotiationJudge,
  NegotiationJudgeCollege,
  NegotiationMessage,
  NegotiationOutcome,
  NegotiationOutcomeKind,
  NegotiationPlanStatus,
  NegotiationTrainer,
} from '@/types/negotiation'

type ResultTone = 'blue' | 'green' | 'red' | 'amber' | 'neutral'
type OutcomeTone = 'success' | 'partial' | 'deferred' | 'failure' | 'neutral'

const statusLabels: Record<NegotiationPlanStatus, string> = {
  followed: 'Следовал',
  adapted: 'Адаптировал',
  unused: 'Не использовал',
}
const outcomeMeta: Record<NegotiationOutcomeKind, { label: string; badge: string; icon: string; tone: OutcomeTone }> = {
  agreement: { label: 'Договорённость достигнута', badge: 'Полная договорённость', icon: '✓', tone: 'success' },
  'partial-agreement': { label: 'Частичная договорённость', badge: 'Часть вопросов согласована', icon: '◐', tone: 'partial' },
  deferred: { label: 'Решение отложено', badge: 'Нужен следующий раунд', icon: '◷', tone: 'deferred' },
  'no-agreement': { label: 'Договорённость не достигнута', badge: 'Без договорённости', icon: '×', tone: 'failure' },
  'not-assessable': { label: 'Недостаточно данных для оценки', badge: 'Оценка невозможна', icon: '?', tone: 'neutral' },
}
const goalStatusLabels: Record<NegotiationGoalStatus, string> = {
  achieved: 'Цель достигнута',
  'partially-achieved': 'Цель достигнута частично',
  'not-achieved': 'Цель не достигнута',
  'not-assessable': 'Недостаточно данных для оценки',
}
const judgeMeta: Record<NegotiationJudgeCollege, { name: string; question: string; artwork: string }> = {
  hiring: { name: 'Нанимающий на работу', question: 'Пошёл бы я работать к этому человеку?', artwork: hiringJudgeArtwork },
  negotiation: { name: 'Отправляющий на переговоры', question: 'Кого я отправлю вместо себя на сложные переговоры?', artwork: sendingToNegotiationsJudgeArtwork },
  ownership: { name: 'Доверяющий собственность', question: 'Кому я доверю значимый ресурс?', artwork: trusteeOfPropertyJudgeArtwork },
}

export function ResultIcon({ children, tone = 'blue' }: { children: string; tone?: ResultTone }) {
  return <span className={`result-icon result-icon--${tone}`} aria-hidden="true">{children}</span>
}

export function ResultOutcome({ outcome }: { outcome: NegotiationOutcome }) {
  if (outcome.status === 'failed') {
    return (
      <section className="result-outcome is-unavailable" aria-labelledby="result-outcome-title" data-tour-id="result">
        <div className="result-outcome__summary">
          <small>Итог переговоров</small>
          <h2 id="result-outcome-title">Итог недоступен</h2>
          <p>Остальные части разбора можно посмотреть ниже.</p>
        </div>
      </section>
    )
  }

  const meta = outcomeMeta[outcome.kind]
  return (
    <section className={`result-outcome is-${meta.tone}`} aria-labelledby="result-outcome-title" data-tour-id="result">
      <div className="result-outcome__summary">
        <small>Итог переговоров</small>
        <div>
          <h2 id="result-outcome-title">{meta.label}</h2>
          <span><ResultIcon>{meta.icon}</ResultIcon>{meta.badge}</span>
        </div>
        <p>{outcome.summary}</p>
      </div>
      <div className="result-outcome__facts">
        <article>
          <ResultIcon>▤</ResultIcon>
          <div>
            <h3>Договорённости</h3>
            {outcome.agreedTerms.length > 0
              ? <ul>{outcome.agreedTerms.map((point) => <li key={point}>{point}</li>)}</ul>
              : <p>Нет зафиксированных договорённостей.</p>}
          </div>
        </article>
        <article>
          <ResultIcon>⚖</ResultIcon>
          <div>
            <h3>Открытые вопросы</h3>
            {outcome.openPoints.length > 0
              ? <ul>{outcome.openPoints.map((point) => <li key={point}>{point}</li>)}</ul>
              : <p>Открытых вопросов не осталось.</p>}
          </div>
        </article>
        <article>
          <ResultIcon>◷</ResultIcon>
          <div><h3>Что будет дальше</h3><p>{outcome.nextStep ?? 'Следующий шаг не определён.'}</p></div>
        </article>
      </div>
    </section>
  )
}

export function ResultJudges({ judges }: { judges: NegotiationJudge[] }) {
  return (
    <section className="result-section result-judges" aria-labelledby="result-judges-title">
      <h2 id="result-judges-title">Что решили судьи</h2>
      <div className="result-judges__grid">
        {judges.map((judge) => {
          const meta = judgeMeta[judge.college]
          return (
            <article className={`result-judge ${judge.status === 'ready' ? `is-${judge.verdict.choice}` : 'is-unavailable'}`} key={judge.college}>
              <header>
                <span className="result-judge__avatar result-judge__avatar--photo" aria-hidden="true">
                  <img src={meta.artwork} alt="" width={192} height={192} loading="lazy" decoding="async" />
                </span>
                <div><h3>{meta.name}</h3><p>{meta.question}</p></div>
              </header>
              {judge.status === 'failed'
                ? <p className="result-local-unavailable">Вердикт недоступен</p>
                : (
                  <>
                    <span className="result-judge__verdict">
                      <ResultIcon tone={judge.verdict.choice === 'user' ? 'blue' : 'red'}>{judge.verdict.choice === 'user' ? '✓' : '!'}</ResultIcon>
                      {judge.verdict.choice === 'user' ? 'Выбираю вас' : 'Выбираю AI-оппонента'}
                    </span>
                    <p className="result-judge__criterion"><strong>Критерий:</strong> {judge.verdict.criterion}</p>
                    <blockquote>«{judge.verdict.evidence.quote}»</blockquote>
                    <dl>
                      <div><dt>Наблюдение:</dt><dd>{judge.verdict.observation}</dd></div>
                      <div><dt>Эффект:</dt><dd>{judge.verdict.effect}</dd></div>
                      <div><dt>Сравнение:</dt><dd>{judge.verdict.comparison}</dd></div>
                    </dl>
                  </>
                )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function CoachColumn({ title, tone, icon, items }: { title: string; tone: 'green' | 'red' | 'amber'; icon: string; items: NegotiationCoachingPoint[] }) {
  return (
    <section className={`result-coach__column is-${tone}`}>
      <h3><ResultIcon tone={tone}>{icon}</ResultIcon>{title}</h3>
      {items.length > 0
        ? (
          <div className="result-coach__episodes">
            {items.map((item, index) => (
              <article key={`${item.evidence.quote}-${index}`}>
                <strong>«{item.evidence.quote}»</strong>
                <dl>
                  <div><dt>Действие:</dt><dd>{item.action}</dd></div>
                  <div><dt>Изменение:</dt><dd>{item.situationChange}</dd></div>
                  <div><dt>Последствие:</dt><dd>{item.consequence}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        )
        : <p className="result-coach__empty">В разборе нет эпизодов для этого блока.</p>}
    </section>
  )
}

export function ResultCoach({ trainer }: { trainer: NegotiationTrainer }) {
  if (trainer.status === 'failed') {
    return (
      <section className="result-section result-coach" aria-labelledby="result-coach-title">
        <h2 id="result-coach-title">Разбор тренера</h2>
        <p className="result-local-unavailable">Разбор тренера недоступен. Итог переговоров и готовые вердикты судей можно посмотреть выше.</p>
      </section>
    )
  }

  const { feedback } = trainer
  return (
    <section className="result-section result-coach" aria-labelledby="result-coach-title">
      <h2 id="result-coach-title">Разбор тренера</h2>
      <p className="result-coach__summary">
        <span className="result-judge__avatar result-judge__avatar--photo" aria-hidden="true">
          <img src={coachArtwork} alt="" width={192} height={192} loading="lazy" decoding="async" />
        </span>
        {feedback.summary}
      </p>
      <div className="result-coach__grid">
        <CoachColumn title="Что сработало" tone="green" icon="✓" items={feedback.strengths} />
        <CoachColumn title="Что помешало" tone="red" icon="×" items={feedback.mistakes} />
        <CoachColumn title="Упущенные возможности" tone="amber" icon="!" items={feedback.missedOpportunities} />
      </div>
      <section className={`result-goal is-${feedback.goalAssessment.status}`} aria-labelledby="result-goal-title">
        <div className="result-goal__heading">
          <div><small>Достижение цели</small><h3 id="result-goal-title">{goalStatusLabels[feedback.goalAssessment.status]}</h3></div>
          <span>{goalStatusLabels[feedback.goalAssessment.status]}</span>
        </div>
        {feedback.goalAssessment.goalText && <p><strong>Цель:</strong> {feedback.goalAssessment.goalText}</p>}
        <p>{feedback.goalAssessment.explanation}</p>
        {feedback.goalAssessment.evidence.length > 0 && (
          <div className="result-goal__evidence">
            {feedback.goalAssessment.evidence.map((item, index) => <blockquote key={`${item.messageIndex}-${index}`}>«{item.quote}»</blockquote>)}
          </div>
        )}
      </section>
    </section>
  )
}

export function ResultPlan({ trainer }: { trainer: NegotiationTrainer }) {
  if (trainer.status === 'failed') return null
  if (trainer.feedback.planVsReality === null) {
    return <p className="result-plan-unavailable" role="note"><strong>План vs реальность:</strong> сравнение недоступно, потому что подготовка не сохранилась для этого разбора.</p>
  }

  return (
    <section className="result-section result-plan" aria-labelledby="result-plan-title">
      <h2 id="result-plan-title">План vs реальность</h2>
      <p>{trainer.feedback.planVsReality.summary}</p>
      <div className="result-plan__table">
        {trainer.feedback.planVsReality.items.map((item, index) => (
          <article key={`${item.preparationText}-${index}`}>
            <div><ResultIcon>{index === 0 ? '◎' : index === 1 ? '▤' : '◆'}</ResultIcon><p><strong>Планировали:</strong> {item.preparationText}</p></div>
            <span className={`is-${item.status}`}>{statusLabels[item.status]}</span>
            <p>{item.observation}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ResultNextSteps({ trainer }: { trainer: NegotiationTrainer }) {
  if (trainer.status === 'failed') return null
  return (
    <section className="result-section result-next" aria-labelledby="result-next-title">
      <h2 id="result-next-title">Что попробовать в следующей попытке</h2>
      <ol>{trainer.feedback.nextTry.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol>
    </section>
  )
}

export function ResultTranscript({ messages }: { messages: NegotiationMessage[] }) {
  return (
    <details className="result-transcript">
      <summary><span><ResultIcon>▤</ResultIcon>Полный транскрипт</span><span aria-hidden="true">⌄</span></summary>
      <div className="result-transcript__body">
        {messages.length === 0
          ? <p className="result-transcript__empty">В этой тренировке не сохранилось реплик.</p>
          : messages.map((message) => (
            <article className={`result-transcript__message is-${message.speaker}`} key={message.id}>
              <span>{message.speaker === 'user' ? 'Вы' : 'AI-оппонент'}</span><p>{message.text}</p>
            </article>
          ))}
      </div>
    </details>
  )
}
