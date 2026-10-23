import { Link } from 'react-router-dom'
import {
  faArrowRight, faUsers, faShapes, faShirt, faWandMagicSparkles,
  faPenRuler, faDownload, faScaleBalanced,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import type { KobIcon } from '@/components/brand/Icon'
import { Button } from '@/components/ui/Button'
import { CurrencyMark } from '@/components/brand/Currency'
import { AboutShell } from '@/components/layout/AboutShell'
import { useAsync } from '@/hooks/useAsync'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import { getPlatformStats } from '@/lib/api'
import { currency } from '@/lib/currency'
import { formatCount } from '@/lib/format'

/**
 * What Kobblon is, for somebody who has never heard of it.
 *
 * Everything on this page is something the platform does today. There is
 * no roadmap on it and no number that is not read from the database: a
 * front page that promises a thing nobody has built is the one kind of
 * copy this project has sworn off.
 */

/** The four things you can do, each with the page that does it. */
const doings: {
  to: string
  label: string
  body: string
  icon: IconDefinition
  ours?: KobIcon
}[] = [
  {
    to: '/discover',
    label: 'Go somewhere',
    body: 'Worlds people built and published. Walk in, look around, leave a mark.',
    icon: faShapes,
    ours: 'world',
  },
  {
    to: '/create',
    label: 'Build something',
    body: 'Worlds in Creator, and a marketplace of meshes, sounds, decals and fonts to build them from.',
    icon: faPenRuler,
    ours: 'assets',
  },
  {
    to: '/communities',
    label: 'Join a Community',
    body: 'Fan clubs, build teams and hobby corners, each with its own wall, ranks and funds.',
    icon: faUsers,
  },
  {
    to: '/catalog',
    label: 'Be somebody',
    body: 'An avatar you own, dressed in things other people made and sold.',
    icon: faShirt,
  },
]

/** The three pieces of Kobblon, and what each one is for. */
const pieces: { name: string; body: string; icon: IconDefinition }[] = [
  {
    name: 'The website',
    body: 'Where you find Worlds, people, Communities and everything you own.',
    icon: faShapes,
  },
  {
    name: 'The Launcher',
    body: 'Where a World actually runs. Not a browser tab.',
    icon: faDownload,
  },
  {
    name: 'Creator',
    body: 'Where a World is built, published, and changed afterwards.',
    icon: faPenRuler,
  },
]

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <p className="font-display text-2xl font-extrabold tabular-nums sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/40">{label}</p>
    </div>
  )
}

function Heading({ children }: { children: string }) {
  return (
    <h2 className="font-display text-3xl font-extrabold sm:text-4xl">{children}</h2>
  )
}

export default function About() {
  useTitle('What Kobblon is')
  useSocialCard({
    title: 'What Kobblon is',
    description: 'A place to build something, put it somewhere, and have people turn up.',
    image: null,
  })

  const stats = useAsync(() => getPlatformStats(), [])
  const it = stats.data

  return (
    <AboutShell
      eyebrow="About"
      title={<>The game built <span className="text-brand-bright">by players</span></>}
      lead="Kobblon is a place to make something, put it somewhere, and have people turn up to see it. Everything on it was made by somebody using it."
      actions={
        <>
          <Button to="/signup" variant="yes" size="lg">Make an account</Button>
          <Button to="/discover" variant="subtle" size="lg">Look around first</Button>
        </>
      }
      wide
    >
      <div className="space-y-20 sm:space-y-28">
        {/* ------------------------------------------------------ numbers */}
        {it && (
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat value={formatCount(it.published_spaces)} label="Worlds published" />
            <Stat value={formatCount(it.total_visits)} label="Visits" />
            <Stat value={formatCount(it.total_accounts)} label="People" />
            <Stat value={formatCount(it.people_online)} label="Online now" />
          </div>
        )}

        {/* --------------------------------------------------- what you do */}
        <section>
          <Heading>What you can do here</Heading>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {doings.map((one) => (
              <Link
                key={one.to}
                to={one.to}
                className="group flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-brand-bright">
                  {one.ours
                    ? <Icon name={one.ours} tone="currentColor" className="h-5 w-5" />
                    : <Glyph icon={one.icon} />}
                </span>
                <p className="mt-4 font-display text-xl font-extrabold">{one.label}</p>
                <p className="mt-2 flex-1 text-sm text-white/55">{one.body}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-link">
                  Open
                  <Glyph
                    icon={faArrowRight}
                    className="text-xs transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------- the parts */}
        <section>
          <Heading>How it runs</Heading>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {pieces.map((one) => (
              <div key={one.name} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <Glyph icon={one.icon} className="text-brand-bright" />
                <p className="mt-4 font-display text-lg font-extrabold">{one.name}</p>
                <p className="mt-2 text-sm text-white/55">{one.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Button to="/download" icon={faDownload} variant="subtle">Get the Launcher</Button>
          </div>
        </section>

        {/* ---------------------------------------------------------- Brix */}
        <section className="grid gap-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:grid-cols-[1fr_1fr] sm:items-center sm:p-10">
          <div>
            <p className="flex items-center gap-2.5 text-xs font-extrabold uppercase tracking-[0.22em] text-white/40">
              <CurrencyMark className="h-4 w-4" />
              {currency.plural}
            </p>
            <Heading>{`Earned here, spent here`}</Heading>
            <p className="mt-4 text-sm text-white/55">
              {currency.plural} are what Kobblon runs on. You earn them from quests and from
              what you sell, and spend them on what other people made. They are not money and
              they do not come out.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button to="/quests" icon={faWandMagicSparkles} variant="subtle">Quests</Button>
              <Button to="/policies/money" variant="ghost">
                The {currency.plural} policy
              </Button>
            </div>
          </div>

          <ul className="space-y-2.5">
            {[
              'Quests pay for playing, and the daily one comes back every day.',
              'Sell what you make in the Catalog or the marketplace and keep most of it.',
              'Every movement lands on your transactions, which only you can read.',
            ].map((line) => (
              <li
                key={line}
                className="rounded-2xl border border-white/10 bg-ink-card/60 px-4 py-3 text-sm text-white/65"
              >
                {line}
              </li>
            ))}
          </ul>
        </section>

        {/* --------------------------------------------------- the rules */}
        <section className="flex flex-wrap items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <Glyph icon={faScaleBalanced} className="text-3xl text-brand-bright" />
          <div className="min-w-0 flex-1">
            <Heading>The rules are written down</Heading>
            <p className="mt-3 text-sm text-white/55">
              Nine policies, each at its own address, in plain words. Moderation decisions can
              be argued with, and your standing page says exactly where you are.
            </p>
          </div>
          <Button to="/policies" variant="subtle">Read them</Button>
        </section>

        {/* ----------------------------------------------------------- end */}
        <section className="rounded-3xl border border-brand/30 bg-gradient-to-br from-brand/20 to-transparent p-10 text-center">
          <Heading>Make something nobody else has</Heading>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button to="/signup" variant="yes" size="lg">Make an account</Button>
            <Button to="/discover" variant="subtle" size="lg">See what is here</Button>
          </div>
        </section>
      </div>
    </AboutShell>
  )
}
