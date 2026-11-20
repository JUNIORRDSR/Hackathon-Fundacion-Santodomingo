import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { animateMotion } from './motion'

const activePill = ':scope > :is([aria-current="page"], [aria-current="true"], [aria-pressed="true"])'

export function MotionPills({ as: Container = 'div', label, active, className, children }: {
  as?: 'div' | 'nav'; label: string; active: string; className: string; children: ReactNode
}) {
  const group = useRef<HTMLElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)
  const skin = useRef<HTMLSpanElement>(null)
  const previous = useRef<HTMLElement | null>(null)
  const slide = useRef<Promise<unknown> | null>(null)

  useLayoutEffect(() => {
    const element = group.current
    if (!element) return

    function measure() {
      if (!element) return
      const selected = element.querySelector<HTMLElement>(activePill)
      if (!selected?.offsetWidth || !selected.offsetHeight) {
        previous.current = null
        slide.current = null
        delete element.dataset.pillSliding
        delete element.dataset.pillPositioned
        return
      }

      const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = selected
      element.style.setProperty('--pill-x', offsetLeft + 'px')
      element.style.setProperty('--pill-y', offsetTop + 'px')
      element.style.setProperty('--pill-width', offsetWidth + 'px')
      element.style.setProperty('--pill-height', offsetHeight + 'px')
      element.dataset.pillPositioned = 'true'

      const surface = skin.current
      if (surface && previous.current && previous.current !== selected) {
        const scale = getComputedStyle(surface).scale
        surface.getAnimations?.().forEach((animation) => animation.cancel())
        animateMotion(surface, [
          { scale: scale === 'none' ? '1' : scale, offset: 0, easing: 'ease-out' },
          { scale: '1.07 .96', offset: .34, easing: 'ease-in-out' },
          { scale: '1', offset: 1 },
        ], '--motion-slide', { easing: 'linear' })
      }
      previous.current = selected

      const animations = indicator.current?.getAnimations?.({ subtree: true }) ?? []
      if (!animations.length) return
      // Keep light control edges from painting over the shared indicator while it moves.
      element.dataset.pillSliding = 'true'
      const finished = Promise.allSettled(animations.map((animation) => animation.finished))
      slide.current = finished
      void finished.then(() => {
        if (slide.current !== finished) return
        slide.current = null
        delete element.dataset.pillSliding
      })
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
      <span className="motion-pill-indicator" aria-hidden="true" ref={indicator}><span ref={skin} /></span>
      {children}
    </Container>
  )
}
