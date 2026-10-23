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
 * chrome, once: the wash, the light at the top, the bar, the hero and the
 * foot. A page on this side writes its hero and its content and nothing
 * else.
 *
 * It is always dark. The About pages are what Kobblon looks like to
 * somebody who has not signed in, so they do not follow a theme the
 * visitor has never had the chance to choose.
 */
export function AboutShell({
  eyebrow, title, lead, actions, children, wide = false,
}: {
  eyebrow?: string
  title: ReactNode
  lead?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  /** A page whose content wants the full width under a narrow hero. */
  wide?: boolean
}) {
  useForceDark()

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-white">
      <PixelField className="opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(80rem_44rem_at_50%_-15%,rgba(27,52,232,0.4),transparent_62%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/85 to-ink" />

      <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-8">
        <AboutNav />

        <section className="py-12 sm:py-20">
          {eyebrow && (
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-white/40">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-extrabold leading-[0.9] sm:text-7xl">
            {title}
          </h1>
          {lead && <p className="mt-5 max-w-2xl text-lg text-white/60">{lead}</p>}
          {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
        </section>

        <div className={cn(wide ? '' : 'max-w-5xl')}>{children}</div>
      </div>

      <SiteFooter className="relative border-white/10 bg-transparent" />
    </div>
  )
}
