import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { AboutShell } from './AboutShell'
import { Band } from '@/components/about/Band'
import { Hero } from '@/components/about/Hero'
import { Reveal } from '@/components/about/Reveal'
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
 * The pages that are a rule rather than a pitch: the terms, the
 * guidelines, the nine policies.
 *
 * They sit on the same shell as the rest of the About side now - the same
 * sticky bar, the same wash at the top, the same foot - but they keep
 * their own body, and that is deliberate. The other About pages are bands
 * of pictures you scroll past; a policy is a document you read, and a
 * document wants one column, a contents rail that follows the reading,
 * and numbered sections you can point somebody at. Giving this page the
 * showcase treatment would be decorating a thing whose whole job is to be
 * read carefully.
 *
 * What it does take from the new system: nothing here draws its own
 * background any more, so a policy page and the page that links to it are
 * finally the same colour.
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
    <AboutShell
      hero={
        <Hero
          eyebrow={eyebrow}
          title={title}
          lead={intro}
          note={
            <>
              {updated && (
                <>
                  Last changed{' '}
                  {new Date(updated).toLocaleDateString(undefined, {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </>
              )}
              {tagline && (
                <span className="mt-4 block font-display text-sm font-extrabold uppercase tracking-[0.18em] text-brand-bright">
                  Make Something Nobody Else Has
                </span>
              )}
            </>
          }
        />
      }
    >
      <Band tone="raised" edge>
        <div className="grid gap-10 lg:grid-cols-[15rem_1fr] lg:gap-14">
          {/* --------------------------------------------------- contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
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
              <Reveal
                key={section.id}
                as="section"
                className="scroll-mt-24 rounded-3xl border border-white/10 bg-ink-card/60 p-6 sm:p-8"
              >
                <div id={section.id} className="-mt-24 pt-24">
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
                          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-white/10 bg-ink-raised/60 px-4 py-3"
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
                </div>
              </Reveal>
            ))}

            {footnote && (
              <p className="px-2 pt-2 text-sm leading-relaxed text-white/40">{footnote}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-2 text-sm font-bold text-link hover:underline"
              >
                <Glyph icon={faArrowUp} className="text-xs" />
                Back to the top
              </button>
              <Link to="/policies" className="text-sm font-semibold text-white/45 hover:text-white">
                All policies
              </Link>
            </div>
          </div>
        </div>
      </Band>
    </AboutShell>
  )
}

export type StoryIcon = IconDefinition
