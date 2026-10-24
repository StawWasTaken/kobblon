import { useEffect, useRef, type ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/cn'

/**
 * A picture that drifts as the page moves.
 *
 * `Reveal` is how a thing arrives; this is what it does once it is here.
 * The two are deliberately different jobs: arriving happens once and is
 * about attention, drifting happens continuously and is about depth. A
 * page where the pictures sit a little behind the words is a page with a
 * back and a front, and that is the whole trick.
 *
 * Kept honest by three things:
 *
 *   * **It is tiny.** `strength` is the number of pixels the picture
 *     travels over a full screen of scrolling, and the default is
 *     fifty-six. Parallax that is noticed is parallax that is too strong,
 *     and a hundred pixels of it is a page that feels like it is sliding
 *     apart.
 *   * **It is measured from the middle of the window.** The drift is zero
 *     when the picture is centred, so what you are actually looking at is
 *     never the thing that has moved furthest from where it belongs.
 *   * **It stops when it is off screen.** An observer parks the listener,
 *     because four of these reading `getBoundingClientRect` on every
 *     scroll event of a four-thousand-pixel page is how a laptop fan
 *     starts up.
 *
 * Reduced motion gets no transform at all. Not a smaller one.
 */
export function Parallax({ strength = 56, className, children }: {
  /** Pixels travelled per screen of scrolling. */
  strength?: number
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const node = ref.current
    if (!node) return

    let frame = 0
    let on = false

    const place = () => {
      frame = 0
      const box = node.getBoundingClientRect()
      const middle = window.innerHeight / 2
      // How far this is from the middle of the window, as a fraction of it.
      const off = (box.top + box.height / 2 - middle) / window.innerHeight
      node.style.transform = `translate3d(0, ${(off * strength).toFixed(2)}px, 0)`
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(place)
    }

    const watch = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting === on) return
      on = entry.isIntersecting
      if (on) {
        window.addEventListener('scroll', onScroll, { passive: true })
        place()
      } else {
        window.removeEventListener('scroll', onScroll)
      }
    }, { rootMargin: '20% 0px' })
    watch.observe(node)

    return () => {
      watch.disconnect()
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
      node.style.transform = ''
    }
  }, [strength, reduced])

  return (
    <div ref={ref} className={cn('will-change-transform', className)}>
      {children}
    </div>
  )
}
