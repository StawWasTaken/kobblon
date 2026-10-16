import { Icon } from '@/components/brand/Icon'
import { cn } from '@/lib/cn'

/**
 * What stands in for a picture that is not there.
 *
 * Staw's own mark, the torn square: "the not loading image was this one".
 * Drawn as a mask rather than as a picture, like every other icon of his on
 * the site, so it takes the colour of whatever it is sitting in and is not a
 * grey shape on one theme and a hole on the other.
 *
 * Quiet on purpose. This is the most common thing on the page when something
 * is wrong, and a loud one turns a slow network into a page that looks
 * broken.
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
        'flex h-full w-full flex-col items-center justify-center gap-2 bg-media p-3 text-center',
        className,
      )}
    >
      {/*
        * Sized by font size rather than by a height class: an icon is drawn
        * at one em, and a height put on it from outside loses to that
        * depending on which rule Tailwind happens to write last. Set the em
        * and it is the size it is asked for, everywhere.
        *
        * Fixed rather than a share of the box, so the mark sits in the same
        * place whether or not there is a line under it.
        */}
      <Icon
        name="broken-image"
        className="shrink-0 opacity-40"
        style={{ fontSize: '3.25rem' }}
      />
      {why && (
        <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-muted">
          {why}
        </span>
      )}
    </span>
  )
}
