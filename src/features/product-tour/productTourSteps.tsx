import type { ProductTourStepId } from '@/features/product-tour/productTourStorage'

export type ProductTourPlacement = 'top' | 'right' | 'bottom'

export const PRODUCT_TOUR_STEP_ORDER: readonly ProductTourStepId[] = [
  'case', 'role', 'voice-format', 'analysis', 'strategy', 'tactics',
  'start-duel', 'microphone', 'dialogue', 'finish', 'confirm-finish', 'result',
]

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
  { id: 'case', title: 'Начни с кейса', content: 'Кейс задаёт ситуацию, роли и цель тренировки. Для тура мы подсветили первый вариант, но ты можешь выбрать любой кейс.', target: '[data-tour-id="case-card"]', placement: 'right', back: false, next: false },
  { id: 'role', title: 'Выбери свою роль', content: 'Прочитай условие и выбери, с чьей позиции будешь вести переговоры. Вторую роль возьмёт AI-оппонент.', target: '[data-tour-id="role-selector"]', placement: 'right', back: false, next: false },
  { id: 'voice-format', title: 'Подготовься к голосовому разговору', content: 'Тур проходит голосом — так ты потренируешь живой диалог. Нажми «Начать подготовку»: перед поединком ты сможешь продумать свою позицию.', target: '[data-tour-id="voice-preparation"]', placement: 'top', back: false, next: false },
  { id: 'analysis', title: 'Разбери ситуацию', content: 'Здесь можно сформулировать главный конфликт, общую цель и возможные решения. Все поля необязательны: заполни полезные для себя или сразу двигайся дальше.', target: '[data-tour-id="preparation-analysis"]', placement: 'right', back: false, next: true },
  { id: 'strategy', title: 'Собери стратегию', content: 'Здесь находятся сильные и слабые стороны, цель разговора, границы торга и запасной план. Заполнение остаётся добровольным.', target: '[data-tour-id="preparation-strategy"]', placement: 'right', back: true, next: true },
  { id: 'tactics', title: 'Продумай тактику', content: 'Наметь ход разговора и первую реплику. Можно оставить поля пустыми — подготовка нужна тебе как опора, а не как обязательная анкета.', target: '[data-tour-id="preparation-tactics"]', placement: 'right', back: true, next: true },
  { id: 'start-duel', title: 'Выходи на поединок', content: 'Когда будешь готов, начни тренировку. Твоя роль и заполненная подготовка сохранятся и будут доступны во время разговора.', target: '[data-tour-id="start-duel"]', placement: 'bottom', back: true, next: false },
  { id: 'microphone', title: 'Включи микрофон', content: 'Нажми на микрофон и разреши доступ, если браузер спросит. Когда появится статус «Говорите», можно начинать переговоры.', target: '[data-tour-id="microphone"]', placement: 'top', back: false, next: false },
  { id: 'dialogue', title: 'Начни разговор', content: 'Скажи первую реплику и дождись ответа AI-оппонента. Сохранённые реплики появятся в диалоге автоматически.', target: '[data-tour-id="dialogue"]', placement: 'right', back: false, next: false },
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
