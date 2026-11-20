type MotionDuration = '--motion-route' | '--motion-slide'

export function animateMotion(element: HTMLElement, keyframes: Keyframe[], duration: MotionDuration) {
  if (!element.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const style = getComputedStyle(element)
  const milliseconds = Number.parseFloat(style.getPropertyValue(duration))
  if (!Number.isFinite(milliseconds)) return
  return element.animate(keyframes, {
    duration: milliseconds,
    easing: style.getPropertyValue('--motion-ease').trim(),
  })
}
