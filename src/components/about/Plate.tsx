import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'

/**
 * The lit panel at the top of a card.
 *
 * Staw's three glass renders - the shapes, the bricks, the laurel - are
 * the only pictures on this side that are *of* an idea rather than of a
 * place. They are lit from inside against black, so they want the card to
 * end where they end rather than sitting in a frame: the picture fills
 * the top, a gradient walks it down into the card's own colour, and there
 * is no line between them.
 *
 * The slow lift on hover is deliberate and is the only thing these do.
 * Three cards that each did something different on hover would be three
 * cards competing with the thing they are showing.
 */
export function Plate({ src, alt, className }: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <div className={cn('relative aspect-[5/4] overflow-hidden', className)}>
      <img
        src={asset(src)}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
      />
      {/* Into the card, rather than onto it. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-ink-card" />
    </div>
  )
}
