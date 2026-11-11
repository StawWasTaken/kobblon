import { useEffect, useState } from 'react'
import { Missing } from '@/components/brand/Missing'
import { cn } from '@/lib/cn'

/**
 * A picture, with Staw's mark under it the whole time.
 *
 * Staw: "for when an image is loading or doesnt load, use the image we use
 * for image not loading ... and use it for everything that doesnt load,
 * instead of a random svg icon like for user icon etc".
 *
 * So there is one answer to a picture that is not there, and it is the torn
 * square - not initials, not a Font Awesome person, not an empty tile, and
 * not a different one of those three depending on which component somebody
 * happened to be looking at. A page half loaded now reads as one page
 * loading rather than as four different kinds of broken.
 *
 * The mark is behind rather than instead of, and it is there from the
 * first frame: the picture fades in over it when it arrives. That is what
 * makes loading and failing the same drawing without a timer deciding
 * which one is being looked at - nothing has to guess, because the mark is
 * simply what is underneath until something covers it.
 *
 * `src` going from one url to another resets it, which is the trap this
 * project keeps falling into: `loaded` is a value decided by a picture that
 * can be replaced afterwards, so it is keyed on the url rather than kept.
 *
 * **It fetches once, and only when it is on screen.** It used to load the
 * url twice - a `new Image()` to find out whether it worked, and then the
 * real `<img>` - and the first of those broke lazy loading entirely. A
 * probe is an eager fetch by definition; the browser has no idea it belongs
 * to an element four screens down, so a Catalog page of sixty cards pulled
 * sixty full pictures the moment it mounted, whether anybody scrolled or
 * not. With egress metered that is not a performance note, it is the bill.
 * The real element reports on itself now, through `onLoad` and `onError`,
 * and `loading="lazy"` does what it says.
 */
export function Picture({
  src,
  alt = '',
  why,
  className,
  pictureClassName,
  fit = 'cover',
  draggable,
  loading = 'lazy',
}: {
  src?: string | null
  alt?: string
  /** Said out loud, and shown under the mark where there is room. */
  why?: string
  /** On the box. The mark fills it. */
  className?: string
  /** On the picture itself, for a radius or a transform. */
  pictureClassName?: string
  fit?: 'cover' | 'contain'
  draggable?: boolean
  loading?: 'lazy' | 'eager'
}) {
  const [shown, setShown] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  /*
   * Keyed on the url rather than kept: a new `src` is a new question, and
   * the old answer must not survive it even for a frame.
   */
  useEffect(() => {
    setShown(null)
    setFailed(false)
  }, [src])

  /*
   * A picture already in the browser's cache finishes before React has
   * attached `onLoad`, which left the mark showing for ever over a picture
   * that was sitting right there. The ref runs once the element exists and
   * asks it directly, which is the moment of use rather than a value
   * captured before it.
   */
  const askOnMount = (node: HTMLImageElement | null) => {
    if (node?.complete && node.currentSrc) {
      if (node.naturalWidth > 0) setShown(node.src)
      else setFailed(true)
    }
  }

  const ready = shown === src && !!src && !failed

  return (
    <span className={cn('relative block overflow-hidden', className)}>
      <Missing why={why} className="absolute inset-0" />
      {!!src && !failed && (
        <img
          key={src}
          ref={askOnMount}
          src={src}
          alt={alt}
          draggable={draggable}
          loading={loading}
          onLoad={(event) => setShown(event.currentTarget.src)}
          onError={() => setFailed(true)}
          className={cn(
            'absolute inset-0 h-full w-full transition-opacity duration-200',
            ready ? 'opacity-100' : 'opacity-0',
            fit === 'cover' ? 'object-cover' : 'object-contain',
            pictureClassName,
          )}
        />
      )}
    </span>
  )
}
