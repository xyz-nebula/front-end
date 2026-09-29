import { caseDifficultyLabels, caseDifficultyLevels, type TrainingCase } from '@/types/case'

interface CaseCardProps {
  item: TrainingCase
  onSelect: (item: TrainingCase) => void
}

export function CaseCard({ item, onSelect }: CaseCardProps) {
  const difficultyLevel = caseDifficultyLevels[item.difficulty]

  return (
    <button className="home-case-card" type="button" onClick={() => onSelect(item)} aria-label={`Выбрать кейс «${item.title}»`} data-tour-id="case-card">
      <span className="home-case-card__content">
        <span className="home-case-card__meta"><span className="home-case-card__category">{item.category}</span><span>{item.duration}</span></span>
        <strong>{item.title}</strong>
        <span className="home-case-card__description">{item.synopsis}</span>
        <span className="home-case-card__footer">
          <span className="home-case-card__difficulty">
            <span className="home-case-card__difficulty-bars" aria-hidden="true">
              {[1, 2, 3, 4].map((level) => <i className={level <= difficultyLevel ? 'is-active' : ''} key={level} />)}
            </span>
            {caseDifficultyLabels[item.difficulty]}
          </span>
        </span>
      </span>
    </button>
  )
}
