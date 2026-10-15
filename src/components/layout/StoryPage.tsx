import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Wordmark } from '@/components/brand/Wordmark'
import { PixelField } from '@/components/brand/PixelField'
import { SiteFooter } from './SiteFooter'
import { useForceDark } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'

export type StorySection = {
  id: string
  heading: string
  body: string[]
  /** Optional lines that read as a list rather than as prose. */
  points?: { label: string; note?: string; tone?: 'done' | 'building' | 'next' }[]
}

const toneLook: Record<string, string> = {
  done: 'border-space/40 bg-space/15 text-space-bright',
  building: 'border-brand-bright/50 bg-brand/20 text-white',
  next: 'border-white/15 bg-white/[0.06] text-white/60',
}

const toneWord: Record<string, string> = {
  done: 'Built',
  building: 'Being built',
  next: 'Next',
}

/**
 * The pages that speak for Kobblon rather than being part of using it:
 * the terms, the guidelines, what is coming. They are written for one look,
 * so they hold dark whatever the rest of the site is set to, and they carry
 * their own contents rail rather than a wall of text.
 */
export function StoryPage({
  eyebrow, title, intro, sections, footnote, updated, tagline = true,
}: {
  eyebrow: string
  title: string
  intro: string
  sections: StorySection[]
  footnote?: string
  /** The day the wording last changed, for a page that is a rule. */
  updated?: string
  tagline?: boolean
}) {
  useForceDark()
  const [active, setActive] = useState(sections[0]?.id ?? '')

  // The rail follows the reading rather than the clicking, so it is right
  // even when somebody scrolls past three sections at once.
  useEffect(() => {
    const spy = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (seen) setActive(seen.target.id)
      },
      { rootMargin: '-20% 0px -65% 0px' },
    )
    sections.forEach((section) => {
      const node = document.getElementById(section.id)
      if (node) spy.observe(node)
    })
    return () => spy.disconnect()
  }, [sections])

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-white">
      <PixelField className="opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(80rem_44rem_at_50%_-15%,rgba(27,52,232,0.4),transparent_62%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/85 to-ink" />

      <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <Wordmark to="/" className="h-6" />
          <nav className="flex items-center gap-5 text-sm font-semibold text-white/50">
            <Link to="/policies" className="hover:text-white">All policies</Link>
            <Link to="/support" className="hover:text-white">Support</Link>
          </nav>
        </header>

        {/* ------------------------------------------------------- hero */}
        <section className="py-12 sm:py-20">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-white/40">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-extrabold leading-[0.9] sm:text-7xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/60">{intro}</p>
          {updated && (
            <p className="mt-6 text-sm font-semibold text-white/40">
              Last changed{' '}
              {new Date(updated).toLocaleDateString(undefined, {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          )}

          {tagline && (
            <p className="mt-8 font-display text-sm font-extrabold uppercase tracking-[0.18em] text-brand-bright">
              Make Something Nobody Else Has
            </p>
          )}
        </section>

        <div className="grid gap-10 lg:grid-cols-[15rem_1fr] lg:gap-14">
          {/* --------------------------------------------------- contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-10">
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
                Contents
              </p>
              <ul className="space-y-1">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={cn(
                        'flex gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                        active === section.id
                          ? 'bg-white/[0.08] text-white'
                          : 'text-white/45 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      <span className="tabular-nums text-white/30">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1">{section.heading}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* ---------------------------------------------------- sections */}
          <div className="min-w-0 space-y-4">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm sm:p-8"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-display text-3xl font-extrabold leading-none text-brand">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
                    {section.heading}
                  </h2>
                </div>

                {section.body.map((paragraph) => (
                  <p key={paragraph} className="mt-4 leading-relaxed text-white/65">
                    {paragraph}
                  </p>
                ))}

                {!!section.points?.length && (
                  <ul className="mt-5 space-y-2.5">
                    {section.points.map((point) => (
                      <li
                        key={point.label}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-white/10 bg-ink-card/70 px-4 py-3"
                      >
                        <span className="min-w-0 flex-1 text-sm font-bold">{point.label}</span>
                        {point.note && (
                          <span className="w-full text-sm leading-relaxed text-white/55 sm:w-auto sm:flex-1">
                            {point.note}
                          </span>
                        )}
                        {point.tone && (
                          <span
                            className={cn(
                              'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide',
                              toneLook[point.tone],
                            )}
                          >
                            {toneWord[point.tone]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            {footnote && (
              <p className="px-2 pt-2 text-sm leading-relaxed text-white/40">{footnote}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <a
                href="#top"
                onClick={(e) => {
                  e.preventDefault()
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="inline-flex items-center gap-2 text-sm font-bold text-link hover:underline"
              >
                <Glyph icon={faArrowUp} className="text-xs" />
                Back to the top
              </a>
              <Link to="/policies" className="text-sm font-semibold text-white/45 hover:text-white">
                All policies
              </Link>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter className="relative mt-20 border-white/10 bg-transparent" />
    </div>
  )
}

export type StoryIcon = IconDefinition
