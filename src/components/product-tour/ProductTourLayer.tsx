import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { ProductTourErrorDialog } from '@/components/product-tour/ProductTourErrorDialog'
import { ProductTourTooltip } from '@/components/product-tour/ProductTourTooltip'
import { PRODUCT_TOUR_STEP_ORDER, getProductTourSteps, type ProductTourPlacement } from '@/features/product-tour/productTourSteps'
import { useProductTour } from '@/features/product-tour/useProductTour'

const TARGET_WAIT_MS = 10_000
const TOOLTIP_WIDTH = 392
const VIEWPORT_GAP = 16

function positionFor(target: Element, placement: ProductTourPlacement, collapsed: boolean): CSSProperties {
  const rect = target.getBoundingClientRect()
  const width = collapsed ? 132 : Math.min(TOOLTIP_WIDTH, window.innerWidth - VIEWPORT_GAP * 2)
  const height = collapsed ? 40 : 280
  let left = rect.left + rect.width / 2 - width / 2
  let top = rect.bottom + 14

  if (placement === 'top') top = rect.top - height - 14
  if (placement === 'right') {
    left = rect.right + 14
    top = rect.top + rect.height / 2 - height / 2
  }
  if (left + width > window.innerWidth - VIEWPORT_GAP) left = window.innerWidth - width - VIEWPORT_GAP
  if (left < VIEWPORT_GAP) left = VIEWPORT_GAP
  if (top + height > window.innerHeight - VIEWPORT_GAP) top = window.innerHeight - height - VIEWPORT_GAP
  if (top < VIEWPORT_GAP) top = VIEWPORT_GAP

  return { left, top, width }
}

function ProductTourBeacon({ onRestore }: { onRestore: () => void }) {
  return (
    <button className="react-joyride__beacon" type="button" aria-label="Показать подсказку" onClick={onRestore}>
      <span className="product-tour-beacon" aria-hidden="true"><span>?</span><strong>Подсказка</strong></span>
    </button>
  )
}

export function ProductTourLayer() {
  const productTour = useProductTour()
  const [collapsed, setCollapsed] = useState(false)
  const [targetElement, setTargetElement] = useState<Element | null>(null)
  const [positionVersion, setPositionVersion] = useState(0)
  const focusTooltipAfterRestoreRef = useRef(false)
  const active = productTour.state?.status === 'active'
  const stepId = productTour.state?.stepId
  const stepIndex = stepId ? PRODUCT_TOUR_STEP_ORDER.indexOf(stepId) : 0
  const steps = useMemo(() => getProductTourSteps(Boolean(productTour.resultReady)), [productTour.resultReady])
  const step = active ? steps[stepIndex] : undefined
  const target = step?.target
  const reportTargetUnavailable = productTour.reportTargetUnavailable

  useEffect(() => {
    if (!active || !target) {
      return
    }

    let highlighted: Element | null = null
    let found = false
    const updateTarget = () => {
      const next = document.querySelector(target)
      if (highlighted !== next) {
        highlighted?.classList.remove('product-tour-target')
        next?.classList.add('product-tour-target')
        highlighted = next
        setTargetElement(next)
      }
      if (next && !found) {
        found = true
        next.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center', inline: 'nearest' })
      }
    }

    updateTarget()
    const observer = new MutationObserver(updateTarget)
    observer.observe(document.body, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => {
      if (!found) reportTargetUnavailable()
    }, TARGET_WAIT_MS)

    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
      highlighted?.classList.remove('product-tour-target')
    }
  }, [active, reportTargetUnavailable, target])

  useEffect(() => {
    if (!active || !targetElement) return
    const updatePosition = () => setPositionVersion((version) => version + 1)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [active, targetElement])

  useEffect(() => {
    if (!active || collapsed) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setCollapsed(true)
    }
    document.addEventListener('keydown', closeOnEscape, true)
    return () => document.removeEventListener('keydown', closeOnEscape, true)
  }, [active, collapsed])

  useEffect(() => {
    if (!active || !targetElement) return
    if (collapsed) {
      window.setTimeout(() => document.querySelector<HTMLElement>('.react-joyride__beacon')?.focus(), 0)
    } else if (focusTooltipAfterRestoreRef.current) {
      focusTooltipAfterRestoreRef.current = false
      window.setTimeout(() => document.querySelector<HTMLElement>('.product-tour-tooltip__close')?.focus(), 0)
    }
  }, [active, collapsed, targetElement])

  if (productTour.error) {
    return <ProductTourErrorDialog kind={productTour.error} onClose={productTour.dismissError} onRestart={productTour.restart} />
  }
  if (!active || !step || !targetElement) return null

  void positionVersion
  const style = positionFor(targetElement, step.placement, collapsed)
  return (
    <div className="product-tour-floater" style={style}>
      {collapsed
        ? <ProductTourBeacon onRestore={() => { focusTooltipAfterRestoreRef.current = true; setCollapsed(false) }} />
        : <ProductTourTooltip step={step} onCollapse={() => setCollapsed(true)} />}
    </div>
  )
}
