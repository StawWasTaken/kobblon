import type { ReactNode } from 'react'
import { PixelField } from '@/components/brand/PixelField'
import { SiteFooter } from './SiteFooter'
import { AboutNav } from './AboutNav'
import { CookieNote } from './CookieNote'
import { useForceDark } from '@/hooks/useTheme'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/cn'

/**
 * The About side's shell.
 *
 * The landing page, the policies and Download each drew their own pixel
 * wash, their own two gradients and their own header, three times over,
 * and drifted apart every time one of them was touched. This is that
 * chrome, once.
 *
 * What changed in the rebuild: the shell used to own the page's measure
 * as well, so every About page was the same narrow column of cards. It
 * owns the chrome and nothing else now - the bar, the wash at the top,
 * the foot - and the page itself is a stack of `Band`s that run the full
 * width of the window. That is the whole difference between a settings
 * page and a page that is trying to tell somebody what this is.
 *
 * The wash stays, and stays where it was: over the top of the page only.
 * Staw asked for the pixels to be kept, and they are the first thing on
 * every page on this side. Running them the whole way down was tried and
 * is worse - a canvas repainting behind two thousand pixels of text makes
 * the text look like it is vibrating, and the pixels stop meaning "this
 * is the top of Kobblon" once they are everywhere.
 *
 * It is always dark. The About pages are what Kobblon looks like to
 * somebody who has not signed in, so they do not follow a theme the
 * visitor has never had the chance to choose.
 */
export function AboutShell({
  hero, backdrop, pin, children, className,
}: {
  /** The washed opening of the page. A `Hero`, usually. */
  hero?: ReactNode
  /**
   * A picture behind the whole opening, under the wash and the gradients.
   * For the page that opens on something somebody built rather than on a
   * colour.
   */
  backdrop?: ReactNode
  /**
   * Hold the opening still for this many screens of scrolling before the
   * page starts moving.
   *
   * Staw: "i want that you scroll down but its locked onto the topthing and
   * when the title appears it lets you scroll down the website for real."
   * So the opening is a tall runway with the words stuck to the top of it:
   * the wheel turns, the title arrives, and the page underneath only begins
   * to move once the runway is spent. `1` means one extra screen of holding.
   *
   * It is done with `position: sticky` and not by catching the wheel. A page
   * that eats scroll events takes the keyboard, the scrollbar, find-in-page
   * and a trackpad fling with it, and gives nothing back; sticky is the same
   * effect with the browser still in charge of the scrolling.
   */
  pin?: number
  /** The bands under it. */
  children?: ReactNode
  className?: string
}) {
  useForceDark()
  const reduced = useReducedMotion()
  /*
   * Nothing is held still for somebody who asked for less motion: a screen
   * of scrolling that moves nothing is the most annoying version of this
   * idea, not the gentlest one.
   */
  const held = pin && !reduced ? pin : 0

  return (
    <div className={cn('relative min-h-dvh bg-ink text-white', className)}>
      <AboutNav />

      {hero && (
        <div
          /*
           * No `overflow-hidden` on the runway while it is pinned, and that
           * is not a tidy-up: `overflow: hidden` makes an element a scroll
           * container, and a sticky child sticks inside *that* rather than
           * inside the window. With it here the pane tracked the scroll one
           * for one and the hold did nothing at all. The clipping the
           * backdrop needs is on the pane instead, which is the thing that
           * actually has a picture overflowing it.
           */
          className={cn('relative', !held && 'overflow-hidden')}
          /*
           * The runway. One extra screen of height is one extra screen of
           * scrolling with the pane below stuck to the top of it; without a
           * pin this is the plain opening it always was, sized by the hero.
           */
          style={held ? { height: `calc(100dvh + ${held * 100}dvh)` } : undefined}
        >
          <div className={cn(held ? 'sticky top-0 h-dvh overflow-hidden' : undefined)}>
            {/*
             * The wash, the light behind the headline and the fade into the
             * first band. The fade is what stops the pixels from ending on a
             * hard line halfway down the page.
             *
             * All of it inside the pinned pane rather than around it: the
             * backdrop is `absolute inset-0`, and against the runway that
             * would be a picture two screens tall with a screen of it below
             * the fold doing nothing.
             */}
            {backdrop}
            <PixelField className="opacity-30" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70rem_40rem_at_50%_-20%,rgba(27,52,232,0.45),transparent_65%)]" />
            <div className={cn(
              'pointer-events-none absolute inset-0 bg-gradient-to-b to-ink',
              backdrop ? 'from-ink/70 via-ink/80' : 'from-ink/20 via-ink/70',
            )} />
            {hero}
          </div>
        </div>
      )}

      <main>{children}</main>

      <SiteFooter className="relative border-white/[0.08] bg-transparent" />

      <CookieNote />
    </div>
  )
}
