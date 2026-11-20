type MotionDuration = '--motion-route' | '--motion-route-exit' | '--motion-slide' | '--motion-layout'

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function animateMotion(
  element: HTMLElement,
  keyframes: Keyframe[],
  duration: MotionDuration,
  options: KeyframeAnimationOptions = {},
) {
  if (!element.animate || prefersReducedMotion()) return
  const style = getComputedStyle(element)
  const milliseconds = Number.parseFloat(style.getPropertyValue(duration))
  if (!Number.isFinite(milliseconds)) return
  return element.animate(keyframes, {
    duration: milliseconds,
    easing: style.getPropertyValue('--motion-ease').trim(),
    ...options,
  })
}
