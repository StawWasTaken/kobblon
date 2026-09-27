import { cn } from '@/lib/cn'
import type { WornStyle } from '@/types/db'

/**
 * The things somebody is wearing, drawn over their picture.
 *
 * A placement is kept in fractions of the picture rather than in pixels, so
 * the same hat sits in the same place on a picture the size of a thumbnail
 * and on one the size of a profile. x and y are the middle of the thing and
 * width is how much of the picture it covers, which is exactly what the
 * person who made it dragged it to.
 */
export function StyleLayer({ items, layer }: { items?: WornStyle[] | null; layer: 0 | 1 }) {
  const worn = (items ?? []).filter((one) => (one.layer ?? 1) === layer)
  if (!worn.length) return null

  return (
    <>
      {worn.map((item) => (
        <img
          key={item.id}
          src={item.url}
          alt=""
          aria-hidden="true"
          draggable={false}
          loading="lazy"
          className={cn(
            'pointer-events-none absolute select-none',
            /*
             * `max-w-none`, and it is not decoration. Tailwind's preflight
             * gives every img `max-width: 100%`, so anything worn wider than
             * the picture was silently clamped to exactly the picture - a
             * frame placed at 125% drew at 100% and sat inside the face
             * instead of around it. Nothing errored and nothing looked
             * broken; it just quietly was not what its maker dragged.
             */
            'max-w-none',
            layer === 0 ? 'z-0' : 'z-[5]',
          )}
          style={{
            left: `${item.x * 100}%`,
            top: `${item.y * 100}%`,
            width: `${item.width * 100}%`,
            transform: `translate(-50%, -50%) rotate(${item.rotation ?? 0}deg)`
              + (item.flipped ? ' scaleX(-1)' : ''),
          }}
        />
      ))}
    </>
  )
}
