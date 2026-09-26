import type { TrainingCase } from '@/types/case'

interface CaseCardProps {
  item: TrainingCase
  onSelect: (item: TrainingCase) => void
}

export function CaseCard({ item, onSelect }: CaseCardProps) {
  const roleMark = (role: string) => role
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('ru-RU'))
    .join('')

  return (
    <button className="home-case-card" type="button" onClick={() => onSelect(item)} aria-label={`Выбрать кейс «${item.title}»`}>
      <span className="home-case-card__content">
        <span className="home-case-card__meta"><span className="home-case-card__category">{item.category}</span><span>{item.duration}</span></span>
        <strong>{item.title}</strong>
        <span className="home-case-card__description">{item.description}</span>
        <span className="home-case-card__footer">
          <span className="home-case-card__roles" aria-label={`Роли: ${item.roles[0]} и ${item.roles[1]}`}>
            {item.roles.map((role, index) => <span className="home-case-card__role" key={`${role}-${index}`} title={role}>
              <span aria-hidden="true">{roleMark(role)}</span><small>{role}</small>
            </span>)}
            <span className="home-case-card__role-arrow" aria-hidden="true">↔</span>
          </span>
          <span className="home-case-card__difficulty"><i aria-hidden="true" />{item.difficulty}</span>
        </span>
      </span>
      <span className="home-case-card__arrow" aria-hidden="true">›</span>
    </button>
  )
}
