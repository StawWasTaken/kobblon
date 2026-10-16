import { kobbyArt } from '@/components/brand/Kobby'
import { cn } from '@/lib/cn'

/**
 * What stands in for a picture that is not there.
 *
 * Staw picked it: Kobby holding an empty box, "when an image doesnt load
 * theres the image i sent u". It is the right choice for the reason a
 * broken-image icon is the wrong one - a grey frame with a torn corner says
 * the page is broken, and this says the box is empty, which is what actually
 * happened.
 *
 * It fills whatever it is put in and never bobs: a card full of these would
 * be a card full of movement, and nothing here is being celebrated.
 *
 * `why` is said out loud for anybody reading with their ears, and shown
 * underneath when there is room for it. An item that is waiting to be looked
 * at and one that was turned down both land here, and they are not the same
 * thing to the person who made it.
 */
export function Missing({ why, className }: { why?: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={why ?? 'No picture'}
      className={cn(
        'grid h-full w-full place-items-center gap-1 bg-media p-3 text-center',
        className,
      )}
    >
      <img
        src={kobbyArt.emptyBox}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="max-h-[70%] w-auto max-w-[70%] select-none object-contain opacity-80"
      />
      {why && (
        <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-muted">
          {why}
        </span>
      )}
    </span>
  )
}
