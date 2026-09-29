import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { ProductTourErrorDialog } from '@/components/product-tour/ProductTourErrorDialog'
import { ProductTourTooltip } from '@/components/product-tour/ProductTourTooltip'
import { PRODUCT_TOUR_STEP_ORDER, getProductTourSteps, type ProductTourPlacement } from '@/features/product-tour/productTourSteps'
import { useProductTour } from '@/features/product-tour/useProductTour'

const TARGET_WAIT_MS = 10_000
const TOOLTIP_WIDTH = 392
const VIEWPORT_GAP = 16
const MOBILE_BREAKPOINT = 760
const MOBILE_PANEL_FALLBACK_HEIGHT = 240
const MOBILE_SAFE_GAP = 12

function isMobileViewport(): boolean {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
}

function getScrollParent(element: Element): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    const { overflowY } = window.getComputedStyle(parent)
    if (/(auto|scroll)/.test(overflowY) && parent.scrollHeight > parent.clientHeight) return parent
    parent = parent.parentElement
  }
  return null
}

function getMobileVisibleBounds(target: Element, panelHeight: number) {
  const viewport = window.visualViewport
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight)
  let top = viewportTop + MOBILE_SAFE_GAP
  let bottom = viewportBottom - panelHeight - MOBILE_SAFE_GAP

  for (const selector of ['.arena-home__header', '.preparation-header', '.duel-header', '.result-header']) {
    const header = document.querySelector<HTMLElement>(selector)
    if (!header) continue
    const rect = header.getBoundingClientRect()
    if (rect.bottom > viewportTop && rect.top <= viewportTop + MOBILE_SAFE_GAP) {
      top = Math.max(top, rect.bottom + MOBILE_SAFE_GAP)
    }
  }

  for (const selector of ['.preparation-bottom', '.home-case-modal__footer']) {
    const stickyControl = document.querySelector<HTMLElement>(selector)
    if (!stickyControl || selector === '.home-case-modal__footer' && !target.closest('.home-case-modal')) continue
    const rect = stickyControl.getBoundingClientRect()
    if (rect.top < bottom && rect.bottom > top) bottom = Math.min(bottom, rect.top - MOBILE_SAFE_GAP)
  }

  const scrollParent = getScrollParent(target)
  if (scrollParent) {
    const rect = scrollParent.getBoundingClientRect()
    top = Math.max(top, rect.top + MOBILE_SAFE_GAP)
    bottom = Math.min(bottom, rect.bottom - MOBILE_SAFE_GAP)
  }

  return { top, bottom, scrollParent }
}

function scrollTargetIntoMobileView(target: Element, panelHeight: number): void {
  const { top, bottom, scrollParent } = getMobileVisibleBounds(target, panelHeight)
  const rect = target.getBoundingClientRect()
  const availableHeight = Math.max(0, bottom - top)
  let delta = 0

  if (rect.height <= availableHeight) {
    if (rect.top < top) delta = rect.top - top
    else if (rect.bottom > bottom) delta = rect.bottom - bottom
  } else if (rect.top < top || rect.bottom > bottom) {
    delta = rect.top - top
  }

  if (Math.abs(delta) < 1) return
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  if (scrollParent) scrollParent.scrollBy({ top: delta, behavior })
  else window.scrollBy({ top: delta, behavior })
}

interface PositionedTooltip {
  placement: ProductTourPlacement
  style: CSSProperties
}

function positionFor(target: Element, preferredPlacement: ProductTourPlacement, collapsed: boolean, measuredHeight: number): PositionedTooltip {
  const rect = target.getBoundingClientRect()
  const width = collapsed ? 132 : Math.min(TOOLTIP_WIDTH, window.innerWidth - VIEWPORT_GAP * 2)
  const height = collapsed ? 40 : measuredHeight
  const placements = [preferredPlacement, 'top', 'bottom', 'right']
    .filter((placement, index, values) => values.indexOf(placement) === index) as ProductTourPlacement[]
  const coordinates = (placement: ProductTourPlacement) => {
    let left = rect.left + rect.width / 2 - width / 2
    let top = rect.bottom + 14
    if (placement === 'top') top = rect.top - height - 14
    if (placement === 'right') {
      left = rect.right + 14
      top = rect.top + rect.height / 2 - height / 2
    }
    return { left, top }
  }

  for (const placement of placements) {
    const { left, top } = coordinates(placement)
    if (
      left >= VIEWPORT_GAP
      && left + width <= window.innerWidth - VIEWPORT_GAP
      && top >= VIEWPORT_GAP
      && top + height <= window.innerHeight - VIEWPORT_GAP
    ) return { placement, style: { left, top, width } }
  }

  let { left, top } = coordinates(preferredPlacement)
  if (left + width > window.innerWidth - VIEWPORT_GAP) left = window.innerWidth - width - VIEWPORT_GAP
  if (left < VIEWPORT_GAP) left = VIEWPORT_GAP
  if (top + height > window.innerHeight - VIEWPORT_GAP) top = window.innerHeight - height - VIEWPORT_GAP
  if (top < VIEWPORT_GAP) top = VIEWPORT_GAP

  return { placement: preferredPlacement, style: { left, top, width } }
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
  const [mobile, setMobile] = useState(isMobileViewport)
  const [panelHeight, setPanelHeight] = useState(MOBILE_PANEL_FALLBACK_HEIGHT)
  const floaterRef = useRef<HTMLDivElement>(null)
  const focusTooltipAfterRestoreRef = useRef(false)
  const active = productTour.state?.status === 'active'
  const stepId = productTour.state?.stepId
  const stepIndex = stepId ? PRODUCT_TOUR_STEP_ORDER.indexOf(stepId) : 0
  const steps = useMemo(() => getProductTourSteps(Boolean(productTour.resultReady)), [productTour.resultReady])
  const step = active ? steps[stepIndex] : undefined
  const target = step?.target
  const highlight = step?.highlight ?? target
  const highlightFirstRow = step?.highlightFirstRow ?? false
  const reportTargetUnavailable = productTour.reportTargetUnavailable

  useEffect(() => {
    if (!active || !target) {
      return
    }

    let highlighted: Element[] = []
    let locatedTarget: Element | null = null
    let found = false
    const updateTarget = () => {
      const next = [...document.querySelectorAll(target)].find((element) => element.getClientRects().length > 0) ?? null
      let nextHighlighted = highlight
        ? [...document.querySelectorAll(highlight)].filter((element) => element.getClientRects().length > 0)
        : []
      if (highlightFirstRow && nextHighlighted.length > 0) {
        const firstElement = nextHighlighted.reduce((first, element) => (
          element.getBoundingClientRect().top < first.getBoundingClientRect().top ? element : first
        ))
        const firstRect = firstElement.getBoundingClientRect()
        nextHighlighted = nextHighlighted.filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.top < firstRect.bottom && rect.bottom > firstRect.top
        })
      }
      if (highlighted.length !== nextHighlighted.length || highlighted.some((element, index) => element !== nextHighlighted[index])) {
        highlighted.forEach((element) => element.classList.remove('product-tour-target'))
        nextHighlighted.forEach((element) => element.classList.add('product-tour-target'))
        highlighted = nextHighlighted
      }
      if (locatedTarget !== next) {
        locatedTarget = next
        setTargetElement(next)
      }
      if (next && !found) {
        found = true
        if (isMobileViewport()) scrollTargetIntoMobileView(next, MOBILE_PANEL_FALLBACK_HEIGHT)
        else next.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center', inline: 'nearest' })
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
      highlighted.forEach((element) => element.classList.remove('product-tour-target'))
    }
  }, [active, highlight, highlightFirstRow, reportTargetUnavailable, target])

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!active || collapsed) return
    const floater = floaterRef.current
    if (!floater) return
    const updateHeight = () => setPanelHeight(Math.ceil(floater.getBoundingClientRect().height))
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(floater)
    return () => observer.disconnect()
  }, [active, collapsed, stepId, targetElement])

  useEffect(() => {
    if (!active || collapsed || !mobile) return
    document.documentElement.classList.add('product-tour-mobile-panel-open')
    document.documentElement.style.setProperty('--product-tour-panel-height', `${panelHeight}px`)
    return () => {
      document.documentElement.classList.remove('product-tour-mobile-panel-open')
      document.documentElement.style.removeProperty('--product-tour-panel-height')
    }
  }, [active, collapsed, mobile, panelHeight, targetElement])

  const revealMobileTarget = useCallback(() => {
    if (!mobile || collapsed || !targetElement) return
    scrollTargetIntoMobileView(targetElement, panelHeight)
  }, [collapsed, mobile, panelHeight, targetElement])

  useEffect(() => {
    if (!active || !mobile || collapsed || !targetElement) return
    let animationFrame = window.requestAnimationFrame(revealMobileTarget)
    const update = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(revealMobileTarget)
    }
    const observer = new ResizeObserver(update)
    observer.observe(targetElement)
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      observer.disconnect()
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [active, collapsed, mobile, revealMobileTarget, targetElement])

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
  const positioned = mobile && !collapsed
    ? { placement: step.placement, style: undefined }
    : positionFor(targetElement, step.placement, collapsed, panelHeight)
  return (
    <div className="product-tour-floater" data-placement={positioned.placement} ref={floaterRef} style={positioned.style}>
      {collapsed
        ? <ProductTourBeacon onRestore={() => { focusTooltipAfterRestoreRef.current = true; setCollapsed(false) }} />
        : <ProductTourTooltip step={step} onCollapse={() => setCollapsed(true)} />}
    </div>
  )
}
