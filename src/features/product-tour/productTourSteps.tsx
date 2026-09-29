import type { ProductTourStepId } from '@/features/product-tour/productTourStorage'

export type ProductTourPlacement = 'top' | 'right' | 'bottom'

export const PRODUCT_TOUR_STEP_ORDER: readonly ProductTourStepId[] = [
  'case', 'role', 'voice-format', 'analysis', 'strategy', 'tactics',
  'start-duel', 'microphone', 'dialogue', 'finish', 'confirm-finish', 'result',
]

export const PRODUCT_TOUR_STAGE_PROGRESS: Record<ProductTourStepId, { label: string; stage: number; local: string }> = {
  case: { label: 'Кейс', stage: 1, local: '1 из 2' },
  role: { label: 'Кейс', stage: 1, local: '2 из 2' },
  'voice-format': { label: 'Подготовка', stage: 2, local: 'старт' },
  analysis: { label: 'Подготовка', stage: 2, local: '1 из 3' },
  strategy: { label: 'Подготовка', stage: 2, local: '2 из 3' },
  tactics: { label: 'Подготовка', stage: 2, local: '3 из 3' },
  'start-duel': { label: 'Подготовка', stage: 2, local: 'готово' },
  microphone: { label: 'Переговоры', stage: 3, local: '1 из 4' },
  dialogue: { label: 'Переговоры', stage: 3, local: '2 из 4' },
  finish: { label: 'Переговоры', stage: 3, local: '3 из 4' },
  'confirm-finish': { label: 'Переговоры', stage: 3, local: '4 из 4' },
  result: { label: 'Разбор', stage: 4, local: 'финал' },
}

export interface ProductTourStepDefinition {
  id: ProductTourStepId
  title: string
  content: string
  target: string
  placement: ProductTourPlacement
  back: boolean
  next: boolean
  complete?: boolean
}

const definitions: readonly ProductTourStepDefinition[] = [
  { id: 'case', title: 'Выбери кейс', content: 'Выбери любую знакомую или интересную ситуацию. Кейс задаст роли и цель тренировки.', target: '[data-tour-id="case-card"]', placement: 'right', back: false, next: false },
  { id: 'role', title: 'Выбери свою роль', content: 'Прочитай условие и выбери, с чьей позиции будешь вести переговоры. Вторую роль возьмёт AI-оппонент.', target: '[data-tour-id="role-selector"]', placement: 'right', back: false, next: false },
  { id: 'voice-format', title: 'Перейди к подготовке', content: 'Тренировка пройдёт голосом. Нажми «Начать подготовку», чтобы продумать свою позицию перед разговором.', target: '[data-tour-id="voice-preparation"]', placement: 'top', back: false, next: false },
  { id: 'analysis', title: 'Разбери ситуацию', content: 'Сформулируй конфликт, общую цель и возможные решения. Поля необязательны — заполни полезные или нажми «Далее».', target: '[data-tour-id="preparation-next"]', placement: 'top', back: false, next: false },
  { id: 'strategy', title: 'Собери стратегию', content: 'Определи цель разговора, границы торга и запасной план. Когда будешь готов, нажми «Далее».', target: '[data-tour-id="preparation-next"]', placement: 'top', back: false, next: false },
  { id: 'tactics', title: 'Продумай тактику', content: 'Наметь ход разговора и первую реплику. Подготовка останется доступна во время переговоров.', target: '[data-tour-id="preparation-next"]', placement: 'top', back: false, next: false },
  { id: 'start-duel', title: 'Выходи на поединок', content: 'Когда будешь готов, нажми «Начать поединок». Это единственное действие, которое запускает голосовую тренировку.', target: '[data-tour-id="start-duel"]', placement: 'bottom', back: false, next: false },
  { id: 'microphone', title: 'Включи микрофон', content: 'Нажми на микрофон. Если браузеру понадобится разрешение, подтверди доступ.', target: '[data-tour-id="microphone"]', placement: 'top', back: false, next: false },
  { id: 'dialogue', title: 'Начни разговор', content: 'Скажи первую реплику и дождись ответа AI-оппонента. Реплики появятся в диалоге автоматически.', target: '[data-tour-id="dialogue"]', placement: 'right', back: false, next: false },
  { id: 'finish', title: 'Ты управляешь длительностью', content: 'Продолжай разговор столько, сколько нужно. Когда будешь готов перейти к результатам, нажми «Завершить переговоры».', target: '[data-tour-id="finish"]', placement: 'bottom', back: false, next: false },
  { id: 'confirm-finish', title: 'Подтверди завершение', content: 'После подтверждения новые реплики добавить не получится. Сохранённый разговор отправится в разбор.', target: '[data-tour-id="finish-dialog"]', placement: 'top', back: false, next: false },
  { id: 'result', title: 'Разбор готов', content: 'Здесь собраны итог переговоров, мнения судей, разбор тренера, сравнение плана с реальностью, рекомендации и полный транскрипт. Используй выводы в следующей тренировке.', target: '[data-tour-id="result"]', placement: 'bottom', back: false, next: false, complete: true },
]

export function getProductTourStepDefinition(stepId: ProductTourStepId): ProductTourStepDefinition {
  return definitions[PRODUCT_TOUR_STEP_ORDER.indexOf(stepId)]
}

export function getProductTourSteps(resultReady: boolean): ProductTourStepDefinition[] {
  return definitions.map((definition) => {
    const waitingForResult = definition.id === 'result' && !resultReady
    return {
      ...definition,
      title: waitingForResult ? 'Готовим разбор' : definition.title,
      content: waitingForResult
        ? 'Собираем выводы по твоим репликам. Финальный шаг откроется, когда разбор будет готов.'
        : definition.content,
      target: waitingForResult ? '[data-tour-id="result-status"]' : definition.target,
    }
  })
}
