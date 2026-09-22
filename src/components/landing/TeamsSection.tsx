import { Link } from 'react-router-dom'

import ctaImage from '@/assets/for-command/for-cta.webp'
import employeeImage from '@/assets/for-command/for-employee.webp'
import hrImage from '@/assets/for-command/for-hr.webp'
import { CaseSettingsPreview } from './CaseSettingsPreview'

type AudienceIconName = 'employee' | 'trainer' | 'team'

interface AudienceCard {
  id: 'employee' | 'trainer' | 'hr'
  icon: AudienceIconName
  desktopLabel: string
  mobileLabel: string
  desktopTitle: string
  mobileTitle: string
  desktopDescription: string
  mobileDescription: string
  image?: string
  imageWidth?: number
  imageHeight?: number
}

const audienceCards: AudienceCard[] = [
  {
    id: 'employee',
    icon: 'employee',
    desktopLabel: 'Для сотрудника',
    mobileLabel: 'Сотрудник',
    desktopTitle: 'Больше практики',
    mobileTitle: 'Больше практики',
    desktopDescription:
      'Тренироваться можно самостоятельно и возвращаться к сложным ситуациям столько раз, сколько нужно.',
    mobileDescription:
      'Тренируется самостоятельно и может повторять сложные ситуации.',
    image: employeeImage,
    imageWidth: 960,
    imageHeight: 720,
  },
  {
    id: 'trainer',
    icon: 'trainer',
    desktopLabel: 'Для тренера и методиста',
    mobileLabel: 'Тренер / методист',
    desktopTitle: 'Свои ситуации и правила',
    mobileTitle: 'Свои ситуации',
    desktopDescription:
      'Настраивайте контекст, роли, цели, сложность и поведение оппонента под конкретную учебную задачу.',
    mobileDescription:
      'Настраивает роли, цели, сложность и поведение AI-оппонента.',
  },
  {
    id: 'hr',
    icon: 'team',
    desktopLabel: 'Для HR / L&D',
    mobileLabel: 'HR / L&D',
    desktopTitle: 'Единый формат развития',
    mobileTitle: 'Единый формат развития',
    desktopDescription:
      'Одни и те же кейсы и принципы разбора можно использовать для системной тренировки всей команды.',
    mobileDescription:
      'Использует общие кейсы и принципы разбора для всей команды.',
    image: hrImage,
    imageWidth: 960,
    imageHeight: 320,
  },
]

function AudienceIcon({ name }: { name: AudienceIconName }) {
  if (name === 'employee') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="10" r="6" />
        <path d="M5.5 27c.8-7 4.2-10.5 10.5-10.5S25.7 20 26.5 27Z" />
      </svg>
    )
  }

  if (name === 'trainer') {
    return (
      <svg viewBox="0 0 36 32" aria-hidden="true">
        <path d="m18 3 16 8-16 8L2 11l16-8Z" />
        <path d="M8 15.5V23c4.8 4 15.2 4 20 0v-7.5M33 12v9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 38 32" aria-hidden="true">
      <circle cx="19" cy="9" r="5" />
      <circle cx="7.5" cy="12" r="4" />
      <circle cx="30.5" cy="12" r="4" />
      <path d="M10 28c.4-8 3.3-12 9-12s8.6 4 9 12ZM1.5 28c.3-6 2.3-9 6-9 2 0 3.6.8 4.7 2.4M36.5 28c-.3-6-2.3-9-6-9-2 0-3.6.8-4.7 2.4" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 26 26" aria-hidden="true">
      <path d="M3 13h18m-6.5-6.5L21 13l-6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function TeamsSection() {
  return (
    <section className="arena-teams" id="teams" aria-labelledby="teams-title">
      <div className="arena-shell arena-teams__layout">
        <header className="arena-teams__header">
          <p className="arena-teams__eyebrow">Для команд и компаний</p>
          <h2 id="teams-title">Одна Арена — разные задачи команды</h2>
          <p>
            Настраивайте ситуации под задачи компании и давайте сотрудникам больше
            самостоятельной практики.
          </p>
        </header>

        <ul className="arena-teams__cards" aria-label="Возможности Арены для команды">
          {audienceCards.map((card) => (
            <li className={`arena-team-card arena-team-card--${card.id}`} key={card.id}>
              <div className="arena-team-card__copy">
                <p className="arena-team-card__label">
                  <span className="arena-team-card__icon">
                    <AudienceIcon name={card.icon} />
                  </span>
                  <span className="arena-team-card__desktop-copy">{card.desktopLabel}</span>
                  <span className="arena-team-card__mobile-copy">{card.mobileLabel}</span>
                </p>
                <h3>
                  <span className="arena-team-card__desktop-copy">{card.desktopTitle}</span>
                  <span className="arena-team-card__mobile-copy">{card.mobileTitle}</span>
                </h3>
                <p className="arena-team-card__description">
                  <span className="arena-team-card__desktop-copy">{card.desktopDescription}</span>
                  <span className="arena-team-card__mobile-copy">{card.mobileDescription}</span>
                </p>
              </div>

              <div className="arena-team-card__visual" aria-hidden="true">
                {card.id === 'trainer' ? (
                  <CaseSettingsPreview />
                ) : (
                  <img
                    src={card.image}
                    alt=""
                    width={card.imageWidth}
                    height={card.imageHeight}
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>

        <section className="arena-teams-cta" aria-labelledby="teams-cta-title">
          <img
            className="arena-teams-cta__scene"
            src={ctaImage}
            alt=""
            aria-hidden="true"
            width={1672}
            height={941}
            loading="lazy"
            decoding="async"
          />
          <div className="arena-teams-cta__copy">
            <h2 id="teams-cta-title">
              Следующие важные переговоры не должны быть первой попыткой
            </h2>
            <p className="arena-teams-cta__description">
              Попробуй стратегию, получи обратную связь и переиграй ситуацию до того,
              как ставки станут реальными.
            </p>
            <Link className="arena-teams-cta__primary" to="/home">
              <span>Начать первый поединок</span>
              <ArrowIcon />
            </Link>
            <p className="arena-teams-cta__meta" aria-label="5 минут, голосом, с персональным разбором">
              <span>5 минут</span><i /><span>голосом</span><i /><span>с персональным разбором</span>
            </p>
            <Link className="arena-teams-cta__secondary" to="/home#cases">
              <span>Посмотреть кейсы</span>
              <ArrowIcon />
            </Link>
          </div>
        </section>
      </div>
    </section>
  )
}
