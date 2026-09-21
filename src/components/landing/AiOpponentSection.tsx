import aiOpponentImage from '@/assets/ai-opponent/ai-opponent.png'

type PositionIconName = 'target' | 'position' | 'limit' | 'alternative' | 'lock'
type TraitIconName = 'shield' | 'lock' | 'history' | 'exchange'

interface PositionItem {
  icon: PositionIconName
  label: string
  mobileLabel?: string
  value?: string
  desktopOnly?: boolean
}

interface TraitItem {
  icon: TraitIconName
  title: string
  description: string
  mobileDescription: string
}

const userPosition: PositionItem[] = [
  {
    icon: 'target',
    label: 'Цель',
    value: 'Сохранить договорённость о повышении',
  },
  {
    icon: 'position',
    label: 'Желаемая позиция',
    value: '1 неделя проверки',
  },
  {
    icon: 'limit',
    label: 'Красная черта',
    value: 'Не больше 1 месяца',
  },
  {
    icon: 'alternative',
    label: 'BATNA',
    value: 'Остаться на текущих условиях и рассмотреть альтернативы',
  },
]

const aiPosition: PositionItem[] = [
  { icon: 'lock', label: 'Цель' },
  { icon: 'lock', label: 'Реальные интересы', mobileLabel: 'Интересы' },
  { icon: 'lock', label: 'Желаемый результат', desktopOnly: true },
  { icon: 'lock', label: 'Красная черта' },
  { icon: 'lock', label: 'BATNA' },
  { icon: 'lock', label: 'Скрытая информация' },
]

const traits: TraitItem[] = [
  {
    icon: 'shield',
    title: 'Отстаивает интересы',
    description: 'Не соглашается только из-за убедительной формулировки.',
    mobileDescription: 'Не идёт на необоснованные уступки',
  },
  {
    icon: 'lock',
    title: 'Соблюдает границы',
    description: 'Не переступает собственную красную черту.',
    mobileDescription: 'Чётко держит ограничения',
  },
  {
    icon: 'history',
    title: 'Помнит уступки',
    description: 'Учитывает уже достигнутые договорённости.',
    mobileDescription: 'Учитывает предыдущие предложения',
  },
  {
    icon: 'exchange',
    title: 'Ищет обмен',
    description: 'Может уступить в одном вопросе ради выгоды в другом.',
    mobileDescription: 'Предлагает взаимовыгодные варианты',
  },
]

function PositionIcon({ name }: { name: PositionIconName }) {
  if (name === 'target') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="15" cy="17" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="15" cy="17" r="4" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="m15 17 9-9m-4 0h4v4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (name === 'position') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="5" y="20" width="5" height="8" rx="1.5" />
        <rect x="14" y="13" width="5" height="15" rx="1.5" />
        <rect x="23" y="5" width="5" height="23" rx="1.5" />
      </svg>
    )
  }

  if (name === 'limit') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="m8 24 16-16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  if (name === 'alternative') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 7h18v17H13l-6 5V7Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M11 12h11M11 17h8M11 22h5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="13" width="18" height="15" rx="3" />
      <path d="M11 13V9a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="20" r="2" fill="#fff" />
    </svg>
  )
}

function TraitIcon({ name }: { name: TraitIconName }) {
  if (name === 'shield') {
    return (
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <path d="M18 3.5 31 8v10.2c0 7-5.2 11.8-13 14.3C10.2 30 5 25.2 5 18.2V8l13-4.5Z" />
        <path d="M18 10v15" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    )
  }

  if (name === 'lock') {
    return (
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <rect x="6" y="15" width="24" height="18" rx="4" />
        <path d="M11.5 15V10a6.5 6.5 0 0 1 13 0v5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M18 21v5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    )
  }

  if (name === 'history') {
    return (
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <path d="M7.5 12A13 13 0 1 1 5 22" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M7.5 5.5V12H14M18 10v9h7" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <path d="M6 12h22m0 0-6-6m6 6-6 6M30 24H8m0 0 6-6m-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AvatarIcon({ side }: { side: 'user' | 'ai' }) {
  const isUser = side === 'user'

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill={isUser ? '#e8f2ff' : '#ffebee'} />
      <path d="M12 44c1-9 5-13 12-13s11 4 12 13" fill={isUser ? '#0875ff' : '#ef2635'} />
      <circle cx="24" cy="20" r="9" fill="#ffd0b3" />
      <path d={isUser ? 'M15 20c0-8 4-12 10-12 7 0 10 5 9 12-3-1-6-4-8-8-2 5-6 7-11 8Z' : 'M14 21c-1-8 3-13 10-13 8 0 12 6 10 15l-4-2c0-4-2-7-6-9-2 5-6 8-10 9Z'} fill={isUser ? '#5c3428' : '#a9512f'} />
      {isUser ? <path d="M17 27c3 5 11 5 14 0-1 6-4 8-7 8s-6-2-7-8Z" fill="#5c3428" /> : null}
    </svg>
  )
}

function PositionCard({
  kind,
  title,
  items,
}: {
  kind: 'user' | 'ai'
  title: string
  items: PositionItem[]
}) {
  const isAi = kind === 'ai'

  return (
    <article className={`arena-opponent-position arena-opponent-position--${kind}`}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li className={item.desktopOnly ? 'arena-opponent-position__desktop-only' : undefined} key={item.label}>
            <span className="arena-opponent-position__icon">
              <PositionIcon name={item.icon} />
            </span>
            <span className="arena-opponent-position__content">
              <strong>
                <span className={item.mobileLabel ? 'arena-opponent-position__label--desktop' : undefined}>{item.label}</span>
                {item.mobileLabel ? <span className="arena-opponent-position__label--mobile">{item.mobileLabel}</span> : null}
              </strong>
              {item.value ? <span>{item.value}</span> : null}
              {isAi ? (
                <span className="arena-opponent-position__concealed" aria-label="Скрыто">
                  <i aria-hidden="true">•••••</i>
                  <span>Скрыто</span>
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {isAi ? <p>Эти данные известны оппоненту, но скрыты от игрока.</p> : null}
    </article>
  )
}

function MobileDialogue() {
  return (
    <div className="arena-opponent__dialogue" aria-label="Пример встречного предложения">
      <div className="arena-opponent__reply arena-opponent__reply--user">
        <span className="arena-opponent__avatar"><AvatarIcon side="user" /></span>
        <p>Давайте ограничимся одной неделей проверки.</p>
      </div>
      <div className="arena-opponent__reply arena-opponent__reply--ai">
        <p>Неделя слишком короткая. Готова обсуждать две недели при выполнении KPI.</p>
        <span className="arena-opponent__avatar"><AvatarIcon side="ai" /></span>
      </div>
      <div className="arena-opponent__outcome">
        <span aria-hidden="true"><i /><i /><i /></span>
        <p>Встречная позиция</p>
      </div>
    </div>
  )
}

function RobotIcon() {
  return (
    <svg viewBox="0 0 54 54" aria-hidden="true">
      <path d="M27 7v6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="27" cy="6" r="3" />
      <rect x="8" y="13" width="38" height="31" rx="10" fill="currentColor" opacity=".16" />
      <rect x="12" y="16" width="30" height="24" rx="8" fill="#fff" stroke="currentColor" strokeWidth="2" />
      <circle cx="21" cy="27" r="3.5" />
      <circle cx="33" cy="27" r="3.5" />
      <path d="M21 34h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function AiOpponentSection() {
  return (
    <section className="arena-opponent" id="ai-opponent" aria-labelledby="ai-opponent-title">
      <div className="arena-shell arena-opponent__layout">
        <header className="arena-opponent__header">
          <p className="arena-opponent__eyebrow">AI-оппонент</p>
          <h2 id="ai-opponent-title">Он не обязан с тобой соглашаться</h2>
          <p>
            AI-оппонент получает собственные цели, интересы и ограничения. Он торгуется, делает уступки
            только в допустимых пределах и может отказаться от невыгодного соглашения.
          </p>
        </header>

        <div className="arena-opponent__stage">
          <PositionCard kind="user" title="Ваша позиция" items={userPosition} />

          <figure className="arena-opponent__scene">
            <img
              src={aiOpponentImage}
              alt="Пользователь и AI-оппонент обсуждают условия за столом переговоров"
            />
          </figure>

          <div className="arena-opponent__versus" aria-hidden="true"><span>VS</span></div>

          <PositionCard kind="ai" title="Позиция AI-оппонента" items={aiPosition} />
        </div>

        <MobileDialogue />

        <ul className="arena-opponent__traits" aria-label="Принципы поведения AI-оппонента">
          {traits.map((trait) => (
            <li key={trait.title}>
              <span className="arena-opponent__trait-icon"><TraitIcon name={trait.icon} /></span>
              <div>
                <h3>{trait.title}</h3>
                <p className="arena-opponent__trait-description--desktop">{trait.description}</p>
                <p className="arena-opponent__trait-description--mobile">{trait.mobileDescription}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="arena-opponent__summary">
          <span><RobotIcon /></span>
          <p>Оппонент принимает решения на основе своей позиции, а не просто продолжает диалог.</p>
        </div>

        <p className="arena-opponent__next-step">
          <span className="arena-opponent__next-step-desktop">Чтобы вести такие переговоры осознанно, сначала нужно подготовить собственную позицию.</span>
          <span className="arena-opponent__next-step-mobile">Следующий шаг — подготовить собственную стратегию.</span>
        </p>
      </div>
    </section>
  )
}
