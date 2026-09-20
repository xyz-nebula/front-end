import { Link } from 'react-router-dom'

import { HeroScene } from '@/components/landing/HeroScene'
import { LandingHeader } from '@/components/landing/LandingHeader'
import '@/styles/landing.css'

type BenefitIconName = 'chart' | 'brain' | 'shield'

interface BenefitIconProps {
  name: BenefitIconName
}

function BenefitIcon({ name }: BenefitIconProps) {
  if (name === 'chart') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="3" y="20" width="5" height="9" rx="1.5" />
        <rect x="13" y="12" width="5" height="17" rx="1.5" />
        <rect x="23" y="4" width="5" height="25" rx="1.5" />
      </svg>
    )
  }

  if (name === 'brain') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M12.4 4.1A4.5 4.5 0 0 0 6.3 8a4.8 4.8 0 0 0 .4 1.9A5 5 0 0 0 5.5 19a4.3 4.3 0 0 0 4.3 4.3h.3a4.3 4.3 0 0 0 4.2 3.8V4.5a2.7 2.7 0 0 0-1.9-.4Zm7.2 0A4.5 4.5 0 0 1 25.7 8a4.8 4.8 0 0 1-.4 1.9 5 5 0 0 1 1.2 9.1 4.3 4.3 0 0 1-4.3 4.3h-.3a4.3 4.3 0 0 1-4.2 3.8V4.5a2.7 2.7 0 0 1 1.9-.4Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M9.4 11.7h4.9m-2.7 0v4m11-4h-4.9m2.7 0v4M9.6 21l4.7-3m8.1 3-4.7-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3 27 7v8.7c0 6.2-4.4 10.7-11 13.3C9.4 26.4 5 21.9 5 15.7V7l11-4Z" />
      <path d="m11.2 16 3.1 3.1 6.7-7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const benefits: Array<{ icon: BenefitIconName; text: string }> = [
  { icon: 'chart', text: 'Реалистичные рабочие кейсы' },
  { icon: 'brain', text: 'AI со своими целями и ограничениями' },
  { icon: 'shield', text: 'Независимое судейство и разбор' },
]

const futureSections = [
  { number: '02', id: 'problem', title: 'Проблема — почему обычной практики недостаточно' },
  { number: '03', id: 'how-it-works', title: 'Как работает Арена — 4 этапа' },
  { number: '04', id: 'ai-opponent', title: 'AI-оппонент, который действительно ведёт переговоры' },
  { number: '05', id: 'preparation', title: 'Глубокая подготовка + AI-тренер' },
  { number: '06', id: 'review', title: 'Независимое судейство и персональный разбор' },
  { number: '07', id: 'cases', title: 'Реальные кейсы и разные переговорные ситуации' },
  { number: '08', id: 'methodology', title: 'Методология и развитие навыка' },
  { number: '09', id: 'teams', title: 'Для команд и компаний + финальный CTA' },
]

function HeroBenefits() {
  return (
    <div className="arena-benefits" aria-label="Преимущества Арены">
      {benefits.map((benefit) => (
        <div className="arena-benefits__item" key={benefit.text}>
          <span className="arena-benefits__icon"><BenefitIcon name={benefit.icon} /></span>
          <span>{benefit.text}</span>
        </div>
      ))}
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="arena-landing">
      <LandingHeader />

      <main>
        <section className="arena-hero" aria-labelledby="arena-hero-title">
          <div className="arena-shell arena-hero__layout">
            <div className="arena-hero__copy">
              <span className="arena-hero__number">01</span>
              <h1 id="arena-hero-title" aria-label="Тренируй переговоры как стратегическую игру">
                <span>Тренируй</span>
                <span>переговоры</span>
                <span>как стратегическую игру</span>
              </h1>
              <p>Готовь стратегию, веди голосовые переговоры с AI-оппонентом и получай разбор своих решений.</p>
              <Link className="arena-hero__cta" to="/home">
                <span>Начать поединок</span>
                <svg viewBox="0 0 26 26" aria-hidden="true">
                  <path d="M3 13h18m-6.5-6.5L21 13l-6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <p className="arena-hero__meta">5 минут <i /> голосом <i /> с персональным разбором</p>
            </div>

            <HeroScene />
            <HeroBenefits />
          </div>
        </section>

        <div className="arena-future-sections">
          {futureSections.map((section, index) => (
            <section
              className={`arena-placeholder ${index % 2 === 1 ? 'arena-placeholder--tinted' : ''} ${section.id === 'teams' ? 'arena-placeholder--final' : ''}`}
              id={section.id}
              key={section.id}
              aria-labelledby={`${section.id}-title`}
            >
              <div className="arena-shell arena-placeholder__layout">
                <span className="arena-placeholder__number">{section.number}</span>
                <h2 id={`${section.id}-title`}>{section.title}</h2>
                <div className="arena-placeholder__card" aria-hidden="true">
                  <span>Следующий этап редизайна</span>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
