import type { TooltipRenderProps } from 'react-joyride'

import { PRODUCT_TOUR_CHECKLIST, PRODUCT_TOUR_STEP_ORDER, getProductTourStepDefinition } from '@/features/product-tour/productTourSteps'
import { useProductTour } from '@/features/product-tour/useProductTour'

export function ProductTourTooltip({ step, tooltipProps }: TooltipRenderProps) {
  const productTour = useProductTour()
  const state = productTour.state
  if (!state || state.status !== 'active') return null

  const definition = getProductTourStepDefinition(state.stepId)
  const currentIndex = PRODUCT_TOUR_STEP_ORDER.indexOf(state.stepId)
  const waitingForResult = state.stepId === 'result' && !productTour.resultReady
  const titleId = `product-tour-title-${state.stepId}`
  const contentId = `product-tour-content-${state.stepId}`

  return (
    <section {...tooltipProps} className="product-tour-tooltip" data-product-tour-tooltip="" role="dialog" aria-live="polite" aria-modal="false" aria-labelledby={titleId} aria-describedby={contentId}>
      <div className="product-tour-tooltip__heading">
        <div><span className="product-tour-tooltip__eyebrow">Тур по продукту</span><h2 id={titleId}>{step.title}</h2></div>
        <button className="product-tour-tooltip__close" type="button" aria-label="Закрыть тур" onClick={() => productTour.send({ type: 'pause' })}>×</button>
      </div>
      <p id={contentId} className="product-tour-tooltip__content">{step.content}</p>
      <ol className="product-tour-tooltip__checklist" aria-label="Шаги тура">
        {PRODUCT_TOUR_CHECKLIST.map((label, index) => {
          const stateName = index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming'
          return <li className={`is-${stateName}`} key={label} aria-current={stateName === 'current' ? 'step' : undefined}><span aria-hidden="true">{stateName === 'complete' ? '✓' : index + 1}</span><span>{label}</span></li>
        })}
      </ol>
      <div className="product-tour-tooltip__footer">
        <span className="product-tour-tooltip__progress" role="status" aria-label={`Шаг ${currentIndex + 1} из ${PRODUCT_TOUR_CHECKLIST.length}`}>{currentIndex + 1} из {PRODUCT_TOUR_CHECKLIST.length}</span>
        <div className="product-tour-tooltip__actions">
          {!waitingForResult && definition.back && <button type="button" onClick={() => productTour.send({ type: 'back' })}>Назад</button>}
          {!waitingForResult && definition.next && <button className="is-primary" type="button" onClick={() => productTour.send({ type: 'next' })}>Далее</button>}
          {!waitingForResult && definition.complete && <button className="is-primary" type="button" onClick={() => productTour.send({ type: 'complete' })}>Готово</button>}
        </div>
      </div>
    </section>
  )
}
