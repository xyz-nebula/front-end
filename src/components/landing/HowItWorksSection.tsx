import chooseRoleImage from '@/assets/how-its-work/choose-role.webp'
import negotiateImage from '@/assets/how-its-work/negotiation-duel.webp'
import prepareStrategyImage from '@/assets/how-its-work/prepare-strategy.webp'
import reviewImage from '@/assets/how-its-work/result-review.webp'

interface HowItWorksStep {
  number: string
  title: string
  description: string
  image: string
  imageWidth: number
  imageHeight: number
  alt: string
}

const howItWorksSteps: HowItWorksStep[] = [
  {
    number: '01',
    title: 'Выбери кейс и роль',
    description:
      'Выбери переговорную ситуацию, изучи контекст и реши, за какую сторону будешь играть.',
    image: chooseRoleImage,
    imageWidth: 1122,
    imageHeight: 986,
    alt: 'Экран выбора переговорного кейса и роли участника',
  },
  {
    number: '02',
    title: 'Подготовь стратегию',
    description:
      'Определи цель, границы торга, BATNA и сценарий разговора. AI-тренер поможет увидеть слабые места.',
    image: prepareStrategyImage,
    imageWidth: 859,
    imageHeight: 882,
    alt: 'Экран подготовки цели, границ торга, BATNA и сценария',
  },
  {
    number: '03',
    title: 'Проведи поединок',
    description:
      'Пять минут голосовых переговоров с AI-оппонентом, который отстаивает собственные интересы.',
    image: negotiateImage,
    imageWidth: 1122,
    imageHeight: 1030,
    alt: 'Экран голосового поединка с AI-оппонентом',
  },
  {
    number: '04',
    title: 'Получи разбор',
    description:
      'Судьи оценивают результат, а тренер показывает, что изменить в следующей попытке.',
    image: reviewImage,
    imageWidth: 1087,
    imageHeight: 1196,
    alt: 'Экран результата переговоров и персонального разбора',
  },
]

function DecorativeCube({ variant }: { variant: 'primary' | 'muted' }) {
  return (
    <span className={`arena-how__cube arena-how__cube--${variant}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M39 18A16 16 0 0 0 11.5 12L7 17m0 0 .5-9M7 17h9M9 30a16 16 0 0 0 27.5 6L41 31m0 0-.5 9M41 31h-9" />
    </svg>
  )
}

export function HowItWorksSection() {
  return (
    <section className="arena-how" id="how-it-works" aria-labelledby="how-it-works-title">
      <div className="arena-how__decoration" aria-hidden="true">
        <DecorativeCube variant="primary" />
        <DecorativeCube variant="muted" />
      </div>

      <div className="arena-shell arena-how__layout">
        <header className="arena-how__header">
          <p className="arena-how__eyebrow">Как это работает</p>
          <h2 id="how-it-works-title">От кейса до новой стратегии — за один цикл</h2>
          <p className="arena-how__intro">
            Выбери ситуацию и роль, подготовь позицию, проведи 5-минутный поединок
            <br className="arena-how__intro-break" /> и разбери свои решения вместе с AI.
          </p>
        </header>

        <div className="arena-how__board">
          <div className="arena-how__progress" aria-hidden="true">
            {howItWorksSteps.map((step) => (
              <span key={step.number}>
                <b>{step.number}</b>
                <i />
              </span>
            ))}
          </div>

          <ol className="arena-how__steps" aria-label="Четыре этапа тренировки на Арене">
            {howItWorksSteps.map((step) => (
              <li className="arena-how-step" key={step.number}>
                <div className="arena-how-step__marker" aria-hidden="true">
                  <i />
                  <span>{step.number}</span>
                </div>
                <div className="arena-how-step__content">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <div className="arena-how-step__visual">
                    <img
                      className="arena-how-step__image"
                      src={step.image}
                      alt={step.alt}
                      width={step.imageWidth}
                      height={step.imageHeight}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="arena-how__cycle" aria-hidden="true">
            <span>Разбор → новая стратегия → повтор</span>
            <svg viewBox="0 0 1200 78" preserveAspectRatio="none">
              <path d="M1148 8C1148 69 171 72 83 18" />
              <path d="m83 18 12 27M83 18l29 4" />
            </svg>
          </div>
        </div>

        <p className="arena-how__conclusion">
          Каждая новая попытка начинается с того, что ты узнал в предыдущей.
        </p>

        <div className="arena-how__repeat">
          <RepeatIcon />
          <p><strong>Разбери.</strong> Измени стратегию.<br />Попробуй снова.</p>
          <div className="arena-how__repeat-cubes" aria-hidden="true">
            <DecorativeCube variant="muted" />
            <DecorativeCube variant="primary" />
          </div>
        </div>
      </div>
    </section>
  )
}
