import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * The About side's design system, band by band.
 *
 * The first version of these pages was the signed-in design with the rail
 * taken off: one narrow column, everything in a rounded card, every card
 * the same. That reads as a settings page, and the About side is not a
 * settings page - it is the only thing a person sees before they decide
 * whether Kobblon is worth an account.
 *
 * So the unit here is a **band**, not a card. A band runs the full width of
 * the window, owns its own background, and holds one idea. The page is a
 * stack of them, and the alternation of the backgrounds is what gives a
 * long page a rhythm you can scroll through without reading. Cards still
 * exist inside a band, for things that really are a list of equal items,
 * but a band never sits inside another band.
 *
 * Four tones, and they mean something rather than being a palette:
 *
 *   `night`   the page's own floor. The default.
 *   `raised`  one step up, for the band that must look like a change of
 *             subject rather than more of the same.
 *   `brand`   Kobblon blue. For the band that asks for something: the
 *             sign-up at the end, the download. One per page, at most.
 *   `clear`   no background at all, for a band sitting over the hero's
 *             pixel wash so the wash shows through.
 */
export type BandTone = 'night' | 'raised' | 'brand' | 'clear'

const tones: Record<BandTone, string> = {
  night: 'bg-ink',
  raised: 'bg-ink-raised/60',
  brand: 'bg-brand-ink',
  clear: '',
}

export function Band({
  tone = 'night', edge = false, tight = false, className, children, id,
}: {
  tone?: BandTone
  /** A hairline across the top, where two bands of the same tone meet. */
  edge?: boolean
  /** Half the usual height, for a strip rather than a chapter. */
  tight?: boolean
  className?: string
  children: ReactNode
  id?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        'relative',
        tones[tone],
        edge && 'border-t border-white/[0.07]',
        tight ? 'py-10 sm:py-14' : 'py-16 sm:py-24',
        className,
      )}
    >
      {tone === 'brand' && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_0%,rgba(58,80,255,0.55),transparent_70%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/60 to-transparent" />
        </>
      )}
      <Lane>{children}</Lane>
    </section>
  )
}

/**
 * The one measure everything on this side lines up to.
 *
 * Written once because three pages picking their own max width is exactly
 * how the old About side stopped looking like one site: the bar's wordmark
 * and the heading under it did not share a left edge on two of them.
 */
export function Lane({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('relative mx-auto w-full max-w-6xl px-5 sm:px-8', className)}>
      {children}
    </div>
  )
}
