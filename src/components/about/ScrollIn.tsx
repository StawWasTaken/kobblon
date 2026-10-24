import { useEffect, useRef, type ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/cn'

/**
 * Something at the very top of the page that arrives as you scroll into it.
 *
 * `Reveal` cannot do this job, and the reason is the whole point: it fires
 * when a thing enters the window, and the first screen is already in the
 * window when the page loads. A headline wrapped in `Reveal` up there has
 * simply already arrived by the time anybody touches the wheel.
 *
 * So this one is keyed to the scroll position rather than to an
 * intersection. It is out at rest and fully in by `over` pixels of
 * scrolling, which is a fraction of the first screen - the sentence is
 * finished arriving long before the band below it comes up.
 *
 * Reduced motion is given the finished state and no listener at all, so
 * the words are never behind a gesture somebody has asked not to see.
 */
export function ScrollIn({
  over = 0.34,
  lift = 44,
  className,
  children,
}: {
  /** How much of a screen of scrolling it takes to arrive. */
  over?: number
  /** Pixels it travels on the way in. */
  lift?: number
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (reduced) {
      node.style.opacity = '1'
      node.style.transform = 'none'
      return
    }

    let frame = 0

    const place = () => {
      frame = 0
      const span = Math.max(1, window.innerHeight * over)
      // Nought at the top of the document, one once it has been scrolled past.
      const went = Math.min(1, Math.max(0, window.scrollY / span))
      // Eased, because a linear fade reads as a value changing rather than
      // as a thing moving.
      const eased = 1 - (1 - went) ** 3
      node.style.opacity = String(eased)
      node.style.transform = `translate3d(0, ${((1 - eased) * lift).toFixed(2)}px, 0)`
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(place)
    }

    place()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [over, lift, reduced])

  return (
    <div ref={ref} className={cn('will-change-[opacity,transform]', className)} style={{ opacity: 0 }}>
      {children}
    </div>
  )
}
