import { useId, type ReactNode } from 'react'

import { HelpTooltip } from '@/components/preparation/HelpTooltip'
import { bargainingFields, layerFields, swotFields, type PreparationSectionId } from '@/features/preparation/metadata'
import { PREPARATION_STEP_IDS, type PreparationStepId } from '@/features/preparation/preparation'
import type { UpdatePreparationDraft } from '@/features/preparation/usePreparationDraft'
import type { PreparationDraft } from '@/types/preparation'

interface PreparationFieldProps { label: string; help: string; placeholder: string; value: string; onChange: (value: string) => void; hideLabel?: boolean }

function PreparationField({ label, help, placeholder, value, onChange, hideLabel = false }: PreparationFieldProps) {
  const textareaId = useId()
  return <div className={`preparation-field ${hideLabel ? 'preparation-field--single' : ''}`}>
    {!hideLabel && <span className="preparation-field__heading"><label className="preparation-field__title" htmlFor={textareaId}>{label}</label><HelpTooltip label={label} text={help} /></span>}
    <textarea id={textareaId} aria-label={label} maxLength={2000} rows={4} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    <small>{value.length}/2000</small>
  </div>
}

function PreparationSection({ id, title, help, singleField = false, children }: { id: PreparationStepId; title: string; help: string; singleField?: boolean; children: ReactNode }) {
  return <section className="preparation-card" id={`preparation-${id}`} aria-labelledby={`preparation-${id}-title`}><header><div><span>Шаг {PREPARATION_STEP_IDS.indexOf(id) + 1}</span><span className="preparation-card__heading"><h2 id={`preparation-${id}-title`}>{title}</h2><HelpTooltip label={title} text={help} /></span></div></header>{singleField ? <div className="preparation-card__fields preparation-card__fields--single">{children}</div> : <div className="preparation-card__fields">{children}</div>}</section>
}

export function PreparationForm({ activeSectionId, draft, updateDraft }: { activeSectionId: PreparationSectionId; draft: PreparationDraft; updateDraft: UpdatePreparationDraft }) {
  return <>
    {activeSectionId === 'analysis' && <>
      <PreparationSection id="root-conflict" title="Корневой конфликт" help="Проблема, затрагивающая интересы всех сторон кейса. Её решение должно снимать остальные побочные конфликты." singleField><PreparationField hideLabel label="Корневой конфликт" help="Проблема, затрагивающая интересы всех сторон кейса." placeholder="Опишите главное противоречие между сторонами…" value={draft.rootConflict} onChange={(value) => updateDraft((current) => ({ ...current, rootConflict: value }))} /></PreparationSection>
      <PreparationSection id="strategic-goal" title="Стратегическая цель ситуации" help="Более широкий желаемый результат, который разрешает корневой конфликт и учитывает интересы всех сторон." singleField><PreparationField hideLabel label="Стратегическая цель ситуации" help="Желаемый результат для всех участников ситуации." placeholder="Как должна измениться ситуация в результате…" value={draft.strategicGoal} onChange={(value) => updateDraft((current) => ({ ...current, strategicGoal: value }))} /></PreparationSection>
      <PreparationSection id="proposals" title="Предложения, решающие конфликт" help="Варианты решений, которые снимают корневое противоречие и учитывают интересы участников." singleField><PreparationField hideLabel label="Предложения, решающие конфликт" help="Варианты решений корневого конфликта." placeholder="Перечислите возможные решения, каждое с новой строки…" value={draft.proposals} onChange={(value) => updateDraft((current) => ({ ...current, proposals: value }))} /></PreparationSection>
      <PreparationSection id="layers" title="Анализ по слоям" help="Способ разложить ситуацию на отдельные аспекты и понять, что влияет на позиции и поведение участников."><div className="preparation-grid">{layerFields.map(([key, label, help]) => <PreparationField key={key} label={label} help={help} placeholder="Что важно учесть в этом слое…" value={draft.layers[key]} onChange={(value) => updateDraft((current) => ({ ...current, layers: { ...current.layers, [key]: value } }))} />)}</div></PreparationSection>
    </>}
    {activeSectionId === 'strategy' && <>
      <PreparationSection id="swot" title="SWOT-анализ" help="Оценка своей позиции через преимущества, уязвимости, доступные внешние возможности и возможные риски."><div className="preparation-grid">{swotFields.map(([key, label, help]) => <PreparationField key={key} label={label} help={help} placeholder={`Опишите ${label.toLocaleLowerCase('ru-RU')}…`} value={draft.swot[key]} onChange={(value) => updateDraft((current) => ({ ...current, swot: { ...current.swot, [key]: value } }))} />)}</div></PreparationSection>
      <PreparationSection id="negotiation-goal" title="Цель на переговоры" help="Конкретный и проверяемый результат именно этого разговора, связанный с вашими интересами." singleField><PreparationField hideLabel label="Цель на переговоры" help="Конкретный результат этого разговора." placeholder="О чём вы хотите договориться…" value={draft.negotiationGoal} onChange={(value) => updateDraft((current) => ({ ...current, negotiationGoal: value }))} /></PreparationSection>
      <PreparationSection id="bargaining" title="Грани торга" help="Заранее определённый диапазон условий, в котором вы готовы договариваться."><div className="preparation-grid">{bargainingFields.map(([key, label, help]) => <PreparationField key={key} label={label} help={help} placeholder={`Сформулируйте: ${label.toLocaleLowerCase('ru-RU')}…`} value={draft.bargaining[key]} onChange={(value) => updateDraft((current) => ({ ...current, bargaining: { ...current.bargaining, [key]: value } }))} />)}</div></PreparationSection>
      <PreparationSection id="batna" title="BATNA" help="Лучший реалистичный вариант действий на случай, если договориться с текущим оппонентом не получится." singleField><PreparationField hideLabel label="BATNA" help="Лучший вариант действий без соглашения." placeholder="Опишите реалистичную альтернативу соглашению…" value={draft.batna} onChange={(value) => updateDraft((current) => ({ ...current, batna: value }))} /></PreparationSection>
    </>}
    {activeSectionId === 'tactics' && <>
      <PreparationSection id="scenario" title="Сценарий" help="Заранее продуманный маршрут переговоров от текущей ситуации к вашей цели, который оставляет возможность адаптироваться." singleField><PreparationField hideLabel label="Сценарий" help="Маршрут переговоров к вашей цели." placeholder="Опишите последовательность шагов переговоров…" value={draft.scenario} onChange={(value) => updateDraft((current) => ({ ...current, scenario: value }))} /></PreparationSection>
      <PreparationSection id="opening" title="Загрузка" help="Короткая первая реплика, которая задаёт контекст, запускает сценарий и вовлекает оппонента в диалог." singleField><PreparationField hideLabel label="Загрузка" help="Подготовленное начало переговоров." placeholder="Сформулируйте первую реплику до 30 секунд…" value={draft.opening} onChange={(value) => updateDraft((current) => ({ ...current, opening: value }))} /></PreparationSection>
    </>}
  </>
}
