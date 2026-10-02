import { cn } from '@/lib/cn'

/*
 * The FREE starburst, as it is on the posters.
 *
 * Drawn rather than fetched. The only copy of it anywhere was seventy pixels
 * across in the corner of a promotional picture, which is too small to cut
 * out and too small to put on a card; a starburst is a dozen numbers, so it
 * is cheaper to draw than to store and it is sharp at any size.
 *
 * Sits half on and half off a card's top right corner, which is why the card
 * it goes on must not clip its own overflow. `Card` does not, and the places
 * that round a tile hard are the ones to watch.
 */

/** The points of the burst, as a path, so the shape lives in one place. */
const POINTS = 20
const burst = () => {
  const middle = 50
  const out = 50
  const inn = 40
  const step = Math.PI / POINTS
  const at: string[] = []
  for (let i = 0; i < POINTS * 2; i += 1) {
    const r = i % 2 === 0 ? out : inn
    // Started a little off true so the points do not line up with the card's
    // own edges, which is what makes a stuck-on sticker read as stuck on.
    const angle = i * step - Math.PI / 2 + 0.08
    at.push(`${(middle + Math.cos(angle) * r).toFixed(2)},${(middle + Math.sin(angle) * r).toFixed(2)}`)
  }
  return `M${at.join('L')}Z`
}

const SHAPE = burst()

export function FreeBadge({ className, label = 'Free' }: {
  className?: string
  /** What it says. The shape is the brand; the word can be shorter. */
  label?: string
}) {
  return (
    <span
      className={cn('pointer-events-none block select-none', className)}
      aria-label={label}
      role="img"
    >
      <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]">
        <path d={SHAPE} fill="#ff0033" />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          /*
           * Rotated the way the poster has it, and in the display face so it
           * is the same letterform as the wordmark beside it.
           */
          transform="rotate(-12 50 50)"
          className="font-display"
          fontSize="22"
          fontWeight="700"
          /*
           * Pinned to a width rather than trusted to a font size. The display
           * face is a pixel face and does not measure like a normal one, so
           * "FREE" at a size that fits in the browser's fallback spilled out
           * past the points of the star in ours. `textLength` makes the word
           * fit the shape whatever face it lands in, which is the only
           * version of this that survives a font being swapped.
           */
          textLength="58"
          lengthAdjust="spacingAndGlyphs"
        >
          {label.toUpperCase()}
        </text>
      </svg>
    </span>
  )
}

/**
 * The badge placed where it belongs: over a card's top right corner, half
 * on and half off.
 *
 * A component rather than a class string copied onto every card, because
 * "half outside" is two offsets and a z-index that have to agree, and the
 * first card to get one of them wrong is the one nobody notices.
 */
export function FreeCorner({ className }: { className?: string }) {
  return (
    <FreeBadge
      className={cn(
        'absolute -right-3 -top-3 z-10 h-11 w-11 sm:-right-3.5 sm:-top-3.5 sm:h-12 sm:w-12',
        className,
      )}
    />
  )
}
