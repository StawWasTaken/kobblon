import { Link, Navigate, useParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faArrowRight, faScaleBalanced, faShieldHalved, faCircleInfo,
} from '@fortawesome/free-solid-svg-icons'
import { PixelField } from '@/components/brand/PixelField'
import { StoryPage } from '@/components/layout/StoryPage'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { AboutNav } from '@/components/layout/AboutNav'
import { policies, policyBySlug } from '@/content/policies'
import { useForceDark } from '@/hooks/useTheme'
import { useTitle } from '@/hooks/useTitle'

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
  useForceDark()
  useTitle('Policies')

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-white">
      <PixelField className="opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(80rem_44rem_at_50%_-15%,rgba(27,52,232,0.4),transparent_62%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/85 to-ink" />

      <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-8">
        <AboutNav />

        <section className="py-12 sm:py-20">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-white/40">
            The rules
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-extrabold leading-[0.9] sm:text-7xl">
            Policies
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/60">
            Everything Kobblon expects of you and everything you can expect back, split by
            subject so a rule can be pointed at rather than searched for.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          {policies.map((policy) => (
            <Link
              key={policy.slug}
              to={`/policies/${policy.slug}`}
              className="group flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
                {policy.eyebrow}
              </p>
              <h2 className="mt-2 font-display text-2xl font-extrabold">{policy.title}</h2>
              <p className="mt-2 flex-1 leading-relaxed text-white/60">{policy.blurb}</p>
              <p className="mt-5 flex items-center gap-2 text-sm font-bold text-white/40">
                <span className="tabular-nums">Changed {readable(policy.updated)}</span>
                <Glyph
                  icon={faArrowRight}
                  className="ml-auto text-link transition-transform group-hover:translate-x-1"
                />
              </p>
            </Link>
          ))}
        </div>

        {/* Where the rules stop being reading and start being your account. */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <Link
            to="/standing"
            className="flex items-start gap-4 rounded-3xl border border-white/10 bg-ink-card/70 p-6 transition-colors hover:border-white/25"
          >
            <Glyph icon={faScaleBalanced} className="mt-1 text-xl text-brand-bright" />
            <span>
              <span className="block font-display text-lg font-extrabold">Where you stand</span>
              <span className="mt-1 block text-sm leading-relaxed text-white/55">
                Every decision against your account, what it switched off, and how to appeal it.
              </span>
            </span>
          </Link>
          <Link
            to="/support"
            className="flex items-start gap-4 rounded-3xl border border-white/10 bg-ink-card/70 p-6 transition-colors hover:border-white/25"
          >
            <Glyph icon={faShieldHalved} className="mt-1 text-xl text-brand-bright" />
            <span>
              <span className="block font-display text-lg font-extrabold">Write to us</span>
              <span className="mt-1 block text-sm leading-relaxed text-white/55">
                A ticket goes to a person, and the reply lands in your Kobblon inbox.
              </span>
            </span>
          </Link>
        </div>

        <p className="mb-14 mt-10 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed text-white/45">
          <Glyph icon={faCircleInfo} className="mt-0.5 text-white/30" />
          These pages are written plainly and say what actually happens. They have not been
          through a lawyer yet. They will be before Kobblon opens widely, and this note will go
          when that is done rather than before.
        </p>
      </div>

      <SiteFooter className="relative border-white/10 bg-transparent" />
    </div>
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
