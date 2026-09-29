import { useState } from 'react'

import { PRODUCT_TOUR_STEP_ORDER, getProductTourStepDefinition, type ProductTourStepDefinition } from '@/features/product-tour/productTourSteps'
import { useProductTour } from '@/features/product-tour/useProductTour'

interface ProductTourTooltipProps {
  onCollapse: () => void
  step: ProductTourStepDefinition
}

export function ProductTourTooltip({ onCollapse, step }: ProductTourTooltipProps) {
  const productTour = useProductTour()
  const [menuOpen, setMenuOpen] = useState(false)
  const state = productTour.state
  if (!state || state.status !== 'active') return null

  const definition = getProductTourStepDefinition(state.stepId)
  const currentIndex = PRODUCT_TOUR_STEP_ORDER.indexOf(state.stepId)
  const waitingForResult = state.stepId === 'result' && !productTour.resultReady
  const scenarioError = productTour.scenarioError
  const errorCopy = scenarioError === 'microphone'
    ? { title: 'Не удалось включить микрофон', content: 'Разреши доступ к микрофону в настройках браузера, затем попробуй ещё раз.' }
    : scenarioError === 'audio'
      ? { title: 'Не удалось подключить голосовой разговор', content: 'Проверь соединение и нажми «Попробовать снова». Тур продолжится с этого шага.' }
      : scenarioError === 'result'
        ? { title: 'Разбор пока не готов', content: 'Нажми «Проверить ещё раз» на странице. Финальный шаг откроется после успешной загрузки.' }
        : null
  const titleId = `product-tour-title-${state.stepId}`
  const contentId = `product-tour-content-${state.stepId}`

  return (
    <section className="product-tour-tooltip" data-product-tour-tooltip="" role="dialog" aria-live="polite" aria-modal="false" aria-labelledby={titleId} aria-describedby={contentId}>
      <div className="product-tour-tooltip__heading">
        <div><span className="product-tour-tooltip__eyebrow">Тур по продукту</span><h2 id={titleId}>{errorCopy?.title ?? step.title}</h2></div>
        <div className="product-tour-tooltip__controls">
          <button className="product-tour-tooltip__menu-toggle" type="button" aria-label="Меню тура" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>•••</button>
          <button className="product-tour-tooltip__close" type="button" aria-label="Свернуть подсказку" onClick={onCollapse}>−</button>
          {menuOpen && <div className="product-tour-tooltip__menu"><button type="button" onClick={() => productTour.send({ type: 'pause' })}>Приостановить тур</button><small>Продолжить можно из меню профиля.</small></div>}
        </div>
      </div>
      <p id={contentId} className="product-tour-tooltip__content">{errorCopy?.content ?? step.content}</p>
      <div className="product-tour-tooltip__footer">
        <span className="product-tour-tooltip__progress" role="status" aria-label={`Шаг ${currentIndex + 1} из ${PRODUCT_TOUR_STEP_ORDER.length}`}>{currentIndex + 1} из {PRODUCT_TOUR_STEP_ORDER.length}</span>
        <div className="product-tour-tooltip__actions">
          {scenarioError === 'microphone' || scenarioError === 'audio'
            ? <><button className="is-primary" type="button" onClick={productTour.retryScenario}>Попробовать снова</button><button type="button" onClick={() => productTour.send({ type: 'pause' })}>Закрыть тур</button></>
            : <>
              {!waitingForResult && definition.back && <button type="button" onClick={() => productTour.send({ type: 'back' })}>Назад</button>}
              {!waitingForResult && definition.next && <button className="is-primary" type="button" onClick={() => productTour.send({ type: 'next' })}>Далее</button>}
              {!waitingForResult && definition.complete && <button className="is-primary" type="button" onClick={() => productTour.send({ type: 'complete' })}>Готово</button>}
            </>}
        </div>
      </div>
    </section>
  )
}
