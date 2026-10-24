import { Link, Navigate, useParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faArrowRight, faArrowDown, faScaleBalanced, faShieldHalved, faCircleInfo,
} from '@fortawesome/free-solid-svg-icons'
import { StoryPage } from '@/components/layout/StoryPage'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band, Lane } from '@/components/about/Band'
import { Reveal } from '@/components/about/Reveal'
import { ScrollIn } from '@/components/about/ScrollIn'
import { Parallax } from '@/components/about/Parallax'
import { Floaters } from '@/components/about/Floaters'
import { BandHead } from '@/components/about/Type'
import { policies, policyBySlug } from '@/content/policies'
import { useAtTitle } from '@/hooks/useTitle'
import { asset } from '@/lib/asset'

/** The most recent change across all of them, for the line under the title. */
const newest = policies
  .map((one) => one.updated)
  .sort()
  .reverse()[0]

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

/** Every rule in one place, which is the thing a policy hub is for. */
export default function PolicyHub() {
  useAtTitle('Policies')

  return (
    <AboutShell
      backdrop={
        /*
         * Shapes rather than a World, and that is the one deliberate
         * difference from the other openings on this side: a photograph of
         * somewhere somebody built, over a page about rules, is a picture
         * chosen to make the rules look like something else.
         */
        <Parallax strength={70} className="absolute inset-0">
          <img
            src={asset('/brand/background.png')}
            alt=""
            aria-hidden="true"
            className="h-[115%] w-full object-cover"
          />
        </Parallax>
      }
      hero={
        <Lane className="flex min-h-[62vh] flex-col justify-center py-24 text-center">
          <ScrollIn over={0.22}>
            <h1 className="font-display text-[clamp(2.3rem,6vw,4.75rem)] font-extrabold leading-[0.95] tracking-tight drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)]">
              What we expect,
              <br />
              <span className="text-brand-bright">and what you can expect back</span>.
            </h1>
          </ScrollIn>
          <Reveal delay={200}>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-white/65">
              One subject at a time, in words anybody can read. Nothing here is written to be
              skipped.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <p className="mt-8 flex items-center justify-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/50">
              {policies.length} policies &middot; newest {readable(newest)}
              <Glyph icon={faArrowDown} className="text-xs" />
            </p>
          </Reveal>
        </Lane>
      }
    >
      {/* ------------------------------------------------------ the policies */}
      <Band tone="raised" edge decor={<Floaters />}>
        <Reveal>
          <BandHead eyebrow="All of them" title="Read any of it." />
        </Reveal>

        {/*
         * Numbered, because nine of anything is a list and a list that is
         * not numbered is a wall. The number is also the thing support says
         * out loud when it points somebody at one of these.
         */}
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map((policy, at) => (
            <Reveal key={policy.slug} delay={(at % 3) * 70} className="h-full">
              <Link
                to={`/policies/${policy.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-card/70 p-7 transition-[border-color,background-color,transform] hover:-translate-y-1 hover:border-brand-bright/50 hover:bg-ink-card"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-3 -top-4 font-display text-7xl font-extrabold leading-none text-white/[0.05] transition-colors group-hover:text-brand-bright/15"
                >
                  {String(at + 1).padStart(2, '0')}
                </span>
                <p className="relative text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-bright">
                  {policy.eyebrow}
                </p>
                <h3 className="relative mt-3 font-display text-2xl font-extrabold leading-tight">
                  {policy.title}
                </h3>
                <p className="relative mt-3 flex-1 leading-relaxed text-white/55">{policy.blurb}</p>
                <p className="relative mt-7 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-white/30">
                  <span className="tabular-nums">{readable(policy.updated)}</span>
                  <Glyph
                    icon={faArrowRight}
                    className="ml-auto text-sm text-link transition-transform group-hover:translate-x-1"
                  />
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </Band>

      {/* ------------------------- where the rules stop being reading */}
      <Band tone="night" edge>
        <Reveal>
          <BandHead
            eyebrow="And then"
            title="When a rule is about you."
            lead="Two pages do the rest: one says where your account stands, the other puts you in front of a person."
          />
        </Reveal>
        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {[
            {
              to: '/standing',
              icon: faScaleBalanced,
              name: 'Where you stand',
              body: 'Every decision against your account, what it switched off, and how to appeal it.',
            },
            {
              to: '/support',
              icon: faShieldHalved,
              name: 'Write to us',
              body: 'A ticket goes to a person, and the reply lands in your Kobblon inbox.',
            },
          ].map((one, at) => (
            <Reveal key={one.to} delay={at * 70} className="h-full">
              <Link
                to={one.to}
                className="group flex h-full items-start gap-5 rounded-3xl border border-white/10 bg-ink-card/60 p-7 transition-[border-color,transform] hover:-translate-y-1 hover:border-brand-bright/50"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/15 text-xl text-brand-bright">
                  <Glyph icon={one.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-xl font-extrabold">{one.name}</span>
                  <span className="mt-2 block leading-relaxed text-white/55">{one.body}</span>
                </span>
                <Glyph
                  icon={faArrowRight}
                  className="ml-auto mt-3 shrink-0 text-link transition-transform group-hover:translate-x-1"
                />
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={140}>
          <p className="mt-10 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm leading-relaxed text-white/45">
            <Glyph icon={faCircleInfo} className="mt-0.5 shrink-0 text-white/30" />
            These pages say what actually happens. They have not been through a lawyer yet, and
            will be before Kobblon opens widely.
          </p>
        </Reveal>
      </Band>
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
