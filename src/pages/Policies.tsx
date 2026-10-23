import { Link, Navigate, useParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faArrowRight, faScaleBalanced, faShieldHalved, faCircleInfo,
} from '@fortawesome/free-solid-svg-icons'
import { StoryPage } from '@/components/layout/StoryPage'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band } from '@/components/about/Band'
import { Hero } from '@/components/about/Hero'
import { Reveal } from '@/components/about/Reveal'
import { BandHead } from '@/components/about/Type'
import { policies, policyBySlug } from '@/content/policies'
import { useTitle } from '@/hooks/useTitle'

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
  useTitle(policy?.title ?? 'Policies')

  if (!policy) return <Navigate to="/policies" replace />

  return (
    <StoryPage
      eyebrow={policy.eyebrow}
      title={policy.title}
      intro={policy.intro}
      updated={policy.updated}
      sections={policy.sections}
      footnote={policy.footnote}
      tagline={false}
    />
  )
}

/** Every rule in one place, which is the thing a policy hub is for. */
export default function PolicyHub() {
  useTitle('Policies')

  return (
    <AboutShell
      hero={
        <Hero
          eyebrow="The rules"
          title="Policies"
          lead="Everything Kobblon expects of you and everything you can expect back, one subject at a time, in plain words."
          note={`${policies.length} policies. The newest change was ${readable(newest)}.`}
        />
      }
    >
      {/* ------------------------------------------------------ the policies */}
      <Band tone="raised" edge>
        <div className="grid gap-3 sm:grid-cols-2">
          {policies.map((policy, at) => (
            <Reveal key={policy.slug} delay={(at % 2) * 70} className="h-full">
              <Link
                to={`/policies/${policy.slug}`}
                className="group flex h-full flex-col rounded-3xl border border-white/10 bg-ink-card/60 p-7 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-brand-bright/50 hover:bg-ink-card"
              >
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-bright">
                  {policy.eyebrow}
                </p>
                <h2 className="mt-3 font-display text-2xl font-extrabold">{policy.title}</h2>
                <p className="mt-3 flex-1 leading-relaxed text-white/55">{policy.blurb}</p>
                <p className="mt-6 flex items-center gap-2 text-sm font-bold text-white/35">
                  <span className="tabular-nums">Changed {readable(policy.updated)}</span>
                  <Glyph
                    icon={faArrowRight}
                    className="ml-auto text-link transition-transform group-hover:translate-x-1"
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
            title="When a rule is about you"
            lead="Two pages do the rest: one says where your account stands, the other puts you in front of a person."
          />
        </Reveal>
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
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
                className="group flex h-full items-start gap-5 rounded-3xl border border-white/10 bg-ink-card/60 p-7 transition-colors hover:border-brand-bright/50"
              >
                <Glyph icon={one.icon} className="mt-1 text-2xl text-brand-bright" />
                <span className="min-w-0">
                  <span className="block font-display text-xl font-extrabold">{one.name}</span>
                  <span className="mt-2 block leading-relaxed text-white/55">{one.body}</span>
                </span>
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
