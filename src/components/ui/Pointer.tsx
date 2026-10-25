import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

/**
 * The little arrow that says which button a panel came out of.
 *
 * Staw, 25 October: "add an arrow pointer onto the notification card & same
 * thing for when u click settings & the brix". Three panels open out of the
 * same strip of buttons in the top bar and all three landed somewhere near
 * the right-hand end, so which one you had pressed was a thing to work out
 * rather than a thing to see.
 *
 * It is a square turned forty-five degrees with two of its sides drawn,
 * which is the only shape of this that keeps the card's own border running
 * through the point of the arrow. `bg` is asked for rather than assumed:
 * the notification card's arrow sits against its raised header and the
 * menus' against the plain card, and an arrow a shade off the thing it is
 * attached to is worse than no arrow.
 *
 * `left` is a number of pixels, and whoever draws one is expected to have
 * measured the button rather than guessed: an arrow pointing between two
 * buttons points at neither.
 */
export function Pointer({
  side = 'top', bg = 'bg-ink-card', style, className,
}: {
  /** Which edge of the panel it grows out of. */
  side?: 'top' | 'bottom'
  bg?: string
  style?: CSSProperties
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        'pointer-events-none absolute h-3 w-3 rotate-45 border-ink-line',
        side === 'top' ? 'border-l border-t' : 'border-b border-r',
        bg,
        className,
      )}
    />
  )
}
