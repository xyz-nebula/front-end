import type { PreparationStepId } from '@/features/preparation/preparation'

export type PreparationSectionId = 'analysis' | 'strategy' | 'tactics'

export interface PreparationStepInfo { id: PreparationStepId; label: string; section: PreparationSectionId }
export interface PreparationSectionInfo { id: PreparationSectionId; label: string; steps: PreparationStepId[] }

export const preparationSteps: PreparationStepInfo[] = [
  { id: 'root-conflict', label: 'Корневой конфликт', section: 'analysis' },
  { id: 'strategic-goal', label: 'Стратегическая цель', section: 'analysis' },
  { id: 'proposals', label: 'Предложения', section: 'analysis' },
  { id: 'layers', label: 'Анализ по слоям', section: 'analysis' },
  { id: 'swot', label: 'SWOT-анализ', section: 'strategy' },
  { id: 'negotiation-goal', label: 'Цель на переговоры', section: 'strategy' },
  { id: 'bargaining', label: 'Грани торга', section: 'strategy' },
  { id: 'batna', label: 'BATNA', section: 'strategy' },
  { id: 'scenario', label: 'Сценарий', section: 'tactics' },
  { id: 'opening', label: 'Загрузка', section: 'tactics' },
]

export const preparationSections: PreparationSectionInfo[] = [
  { id: 'analysis', label: 'Анализ ситуации', steps: ['root-conflict', 'strategic-goal', 'proposals', 'layers'] },
  { id: 'strategy', label: 'Стратегия', steps: ['swot', 'negotiation-goal', 'bargaining', 'batna'] },
  { id: 'tactics', label: 'Тактика', steps: ['scenario', 'opening'] },
]

export const layerFields = [
  ['economic', 'Экономический слой', 'Материальная выгода и ресурсы сторон.'],
  ['legal', 'Юридический слой', 'Законы, договоры, полномочия и правила.'],
  ['technical', 'Технический слой', 'Объективные факты: кто, что, где и когда.'],
  ['technological', 'Технологический слой', 'Как устроен процесс и что должно произойти дальше.'],
  ['emotional', 'Эмоциональный слой', 'Что участники чувствуют прямо сейчас.'],
  ['psychological', 'Психологический слой', 'Мотивы, ожидания, страхи и потребности.'],
  ['aesthetic', 'Эстетический слой', 'Насколько решение выглядит достойно или неловко.'],
  ['ethical', 'Этический слой', 'Представления о справедливости и порядочности.'],
] as const

export const swotFields = [
  ['strengths', 'Сильные стороны', 'Что усиливает вашу переговорную позицию.'],
  ['weaknesses', 'Слабые стороны', 'Что делает позицию уязвимой.'],
  ['opportunities', 'Возможности', 'Внешние обстоятельства, которые можно использовать.'],
  ['threats', 'Угрозы', 'Риски, способные ухудшить позицию или сорвать договорённость.'],
] as const

export const bargainingFields = [
  ['declared', 'Заявляемая позиция', 'Стартовые условия, оставляющие пространство для уступок.'],
  ['desired', 'Желаемая позиция', 'Конкретный результат, который полностью вас устраивает.'],
  ['redLine', 'Красная черта', 'Минимально приемлемый результат, хуже которого соглашаться невыгодно.'],
] as const

export function parsePreparationSection(value: string | null): PreparationSectionId {
  return value === 'strategy' || value === 'tactics' ? value : 'analysis'
}
