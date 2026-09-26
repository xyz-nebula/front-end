import { useState } from 'react'

import type { DuelPreparation as DuelPreparationData } from '@/mocks/duelPreparation'
import type { SessionPreparationSnapshot } from '@/types/preparation'

interface DuelPreparationProps {
  data: DuelPreparationData | null
  description: string
  isRealVoice: boolean
  snapshot?: SessionPreparationSnapshot | null
}

export function DuelPreparation({ data, description, isRealVoice, snapshot }: DuelPreparationProps) {
  const [expanded, setExpanded] = useState(false)
  const draft = snapshot?.draft
  const entries = draft ? [
    ['Корневой конфликт', draft.rootConflict], ['Стратегическая цель', draft.strategicGoal], ['Предложения', draft.proposals],
    ['Экономический слой', draft.layers.economic], ['Юридический слой', draft.layers.legal], ['Технический слой', draft.layers.technical], ['Технологический слой', draft.layers.technological], ['Эмоциональный слой', draft.layers.emotional], ['Психологический слой', draft.layers.psychological], ['Эстетический слой', draft.layers.aesthetic], ['Этический слой', draft.layers.ethical],
    ['Сильные стороны', draft.swot.strengths], ['Слабые стороны', draft.swot.weaknesses], ['Возможности', draft.swot.opportunities], ['Угрозы', draft.swot.threats],
    ['Цель на переговоры', draft.negotiationGoal], ['Заявляемая позиция', draft.bargaining.declared], ['Желаемая позиция', draft.bargaining.desired], ['Красная черта', draft.bargaining.redLine], ['BATNA', draft.batna], ['Сценарий', draft.scenario], ['Загрузка', draft.opening],
  ].filter((entry) => entry[1].trim().length > 0) : []
  const goal = data?.goal ?? description

  return (
    <aside className={`duel-preparation ${expanded ? 'is-expanded' : ''}`} aria-labelledby="duel-preparation-title">
      <h2 id="duel-preparation-title" className="duel-preparation__heading"><button type="button" aria-expanded={expanded} aria-controls="duel-preparation-content" onClick={() => setExpanded((value) => !value)}>
        <span aria-hidden="true">▣</span><span>Моя подготовка</span><span className="duel-preparation__chevron" aria-hidden="true">⌄</span>
      </button></h2>
      <div className="duel-preparation__content" id="duel-preparation-content">
        {snapshot ? entries.length > 0 ? entries.map(([label, value], index) => <section className="duel-preparation__item" key={label}><span aria-hidden="true">{index === 0 ? '◎' : '▣'}</span><div><h3>{label}</h3><p>{value}</p></div></section>) : <p className="duel-preparation__note">Вы начали поединок без заполненной подготовки.</p> : <>
          <section className="duel-preparation__item"><span aria-hidden="true">◎</span><div><h3>Цель</h3><p>{goal}</p></div></section>
        {data && <>
          <section className="duel-preparation__item"><span aria-hidden="true">▥</span><div><h3>Границы торга</h3><p><b>Цель</b> — {data.limits[0]}<br /><b>Компромисс</b> — {data.limits[1]}<br /><b>Предел</b> — {data.limits[2]}</p></div></section>
          <section className="duel-preparation__item"><span aria-hidden="true">▣</span><div><h3>BATNA</h3><p>{data.batna}</p></div></section>
          <section className="duel-preparation__item"><span aria-hidden="true">▤</span><div><h3>Сценарий</h3><ol>{data.steps.map((step) => <li key={step}>{step}</li>)}</ol></div></section>
        </>}
        </>}
        {isRealVoice && !snapshot && <p className="duel-preparation__note">Подготовка показана для демо: AI пока не получает роль и сценарий кейса.</p>}
        <button className="duel-preparation__expand" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Свернуть' : 'Открыть полностью'} <span aria-hidden="true">→</span></button>
      </div>
    </aside>
  )
}
