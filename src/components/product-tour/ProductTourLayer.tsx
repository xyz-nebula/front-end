import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EVENTS, Joyride, type EventData, type TooltipRenderProps } from 'react-joyride'

import { ProductTourErrorDialog } from '@/components/product-tour/ProductTourErrorDialog'
import { ProductTourTooltip } from '@/components/product-tour/ProductTourTooltip'
import { PRODUCT_TOUR_STEP_ORDER, getProductTourSteps } from '@/features/product-tour/productTourSteps'
import { useProductTour } from '@/features/product-tour/useProductTour'

function ProductTourBeacon() {
  return <span className="product-tour-beacon" aria-hidden="true"><span>?</span><strong>Подсказка</strong></span>
}

export function ProductTourLayer() {
  const productTour = useProductTour()
  const [collapsed, setCollapsed] = useState(false)
  const focusTooltipAfterRestoreRef = useRef(false)
  const active = productTour.state?.status === 'active'
  const stepId = productTour.state?.stepId
  const stepIndex = stepId ? PRODUCT_TOUR_STEP_ORDER.indexOf(stepId) : 0
  const steps = useMemo(() => getProductTourSteps(Boolean(productTour.resultReady), collapsed), [collapsed, productTour.resultReady])
  const target = active ? steps[stepIndex]?.target : null
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const collapseTooltip = useCallback(() => setCollapsed(true), [])
  const Tooltip = useCallback((props: TooltipRenderProps) => <ProductTourTooltip {...props} onCollapse={collapseTooltip} />, [collapseTooltip])

  const focusBeacon = useCallback(() => {
    window.setTimeout(() => document.querySelector<HTMLElement>('.react-joyride__beacon')?.focus(), 0)
  }, [])

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
    if (!active || collapsed) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setCollapsed(true)
    }
    document.addEventListener('keydown', closeOnEscape, true)
    return () => document.removeEventListener('keydown', closeOnEscape, true)
  }, [active, collapsed])

  useEffect(() => {
    if (active && collapsed) focusBeacon()
  }, [active, collapsed, focusBeacon])

  useEffect(() => {
    if (!active || collapsed || !focusTooltipAfterRestoreRef.current) return
    focusTooltipAfterRestoreRef.current = false
    window.setTimeout(() => document.querySelector<HTMLElement>('.product-tour-tooltip__close')?.focus(), 0)
  }, [active, collapsed])

  if (productTour.error) {
    return <ProductTourErrorDialog kind={productTour.error} onClose={productTour.dismissError} onRestart={productTour.restart} />
  }

  return <Joyride
    key={collapsed ? 'product-tour-collapsed' : 'product-tour-expanded'}
    run={active}
    stepIndex={stepIndex}
    steps={steps}
    scrollToFirstStep
    beaconComponent={ProductTourBeacon}
    tooltipComponent={Tooltip}
    onEvent={(event: EventData) => {
      if (event.type === EVENTS.TARGET_NOT_FOUND) productTour.reportTargetUnavailable()
      if (event.type === EVENTS.BEACON) focusBeacon()
      if (event.type === EVENTS.TOOLTIP && collapsed) {
        focusTooltipAfterRestoreRef.current = true
        setCollapsed(false)
      }
    }}
    locale={{ back: 'Назад', close: 'Свернуть подсказку', last: 'Готово', next: 'Далее', nextWithProgress: 'Далее ({current} из {total})', open: 'Показать подсказку', skip: 'Пропустить' }}
    options={{ blockTargetInteraction: false, buttons: ['close'], disableFocusTrap: true, dismissKeyAction: false, hideOverlay: true, scrollDuration: reducedMotion ? 0 : 300, scrollOffset: 24, spotlightPadding: 6, targetWaitTimeout: 10_000, width: 'min(392px, calc(100vw - 32px))', zIndex: 1400 }}
    floatingOptions={{ flipOptions: { padding: 16 }, shiftOptions: { padding: 16 } }}
  />
}
