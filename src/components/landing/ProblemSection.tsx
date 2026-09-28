import cycleImage from '@/assets/problem/93df19e0-bb6b-470c-90b9-48358b82d2bd.webp'
import practiceImage from '@/assets/problem/d40a0404-67bb-4569-8861-5aab88fcb2c8.webp'
import mistakeImage from '@/assets/problem/f85c1a51-7601-4574-ab71-5125cee6e8c2.webp'

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

      </div>
    </section>
  )
}
