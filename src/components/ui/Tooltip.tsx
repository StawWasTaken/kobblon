import { cloneElement, useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

type Side = 'top' | 'bottom' | 'left' | 'right'

const GAP = 8
const EDGE = 8

/**
 * The bubble and its nib are the same colour with no border between them, so
 * they read as one shape rather than a box with a triangle stuck to it. The
 * nib is a rotated square with a rounded corner, which is what gives the tip
 * the same softness as the bubble.
 *
 * It renders into the body so nothing can clip it, and it is kept inside the
 * viewport rather than running off the edge.
 */
export function Tooltip({
  label,
  side = 'top',
  children,
}: {
  label: ReactNode
  side?: Side
  children: ReactElement<{
    onMouseEnter?: (e: React.MouseEvent) => void
    onMouseLeave?: (e: React.MouseEvent) => void
    onFocus?: (e: React.FocusEvent) => void
    onBlur?: (e: React.FocusEvent) => void
    'aria-describedby'?: string
  }>
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [placed, setPlaced] = useState<
    { left: number; top: number; nib: number; side: Side } | null
  >(null)
  const bubble = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const id = useId()

  const show = (e: React.MouseEvent | React.FocusEvent) => {
    const target = e.currentTarget as HTMLElement
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setAnchor(target.getBoundingClientRect()), 120)
  }

  const hide = () => {
    window.clearTimeout(timer.current)
    setAnchor(null)
    setPlaced(null)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Measured after the bubble exists, so its real size decides where it goes.
  const place = useCallback(() => {
    if (!anchor || !bubble.current) return
    const box = bubble.current.getBoundingClientRect()
    const centreX = anchor.left + anchor.width / 2
    const centreY = anchor.top + anchor.height / 2

    /*
     * Whether a side has room for the bubble at all. A tooltip on the top
     * strip asked for 'top', got clamped to the top edge, and ended up
     * lying across the thing it was describing with its nib pointing at
     * nothing. Clamping is for a few pixels; when a side has no room it is
     * the wrong side, and the fix is to use the other one.
     */
    const room: Record<Side, number> = {
      top: anchor.top - GAP - EDGE,
      bottom: window.innerHeight - anchor.bottom - GAP - EDGE,
      left: anchor.left - GAP - EDGE,
      right: window.innerWidth - anchor.right - GAP - EDGE,
    }
    const opposite: Record<Side, Side> = {
      top: 'bottom', bottom: 'top', left: 'right', right: 'left',
    }
    const needed = side === 'top' || side === 'bottom' ? box.height : box.width

    // Only flip if the other side is actually better; squeezed both ways,
    // the side that was asked for is the one somebody meant.
    const other = opposite[side]
    const put = room[side] < needed && room[other] > room[side] ? other : side

    let left = centreX - box.width / 2
    let top = anchor.top - box.height - GAP

    if (put === 'bottom') top = anchor.bottom + GAP
    if (put === 'left') { left = anchor.left - box.width - GAP; top = centreY - box.height / 2 }
    if (put === 'right') { left = anchor.right + GAP; top = centreY - box.height / 2 }

    // Nudged back inside the window, with the nib following the trigger so it
    // keeps pointing at the right thing.
    const clampedLeft = Math.min(Math.max(left, EDGE), window.innerWidth - box.width - EDGE)
    const clampedTop = Math.min(Math.max(top, EDGE), window.innerHeight - box.height - EDGE)

    const nib = put === 'top' || put === 'bottom'
      ? Math.min(Math.max(centreX - clampedLeft, 14), box.width - 14)
      : Math.min(Math.max(centreY - clampedTop, 14), box.height - 14)

    setPlaced({ left: clampedLeft, top: clampedTop, nib, side: put })
  }, [anchor, side])

  useEffect(() => {
    if (!anchor) return
    place()
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [anchor, place])

  const trigger = cloneElement(children, {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    'aria-describedby': anchor ? id : undefined,
  })

  /**
   * The nib sits half inside the bubble. The half that overlaps disappears
   * into it, because they are the same colour with nothing drawn between
   * them, and the half that sticks out is the point.
   */
  const nibStyle = (): React.CSSProperties => {
    if (!placed) return {}
    const rotate = 'rotate(45deg)'
    // The side it ended up on, which is not always the side it asked for.
    const side = placed.side
    if (side === 'top') {
      return { left: placed.nib, bottom: 0, transform: `translate(-50%, 50%) ${rotate}` }
    }
    if (side === 'bottom') {
      return { left: placed.nib, top: 0, transform: `translate(-50%, -50%) ${rotate}` }
    }
    if (side === 'left') {
      return { top: placed.nib, right: 0, transform: `translate(50%, -50%) ${rotate}` }
    }
    return { top: placed.nib, left: 0, transform: `translate(-50%, -50%) ${rotate}` }
  }

  return (
    <>
      {trigger}
      {anchor &&
        createPortal(
          <div
            ref={bubble}
            role="tooltip"
            id={id}
            className={cn(
              'pointer-events-none fixed z-[80] max-w-[15rem] rounded-xl bg-[rgb(var(--bubble))] px-3 py-1.5',
              'text-center text-xs font-semibold leading-snug text-[rgb(var(--on-bubble))] shadow-pop',
              'shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)] transition-opacity duration-100',
              placed ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              left: placed?.left ?? 0,
              top: placed?.top ?? 0,
              // Measured off screen first, so it never flashes in the wrong spot.
              visibility: placed ? 'visible' : 'hidden',
            }}
          >
            {label}
            <span
              aria-hidden="true"
              className="absolute h-3 w-3 rounded-[3px] bg-[rgb(var(--bubble))]"
              style={nibStyle()}
            />
          </div>,
          document.body,
        )}
    </>
  )
}
