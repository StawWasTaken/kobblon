import { useEffect, useRef, useState } from 'react'
import { Icon, type KobIcon } from '@/components/brand/Icon'
import { PixelGrid } from './Motif'
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

/**
 * A number, as something to look at.
 *
 * Four bare numbers in a row is a figure caption. This is the same number
 * with the things that make it read as a measurement: Staw's icon for
 * what is being counted, the pixel grid behind it, and a rule under it
 * that draws itself in as the tile arrives.
 *
 * The rule is the one thing here that had to be thought about rather than
 * drawn. It is **not** a bar: a bar is a proportion, a proportion needs a
 * maximum, and there is no honest maximum for "visits". So it fills the
 * tile's width every time, in the same time, and means nothing but "this
 * tile has arrived". A rule that stopped at seventy per cent would be a
 * chart of nothing, which is the kind of lie that is hard to unsee once
 * somebody asks what the seventy per cent is.
 */
export function StatTile({ value, label, icon, delay = 0 }: {
  value: number
  label: string
  icon: KobIcon
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [here, setHere] = useState(false)

  useEffect(() => {
    if (reduced) return setHere(true)
    const node = ref.current
    if (!node) return
    const watch = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      watch.disconnect()
      setHere(true)
    })
    watch.observe(node)
    return () => watch.disconnect()
  }, [reduced])

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-card/50 p-6 sm:p-7"
    >
      <PixelGrid from="top-right" className="opacity-40" />

      <Icon name={icon} tone="currentColor" className="relative h-7 w-7 text-brand-bright" />
      <div className="relative mt-5">
        <Tally value={value} label={label} />
      </div>

      <span
        aria-hidden="true"
        style={here && !reduced ? { transitionDelay: `${delay}ms` } : undefined}
        className={cn(
          'absolute inset-x-6 bottom-5 h-0.5 origin-left rounded-full bg-brand-bright/70',
          'transition-transform duration-[900ms] ease-out motion-reduce:transition-none sm:inset-x-7',
          here ? 'scale-x-100' : 'scale-x-0',
        )}
      />
    </div>
  )
}
