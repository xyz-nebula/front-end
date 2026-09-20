import { CaseIcon } from '@/components/home/CaseIcon'
import { ArrowIcon } from '@/components/ui/ArrowIcon'
import type { TrainingCase } from '@/types/case'

interface CaseCardProps {
  item: TrainingCase
  onSelect: (item: TrainingCase) => void
}

export function CaseCard({ item, onSelect }: CaseCardProps) {
  return (
    <article className={`case-card case-card--${item.accent}`}>
      <div className="case-card__head">
        <span className="case-card__icon"><CaseIcon name={item.icon} /></span>
        <span className="case-card__difficulty">{item.difficulty}</span>
      </div>
      <div className="case-card__content">
        <span className="case-card__category">{item.category}</span>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
      <div className="case-card__footer">
        <span>{item.duration}</span>
        <button type="button" onClick={() => onSelect(item)} aria-label={`Выбрать кейс «${item.title}»`}><ArrowIcon direction="up-right" /></button>
      </div>
    </article>
  )
}
