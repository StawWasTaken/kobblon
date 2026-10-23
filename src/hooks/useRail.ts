import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Whether a sideways shelf has anything left to scroll to, either way.
 *
 * Both shelves on this site drew their two arrows whatever they held, so a
 * rail with three cards in a window that fits six had a pair of buttons over
 * it that moved nothing when pressed - and on a week-old platform, where
 * most shelves hold nothing at all, that is most of them. A control that
 * implies something the page does not do is the one thing this project will
 * not ship; it was shipped here by accident, twice, because the two shelves
 * each had their own copy of the scrolling.
 *
 * Measured on a layout effect rather than in a `useEffect`: the first paint
 * is the one somebody sees, and an effect that runs after it puts both
 * arrows on screen for a frame and then takes them away. Re-measured
 * whenever the rail or anything in it changes size, which covers the cards
 * arriving, the window resizing, and a picture loading late.
 */
export function useRail(deps: unknown) {
  const track = useRef<HTMLDivElement>(null)
  const [can, setCan] = useState({ left: false, right: false })

  const measure = () => {
    const el = track.current
    if (!el) return
    /* A pixel of slack: a scroll position lands on a fraction often enough
       that an exact comparison leaves the right arrow lit at the end. */
    setCan({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    })
  }

  useLayoutEffect(() => {
    const el = track.current
    if (!el) return
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    for (const child of Array.from(el.children)) watch.observe(child)
    return () => watch.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps])

  const nudge = (way: 1 | -1) => {
    track.current?.scrollBy({ left: way * (track.current.clientWidth * 0.85), behavior: 'smooth' })
  }

  return { track, can, nudge, measure, scrollable: can.left || can.right }
}
