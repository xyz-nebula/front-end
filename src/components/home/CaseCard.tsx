import { caseArtwork } from '@/mocks/caseArtwork'
import type { TrainingCase } from '@/types/case'

interface CaseCardProps {
  item: TrainingCase
  onSelect: (item: TrainingCase) => void
}

export function CaseCard({ item, onSelect }: CaseCardProps) {
  return (
    <button className={`home-case-card home-case-card--${item.category === 'Конфликты' ? 'red' : item.category === 'Управление' ? 'green' : 'blue'}`} type="button" onClick={() => onSelect(item)} aria-label={`Выбрать кейс «${item.title}»`}>
      <img className="home-case-card__art" src={caseArtwork[item.id]} alt="" />
      <span className="home-case-card__content">
        <span className="home-case-card__category">{item.category}</span>
        <strong>{item.title}</strong>
        <span className="home-case-card__difficulty"><i aria-hidden="true" />{item.difficulty}</span>
        <span className="home-case-card__description">{item.description}</span>
      </span>
      <span className="home-case-card__arrow" aria-hidden="true">›</span>
    </button>
  )
}
