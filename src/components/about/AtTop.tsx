import type { ReactNode } from 'react'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'

/**
 * The top of an At Kobblon page.
 *
 * Staw: "all pages must be similar too". They were not - What is Kobblon
 * opened on a runway two screens tall, Policies on a wash over shapes,
 * Support on a band, Download on nothing - and four openings is four
 * pages that happen to share a bar.
 *
 * One shape for all of them: a picture running the full width, the title
 * in the pixel face over it, one line, and whatever that page needs
 * underneath. The bar floats on top of it rather than sitting on a black
 * strip above it - `AboutShell` pulls itself up by the bar's height when
 * a page passes one of these, which is what the hero used to do and the
 * reason a page without a hero had a black band across the top of it.
 *
 * Props only, no router, no provider: the applications can mount it.
 */
export function AtTop({
  title, says, art = '/brand/waves.png', tall, children, className,
}: {
  title: ReactNode
  /** One line. If a second is needed, the first is wrong. */
  says?: ReactNode
  /** The picture behind it. The waves unless the page owns something better. */
  art?: string
  /** For the page that opens on a World rather than on a pattern. */
  tall?: boolean
  /** A bar, a button, whatever this page opens with. */
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('relative overflow-hidden border-b-2 border-ink-line', className)}>
      <img
        src={asset(art)}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {/*
       * Dark enough to read white off, and darkest at the top where the
       * bar sits: a floating pill over a bright corner of a picture is a
       * pill nobody can read the words on.
       */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/65"
      />

      <div
        className={cn(
          'relative mx-auto max-w-5xl px-5 pb-10 sm:px-8',
          /* Room for the bar, which is floating over this. */
          tall ? 'pt-28 sm:pt-40 sm:pb-20' : 'pt-24 sm:pt-28',
        )}
      >
        <h1
          className={cn(
            'font-display font-extrabold leading-[0.95] text-on-art',
            tall ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-5xl',
          )}
        >
          {title}
        </h1>
        {says && (
          <p className="mt-4 max-w-xl text-lede leading-relaxed text-on-art/75">{says}</p>
        )}
        {children}
      </div>
    </header>
  )
}
