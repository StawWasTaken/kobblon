import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * A platform number that counts up the first time you see it.
 *
 * The count is the whole point: a number that is simply printed reads as
 * copy somebody typed, and a number that runs up to itself reads as a
 * number something measured. These come from `getPlatformStats`, so they
 * are measured, and the animation is the page saying so.
 *
 * It starts when the number is on screen, not when the page loads, because
 * a tally at the bottom of a long page would otherwise have finished
 * before anybody got there. Reduced motion prints the value.
 *
 * The easing is a quartic ease-out: fast enough at the start that the
 * digits are a blur, slow enough at the end that the last few land one at
 * a time. A linear count looks like a progress bar.
 */
export function Tally({ value, label, className }: {
  value: number
  label: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(reduced ? value : 0)

  useEffect(() => {
    if (reduced) return setShown(value)
    const node = ref.current
    if (!node) return

    let frame = 0
    const run = () => {
      const started = performance.now()
      const step = (now: number) => {
        const through = Math.min(1, (now - started) / 1100)
        const eased = 1 - Math.pow(1 - through, 4)
        setShown(Math.round(value * eased))
        if (through < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }

    const watch = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      watch.disconnect()
      run()
    })
    watch.observe(node)

    return () => {
      watch.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value, reduced])

  return (
    <div ref={ref} className={cn('text-center sm:text-left', className)}>
      <p className="font-display text-4xl font-extrabold tabular-nums leading-none sm:text-5xl">
        {formatCount(shown)}
      </p>
      <p className="mt-2.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/40">
        {label}
      </p>
    </div>
  )
}
