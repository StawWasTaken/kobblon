import type { ReactNode } from 'react'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'

/**
 * A picture, framed the one way the About side frames pictures.
 *
 * These pages have to be visual, and the thing that makes a page of
 * pictures look designed rather than pasted is that every picture is
 * presented identically: the same corner radius, the same hairline, the
 * same blue light behind it, the same caption position. So no page writes
 * its own `<img>` - it writes a Figure.
 *
 * Two details that are doing work:
 *
 *   * The glow sits *behind* the frame and is clipped by nothing, so a
 *     render of a World looks lit rather than pasted onto the floor.
 *   * The frame's inner ring is drawn with an inset shadow rather than a
 *     second border, because a border would move the image by a pixel and
 *     four Figures in a row would each be a pixel off from the text
 *     beside them.
 *
 * `glow` is off for a picture that is already bright. Two lit things beside
 * each other both look dim.
 */
export function Figure({
  src, alt, ratio = 'wide', glow = true, caption, className, children,
}: {
  src: string
  alt: string
  /** The shape the picture is cropped to. */
  ratio?: 'wide' | 'screen' | 'square' | 'tall'
  glow?: boolean
  caption?: ReactNode
  className?: string
  /** Anything laid over the picture: a badge, a play mark, a label. */
  children?: ReactNode
}) {
  const shapes = {
    wide: 'aspect-[16/9]',
    screen: 'aspect-[16/10]',
    square: 'aspect-square',
    tall: 'aspect-[4/5]',
  }

  return (
    <figure className={cn('relative', className)}>
      {glow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-brand/25 blur-3xl"
        />
      )}
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl bg-media shadow-pop',
          'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
          shapes[ratio],
        )}
      >
        <img
          src={asset(src)}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {children}
      </div>
      {caption && (
        <figcaption className="mt-3 text-sm font-semibold text-white/40">{caption}</figcaption>
      )}
    </figure>
  )
}

/**
 * A character standing in the page rather than in a frame.
 *
 * Staw wants the mascots to carry these pages, and a character reads as a
 * character only when it has no box around it - the moment it gets a
 * rounded border it becomes a thumbnail of a character. So this is the
 * cut-out: the drawing, a soft pool of light under its feet, and nothing
 * else.
 */
export function Character({
  src, alt, className, imgClassName,
}: {
  src: string
  alt: string
  className?: string
  imgClassName?: string
}) {
  return (
    <div className={cn('relative grid place-items-center', className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[15%] bottom-[6%] h-10 rounded-[50%] bg-brand/40 blur-2xl"
      />
      <img
        src={asset(src)}
        alt={alt}
        loading="lazy"
        className={cn('relative w-full max-w-[16rem] object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)]', imgClassName)}
      />
    </div>
  )
}
