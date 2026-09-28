import { useEffect, useMemo } from 'react'
import { EVENTS, Joyride, type EventData } from 'react-joyride'

import { ProductTourErrorDialog } from '@/components/product-tour/ProductTourErrorDialog'
import { ProductTourTooltip } from '@/components/product-tour/ProductTourTooltip'
import { PRODUCT_TOUR_STEP_ORDER, getProductTourSteps } from '@/features/product-tour/productTourSteps'
import { useProductTour } from '@/features/product-tour/useProductTour'

export function ProductTourLayer() {
  const productTour = useProductTour()
  const active = productTour.state?.status === 'active'
  const stepId = productTour.state?.stepId
  const stepIndex = stepId ? PRODUCT_TOUR_STEP_ORDER.indexOf(stepId) : 0
  const steps = useMemo(() => getProductTourSteps(Boolean(productTour.resultReady)), [productTour.resultReady])
  const target = active ? steps[stepIndex]?.target : null
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!active || typeof target !== 'string') return
    let highlighted: Element | null = null
    const updateHighlight = () => {
      const next = document.querySelector(target)
      if (highlighted === next) return
      highlighted?.classList.remove('product-tour-target')
      next?.classList.add('product-tour-target')
      highlighted = next
    }
    updateHighlight()
    const observer = new MutationObserver(updateHighlight)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); highlighted?.classList.remove('product-tour-target') }
  }, [active, target])

  useEffect(() => {
    if (!active) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      event.stopImmediatePropagation()
      productTour.send({ type: 'pause' })
    }
    document.addEventListener('keydown', closeOnEscape, true)
    return () => document.removeEventListener('keydown', closeOnEscape, true)
  }, [active, productTour])

  if (productTour.error) {
    return <ProductTourErrorDialog kind={productTour.error} onClose={productTour.dismissError} onRestart={productTour.restart} />
  }

  return <Joyride
    run={active}
    stepIndex={stepIndex}
    steps={steps}
    scrollToFirstStep
    tooltipComponent={ProductTourTooltip}
    onEvent={(event: EventData) => {
      if (event.type === EVENTS.TARGET_NOT_FOUND) productTour.reportTargetUnavailable()
    }}
    locale={{ back: 'Назад', close: 'Закрыть тур', last: 'Готово', next: 'Далее', nextWithProgress: 'Далее ({current} из {total})', open: 'Открыть подсказку тура', skip: 'Пропустить' }}
    options={{ blockTargetInteraction: false, buttons: ['close'], disableFocusTrap: true, dismissKeyAction: false, hideOverlay: true, scrollDuration: reducedMotion ? 0 : 300, scrollOffset: 24, skipBeacon: true, spotlightPadding: 6, targetWaitTimeout: 10_000, width: 392, zIndex: 1400 }}
    floatingOptions={{ flipOptions: { padding: 16 }, shiftOptions: { padding: 16 } }}
  />
}
