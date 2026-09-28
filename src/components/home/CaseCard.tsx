import type { TrainingCase } from '@/types/case'

interface CaseCardProps {
  item: TrainingCase
  onSelect: (item: TrainingCase) => void
  tourTarget?: boolean
}

export function CaseCard({ item, onSelect, tourTarget = false }: CaseCardProps) {
  return (
    <button className="home-case-card" type="button" onClick={() => onSelect(item)} aria-label={`Выбрать кейс «${item.title}»`} data-tour-id={tourTarget ? 'case-card' : undefined}>
      <span className="home-case-card__content">
        <span className="home-case-card__meta"><span className="home-case-card__category">{item.category}</span><span>{item.duration}</span></span>
        <strong>{item.title}</strong>
        <span className="home-case-card__description">{item.description}</span>
        <span className="home-case-card__footer">
          <span className="home-case-card__difficulty"><i aria-hidden="true" />{item.difficulty}</span>
        </span>
      </span>
    </button>
  )
}
