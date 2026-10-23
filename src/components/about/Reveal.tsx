import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/cn'

/**
 * The About side's one motion gesture.
 *
 * Staw asked for animation on these pages, and the trap is answering that
 * with six different ones - a thing that slides, a thing that scales, a
 * thing that spins - which is how a page stops feeling built and starts
 * feeling decorated. There is one gesture here: as a band comes into view,
 * what is in it rises sixteen pixels and fades in, in order. Everything
 * moves the same way, so the movement reads as the page arriving rather
 * than as individual elements showing off.
 *
 * It fires once. A section that re-animates every time it is scrolled past
 * is a section nobody can read twice.
 *
 * `delay` is in milliseconds and is what makes a row of four cards deal
 * itself out instead of appearing at once. Keep the steps small - at
 * seventy the four cards are done inside a third of a second, which is
 * the difference between a stagger and a wait.
 *
 * Reduced motion gets the end state immediately: visible, in place, no
 * transition. Not a faster animation - none.
 */
export function Reveal({
  delay = 0, as: As = 'div', className, children,
}: {
  delay?: number
  as?: 'div' | 'li' | 'section' | 'p' | 'span'
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (reduced) return setShown(true)
    const node = ref.current
    if (!node) return

    /*
     * A band that is already on screen when the page opens must not wait
     * for a scroll that may never come, so the observer answers for it on
     * its first callback either way.
     */
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setShown(true)
        watch.disconnect()
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    watch.observe(node)
    return () => watch.disconnect()
  }, [reduced])

  return (
    <As
      ref={ref as never}
      style={shown && !reduced ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        'transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className,
      )}
    >
      {children}
    </As>
  )
}
