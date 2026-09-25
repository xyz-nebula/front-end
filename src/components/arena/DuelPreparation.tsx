import { useState } from 'react'

import type { DuelPreparation as DuelPreparationData } from '@/mocks/duelPreparation'

interface DuelPreparationProps {
  data: DuelPreparationData | null
  description: string
  isRealVoice: boolean
}

export function DuelPreparation({ data, description, isRealVoice }: DuelPreparationProps) {
  const [expanded, setExpanded] = useState(false)
  const goal = data?.goal ?? description

  return (
    <aside className={`duel-preparation ${expanded ? 'is-expanded' : ''}`} aria-labelledby="duel-preparation-title">
      <h2 id="duel-preparation-title" className="duel-preparation__heading"><button type="button" aria-expanded={expanded} aria-controls="duel-preparation-content" onClick={() => setExpanded((value) => !value)}>
        <span aria-hidden="true">▣</span><span>Моя подготовка</span><span className="duel-preparation__chevron" aria-hidden="true">⌄</span>
      </button></h2>
      <div className="duel-preparation__content" id="duel-preparation-content">
        <section className="duel-preparation__item"><span aria-hidden="true">◎</span><div><h3>Цель</h3><p>{goal}</p></div></section>
        {data && <>
          <section className="duel-preparation__item"><span aria-hidden="true">▥</span><div><h3>Границы торга</h3><p><b>Цель</b> — {data.limits[0]}<br /><b>Компромисс</b> — {data.limits[1]}<br /><b>Предел</b> — {data.limits[2]}</p></div></section>
          <section className="duel-preparation__item"><span aria-hidden="true">▣</span><div><h3>BATNA</h3><p>{data.batna}</p></div></section>
          <section className="duel-preparation__item"><span aria-hidden="true">▤</span><div><h3>Сценарий</h3><ol>{data.steps.map((step) => <li key={step}>{step}</li>)}</ol></div></section>
        </>}
        {isRealVoice && <p className="duel-preparation__note">Подготовка показана для демо: AI пока не получает роль и сценарий кейса.</p>}
        <button className="duel-preparation__expand" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Свернуть' : 'Открыть полностью'} <span aria-hidden="true">→</span></button>
      </div>
    </aside>
  )
}
