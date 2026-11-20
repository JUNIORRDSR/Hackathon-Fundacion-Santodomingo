import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'
import type { EcoPage } from '../../routes'
import { animateMotion, prefersReducedMotion } from '../ui/motion'

const cardSelector = ':is(.stat-grid, .dashboard-bento, .collection-grid, .training-grid) > .card, .video-card'

function cardBounds(card: HTMLElement, stage: HTMLElement) {
  let x = 0
  let y = 0
  for (
    let element: HTMLElement | null = card;
    element && element !== stage;
    element = element.offsetParent as HTMLElement | null
  ) {
    x += element.offsetLeft
    y += element.offsetTop
  }
  return { x, y, width: card.offsetWidth, height: card.offsetHeight }
}

function sizeRatio(before: number, after: number) {
  return Math.max(0.88, Math.min(1.12, before / after))
}

export function useBentoMotion(stage: RefObject<HTMLDivElement | null>, page: EcoPage) {
  useLayoutEffect(() => {
    const element = stage.current
    if (!element || !window.ResizeObserver || prefersReducedMotion()) return

    let positions = new Map<HTMLElement, ReturnType<typeof cardBounds>>()
    const animations = new Map<HTMLElement, Animation>()
    let frame = 0
    const resize = new ResizeObserver(() => {
      if (!frame) measure()
    })
    const mutations = new MutationObserver(schedule)

    function measure() {
      frame = 0
      if (!element) return
      const next = new Map(
        [...element.querySelectorAll<HTMLElement>(cardSelector)].map((card) => [card, cardBounds(card, element)]),
      )
      const moves = []
      for (const [card, target] of next) {
        const before = positions.get(card)
        if (!before) {
          resize.observe(card)
          continue
        }
        const x = before.x - target.x
        const y = before.y - target.y
        if (
          !target.width ||
          !target.height ||
          Math.abs(x) + Math.abs(y) + Math.abs(before.width - target.width) + Math.abs(before.height - target.height) <
            2
        )
          continue

        const current = animations.has(card) ? getComputedStyle(card) : undefined
        const [offsetX = 0, offsetY = 0] = current?.translate.split(' ').map(Number.parseFloat) ?? []
        const [scaleX = 1, scaleY = scaleX] = current?.scale.split(' ').map(Number.parseFloat) ?? []
        moves.push({
          card,
          from: {
            translate: x + (offsetX || 0) + 'px ' + (y + (offsetY || 0)) + 'px',
            scale:
              sizeRatio(before.width * (scaleX || 1), target.width) +
              ' ' +
              sizeRatio(before.height * (scaleY || 1), target.height),
            transformOrigin: 'top left',
          },
        })
      }

      for (const card of positions.keys()) {
        if (next.has(card)) continue
        resize.unobserve(card)
        animations.get(card)?.cancel()
        animations.delete(card)
      }
      positions = next

      for (const { card, from } of moves) {
        animations.get(card)?.cancel()
        const animation = animateMotion(
          card,
          [from, { translate: '0 0', scale: '1', transformOrigin: 'top left' }],
          '--motion-layout',
        )
        if (!animation) continue
        animations.set(card, animation)
        const release = () => {
          if (animations.get(card) === animation) animations.delete(card)
        }
        void animation.finished.then(release, release)
      }
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    resize.observe(element)
    mutations.observe(element, { childList: true, subtree: true, characterData: true })
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutations.disconnect()
      animations.forEach((animation) => animation.cancel())
    }
  }, [stage, page])
}
