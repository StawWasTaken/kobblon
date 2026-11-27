import { Link, Navigate, useParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { FACE_COLOUR } from '@/components/social/Reactions'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { StoryPage } from '@/components/layout/StoryPage'
import { AboutShell } from '@/components/layout/AboutShell'
import { AtTop } from '@/components/about/AtTop'
import { AskKobby } from '@/components/about/AskKobby'
import { policies, policyBySlug } from '@/content/policies'
import { useAtTitle } from '@/hooks/useTitle'
import { cn } from '@/lib/cn'

const readable = (day: string) =>
  new Date(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** One rule, at its own address, so support can point at it. */
export function PolicyPage() {
  const { slug = '' } = useParams()
  const policy = policyBySlug(slug)
  useAtTitle(policy?.title ?? 'Policies')

  if (!policy) return <Navigate to="/policies" replace />

  return (
    <StoryPage
      eyebrow={policy.eyebrow}
      title={policy.title}
      intro={policy.intro}
      updated={policy.updated}
      sections={policy.sections}
      footnote={policy.footnote}
    />
  )
}

/** One of our faces, placed by a wrapper of our own - see `About`. */
function Face({ face, className, turn, size = 'h-16 w-16' }: {
  face: keyof typeof FACE_COLOUR; className?: string; turn: number; size?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute select-none', className)}
      style={{ transform: `rotate(${turn}deg)` }}
    >
      <Icon name={`reaction-${face}` as 'reaction-smile'} tone={FACE_COLOUR[face]} className={size} />
    </span>
  )
}

/**
 * Every rule in one place, which is the thing a policy hub is for.
 *
 * It was a washed opening, a band, a `BandHead` with an eyebrow over it and
 * then nine cards in a grid, three thousand pixels tall and mostly air.
 * Staw, on the whole At Kobblon side: too corporate, simplify, and make the
 * pages look like each other.
 *
 * So: the shared `AtTop`, the bar Kobby answers in straight away, and the
 * nine documents as **one list**. A list is run down with an eye; a grid of
 * nine cards is read across, which is the wrong motion for "find the one I
 * came for".
 */
export default function PolicyHub() {
  useAtTitle('Policies')

  return (
    <AboutShell
      top={
        <AtTop
          title={<>The rules.<br />All of them.</>}
          says="Nine documents. Written to be read, not to be agreed to."
        >
          <AskKobby className="mt-7 max-w-xl text-left" />
          <Face face="sunglasses" turn={-12} className="bottom-8 right-10 hidden sm:block" />
        </AtTop>
      }
    >
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <ul className="divide-y-2 divide-ink-line overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card">
          {policies.map((policy) => (
            <li key={policy.slug}>
              <Link
                to={`/policies/${policy.slug}`}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-extrabold leading-tight">
                    {policy.title}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">{policy.blurb}</span>
                </span>
                <span className="hidden shrink-0 text-mini font-bold uppercase tracking-wide text-muted sm:block">
                  {readable(policy.updated)}
                </span>
                <Glyph
                  icon={faArrowRight}
                  className="shrink-0 text-link transition-transform group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>

        {/* The two doors that matter when a rule is about you. */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/standing"
            className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6 transition-colors hover:border-brand"
          >
            <p className="font-display text-xl font-extrabold leading-none">Where you stand</p>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              Every decision against your account, what it switched off, and how to
              argue with it.
            </p>
          </Link>
          <Link
            to="/support"
            className="relative overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6 transition-colors hover:border-brand"
          >
            <Face face="shocked" turn={10} className="right-3 top-3 opacity-90" size="h-12 w-12" />
            <p className="font-display text-xl font-extrabold leading-none">Write to a person</p>
            <p className="mt-2.5 max-w-[20rem] text-sm leading-relaxed text-muted">
              Not a bot and not a form that goes nowhere. The reply lands in your
              Kobblon inbox.
            </p>
          </Link>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          These say what actually happens. They have not been through a lawyer yet,
          and they will be before Kobblon opens widely. We would rather tell you that
          than pretend.
        </p>
      </div>
    </AboutShell>
  )
}

/*
 * The three addresses people linked to before the hub existed still answer,
 * by sending the reader to the one copy. A second rendering of the same
 * wording at a second address is how two privacy pages start disagreeing.
 */
export function Terms() { return <Navigate to="/policies/terms" replace /> }
export function Guidelines() { return <Navigate to="/policies/guidelines" replace /> }
export function Privacy() { return <Navigate to="/policies/privacy" replace /> }
