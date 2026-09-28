import cycleImage from '@/assets/problem/93df19e0-bb6b-470c-90b9-48358b82d2bd.webp'
import practiceImage from '@/assets/problem/d40a0404-67bb-4569-8861-5aab88fcb2c8.webp'
import mistakeImage from '@/assets/problem/f85c1a51-7601-4574-ab71-5125cee6e8c2.webp'

type ProblemStepIconName = 'attempt' | 'feedback' | 'strategy' | 'repeat'

interface ProblemStepIconProps {
  name: ProblemStepIconName
}

const problemCards = [
  {
    image: practiceImage,
    imageClassName: 'arena-problem-card__image--practice',
    alt: 'Участник ждёт партнёра для тренировки переговоров',
    title: 'Мало практики',
    subtitle: 'Для тренировки нужен второй участник',
    description:
      'Чтобы полноценно потренироваться, нужно найти партнёра, распределить роли и организовать время. С тренером это ещё сложнее и дороже.',
  },
  {
    image: mistakeImage,
    imageClassName: 'arena-problem-card__image--mistake',
    alt: 'Неудачные переговоры двух участников за столом',
    title: 'Ошибки имеют последствия',
    subtitle: 'Реальные переговоры нельзя использовать как песочницу',
    description:
      'Разговор о зарплате, конфликт с сотрудником или переговоры с клиентом нельзя безболезненно переиграть, если стратегия оказалась неудачной.',
  },
  {
    image: cycleImage,
    imageClassName: 'arena-problem-card__image--cycle',
    alt: 'Цикл тренировки с попыткой, разбором, новой стратегией и повтором',
    title: 'Нет цикла повторения',
    subtitle: 'Одного разговора недостаточно',
    description:
      'Навык развивается через цикл: попробовал → получил обратную связь → изменил стратегию → попробовал снова. Обычные форматы плохо поддерживают этот процесс.',
  },
] as const

const problemSteps: Array<{ icon: ProblemStepIconName; label: string }> = [
  { icon: 'attempt', label: 'Попытка' },
  { icon: 'feedback', label: 'Обратная связь' },
  { icon: 'strategy', label: 'Изменение стратегии' },
  { icon: 'repeat', label: 'Повтор' },
]

function ProblemStepIcon({ name }: ProblemStepIconProps) {
  if (name === 'attempt') {
    return (
      <svg viewBox="0 0 30 30" aria-hidden="true">
        <circle cx="15" cy="15" r="13" fill="currentColor" />
        <path d="m12 9 9 6-9 6V9Z" fill="#fff" />
      </svg>
    )
  }

  if (name === 'feedback') {
    return (
      <svg viewBox="0 0 30 30" aria-hidden="true">
        <path d="M5 4h20a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H13l-6 5v-5H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="currentColor" />
        <circle cx="10" cy="13" r="1.6" fill="#fff" />
        <circle cx="15" cy="13" r="1.6" fill="#fff" />
        <circle cx="20" cy="13" r="1.6" fill="#fff" />
      </svg>
    )
  }

  if (name === 'strategy') {
    return (
      <svg viewBox="0 0 30 30" aria-hidden="true">
        <rect x="3" y="18" width="6" height="9" rx="2" fill="currentColor" />
        <rect x="12" y="11" width="6" height="16" rx="2" fill="currentColor" />
        <rect x="21" y="3" width="6" height="24" rx="2" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 30 30" aria-hidden="true">
      <path d="M24.5 9.5A11 11 0 0 0 6.7 7.2L4 10m0 0 .2-6M4 10h6M5.5 20.5a11 11 0 0 0 17.8 2.3L26 20m0 0-.2 6M26 20h-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DecorativeCube({ side }: { side: 'left' | 'right' }) {
  return (
    <span className={`arena-problem__cube arena-problem__cube--${side}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

export function ProblemSection() {
  return (
    <section className="arena-problem" id="problem" aria-labelledby="problem-title">
      <DecorativeCube side="left" />
      <DecorativeCube side="right" />

      <div className="arena-shell arena-problem__layout">
        <header className="arena-problem__header">
          <p className="arena-problem__eyebrow">Почему это важно</p>
          <h2 id="problem-title">
            Переговоры — навык,<br />{' '}
            который нельзя натренировать<br className="arena-problem__title-break" />{' '}только по книге
          </h2>
          <p className="arena-problem__intro">
            Тренинги и ролевые игры дают практику, но требуют других людей, времени и организации.<br />{' '}
            А реальные переговоры не дают права на безопасную ошибку и повторную попытку.
          </p>
        </header>

        <div className="arena-problem__cards">
          {problemCards.map((card) => (
            <article className="arena-problem-card" key={card.title}>
              <div className="arena-problem-card__visual">
                <img
                  className={`arena-problem-card__image ${card.imageClassName}`}
                  src={card.image}
                  alt={card.alt}
                  width={1200}
                  height={600}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="arena-problem-card__copy">
                <h3>{card.title}</h3>
                <p className="arena-problem-card__subtitle">{card.subtitle}</p>
                <p className="arena-problem-card__description">{card.description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="arena-problem__conclusion">
          <p>Навык формируется не одной идеальной попыткой,<br />{' '}а десятками безопасных повторений.</p>
          <ol className="arena-problem__steps" aria-label="Цикл развития навыка переговоров">
            {problemSteps.map((step, index) => (
              <li key={step.label}>
                <span className="arena-problem__step">
                  <ProblemStepIcon name={step.icon} />
                  <span>{step.label}</span>
                </span>
                {index < problemSteps.length - 1 && (
                  <svg className="arena-problem__step-arrow" viewBox="0 0 34 18" aria-hidden="true">
                    <path d="M1 9h29m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
