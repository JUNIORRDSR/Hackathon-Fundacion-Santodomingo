import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { animateMotion } from '../ui/motion'

type Position = { x: number; y: number }

export function useTimelineMotion(canvas: RefObject<HTMLDivElement | null>, layout: string) {
  const previous = useRef<{ width: number; positions: Map<string, Position> } | undefined>(undefined)

  useLayoutEffect(() => {
    const element = canvas.current
    if (!element) return
    const area = element.getBoundingClientRect()
    const positions = new Map<string, Position>()
    const old = previous.current
    const moves = [...element.querySelectorAll<HTMLElement>('[data-timeline-task]')].map((task) => {
      const { left, top } = task.getBoundingClientRect()
      const id = task.dataset.timelineTask!
      const next = { x: left - area.left, y: top - area.top }
      positions.set(id, next)
      const before = old?.width === area.width ? old.positions.get(id) : undefined
      return { task, x: before ? before.x - next.x : 0, y: before ? before.y - next.y : 0 }
    })
    previous.current = { width: area.width, positions }
    const animations = moves.map(({ task, x, y }) => Math.abs(x) + Math.abs(y) > 1
      ? animateMotion(task, [{ translate: x + 'px ' + y + 'px' }, { translate: '0 0' }], '--motion-slide')
      : undefined)
    return () => animations.forEach((animation) => animation?.cancel())
  }, [canvas, layout])
}
