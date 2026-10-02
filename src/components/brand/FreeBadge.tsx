import { cn } from '@/lib/cn'
import { asset } from '@/lib/asset'

/*
 * The FREE starburst.
 *
 * Staw's own artwork, rather than the one that was drawn here. It was drawn
 * because the only copy of it anywhere was seventy pixels across in the
 * corner of a poster; he has since sent the file, so the file wins - a badge
 * traced from a thumbnail is a guess at a brand mark, and this is not ours
 * to guess at.
 *
 * Sits half on and half off a card's top right corner, which is why the card
 * it goes on must not clip its own overflow. The places that round a tile
 * hard are the ones to watch.
 */

export function FreeBadge({ className, label = 'Free' }: {
  className?: string
  label?: string
}) {
  return (
    <img
      src={asset('/brand/free.png')}
      alt={label}
      draggable={false}
      className={cn(
        'pointer-events-none block select-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]',
        className,
      )}
    />
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
