import type { ReactNode } from 'react'
import { PixelField } from '@/components/brand/PixelField'
import { SiteFooter } from './SiteFooter'
import { AboutNav } from './AboutNav'
import { useForceDark } from '@/hooks/useTheme'
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
  hero, children, className,
}: {
  /** The washed opening of the page. A `Hero`, usually. */
  hero?: ReactNode
  /** The bands under it. */
  children?: ReactNode
  className?: string
}) {
  useForceDark()

  return (
    <div className={cn('relative min-h-dvh bg-ink text-white', className)}>
      <AboutNav />

      {hero && (
        <div className="relative overflow-hidden">
          {/*
           * The wash, the light behind the headline and the fade into the
           * first band. The fade is what stops the pixels from ending on a
           * hard line halfway down the page.
           */}
          <PixelField className="opacity-30" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70rem_40rem_at_50%_-20%,rgba(27,52,232,0.45),transparent_65%)]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/20 via-ink/70 to-ink" />
          {hero}
        </div>
      )}

      <main>{children}</main>

      <SiteFooter className="relative border-white/[0.08] bg-transparent" />
    </div>
  )
}
