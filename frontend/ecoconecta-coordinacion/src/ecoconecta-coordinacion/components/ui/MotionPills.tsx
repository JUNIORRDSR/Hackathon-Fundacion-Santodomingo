import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'

const activePill = ':scope > :is([aria-current="page"], [aria-current="true"], [aria-pressed="true"])'

export function MotionPills({ as: Container = 'div', label, active, className, children }: {
  as?: 'div' | 'nav'; label: string; active: string; className: string; children: ReactNode
}) {
  const group = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const element = group.current
    if (!element) return

    function measure() {
      if (!element) return
      const selected = element.querySelector<HTMLElement>(activePill)
      if (!selected) {
        delete element.dataset.pillPositioned
        return
      }
      const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = selected
      if (!offsetWidth || !offsetHeight) {
        delete element.dataset.pillPositioned
        return
      }

      element.style.setProperty('--pill-x', offsetLeft + 'px')
      element.style.setProperty('--pill-y', offsetTop + 'px')
      element.style.setProperty('--pill-width', offsetWidth + 'px')
      element.style.setProperty('--pill-height', offsetHeight + 'px')
      element.dataset.pillPositioned = 'true'
    }

    measure()
    if (!window.ResizeObserver) {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    element.querySelectorAll(':scope > :is(a, button)').forEach((pill) => observer.observe(pill))
    return () => observer.disconnect()
  }, [active])

  return (
    <Container ref={(node) => { group.current = node }} className={className + ' motion-pills'}
      role={Container === 'div' ? 'group' : undefined} aria-label={label}>
      <span className="motion-pill-indicator" aria-hidden="true" />
      {children}
    </Container>
  )
}
