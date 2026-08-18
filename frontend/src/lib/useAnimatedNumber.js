import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Chases a changing numeric target with an eased animation instead of
 * jumping straight to it. A single "Apply" reads as a satisfying count-up;
 * a continuous chart-scrub reads as the number trailing your finger rather
 * than a flicker of digits, since each new target just redirects the chase
 * from wherever the animation currently sits.
 */
export function useAnimatedNumber(target, duration = 400) {
  const [display, setDisplay] = useState(target)
  const frameRef = useRef()
  const fromRef = useRef(target)

  useEffect(() => {
    if (prefersReducedMotion || !Number.isFinite(target) || fromRef.current === target) return

    const from = fromRef.current
    const startTime = performance.now()

    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - (1 - t) ** 3
      const value = from + (target - from) * eased
      setDisplay(value)
      fromRef.current = value
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  // Reduced motion (or a not-yet-valid target) skips the animated state
  // entirely and renders the target directly, rather than routing it
  // through a setState call in the effect above.
  return prefersReducedMotion || !Number.isFinite(target) ? target : display
}
