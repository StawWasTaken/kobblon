import { Link } from 'react-router-dom'
import { faArrowRight, faScaleBalanced, faAward } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon, type KobIcon } from '@/components/brand/Icon'
import { Button } from '@/components/ui/Button'
import { CurrencyMark } from '@/components/brand/Currency'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band } from '@/components/about/Band'
import { Hero } from '@/components/about/Hero'
import { Reveal } from '@/components/about/Reveal'
import { Tally } from '@/components/about/Tally'
import { Figure, Character } from '@/components/about/Figure'
import { BandHead, Title } from '@/components/about/Type'
import { PixelGrid } from '@/components/about/Motif'
import { useAsync } from '@/hooks/useAsync'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import { getPlatformStats } from '@/lib/api'
import { currency } from '@/lib/currency'

/**
 * What Kobblon is, for somebody who has never heard of it.
 *
 * Everything on this page is something the platform does today. There is
 * no roadmap on it and no number that is not read from the database: a
 * front page that promises a thing nobody has built is the one kind of
 * copy this project has sworn off. The band near the bottom that says
 * what is *not* finished is there for the same reason - the honest
 * version of a front page is the one that does not have to be walked back
 * the first time somebody clicks Download.
 *
 * The icons are ours. Staw: "stop using different svg icons for stuff
 * that we already have". A World is his World drawing, a Community is his
 * people drawing, a quest is the laurel, a price is the Brix mark; Font
 * Awesome is left for the one or two ideas he has not drawn yet.
 */

/** The four things you can do, each with the page that does it. */
const doings: { to: string; label: string; body: string; icon: KobIcon }[] = [
  {
    to: '/discover',
    label: 'Go somewhere',
    body: 'Worlds people built and published. Walk in, look around, leave a mark.',
    icon: 'world',
  },
  {
    to: '/create',
    label: 'Build something',
    body: 'Worlds in Creator, and a marketplace of meshes, sounds, decals and fonts to build them out of.',
    icon: 'assets',
  },
  {
    to: '/communities',
    label: 'Join a Community',
    body: 'Fan clubs, build teams and hobby corners, each with its own wall, its ranks and its funds.',
    icon: 'people',
  },
  {
    to: '/catalog',
    label: 'Be somebody',
    body: 'An avatar that is yours, dressed in things other people made and put up for sale.',
    icon: 'avatar',
  },
]

/** The three pieces of Kobblon, in the order you meet them. */
const pieces = [
  {
    name: 'The website',
    body: 'Where you find Worlds, people and Communities, and where everything you own lives.',
  },
  {
    name: 'The Launcher',
    body: 'Where a World actually runs. It is an application, not a browser tab.',
  },
  {
    name: 'Creator',
    body: 'Where a World is built, published, and changed again afterwards.',
  },
]

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
      hero={
        <Hero
          eyebrow="What Kobblon is"
          title={<>The game built <span className="text-brand-bright">by players</span></>}
          lead="A place to make something, put it somewhere, and have people turn up to see it. Everything on Kobblon was made by somebody using it."
          actions={
            <>
              <Button to="/signup" variant="yes" size="lg">Make an account</Button>
              <Button to="/discover" variant="subtle" size="lg">Look around first</Button>
            </>
          }
          art={
            <Figure
              src="/brand/landing-towers.webp"
              alt="Two towers built in Kobblon, standing on open ground under a blue sky"
              ratio="screen"
              caption="A World somebody built and published."
            />
          }
        />
      }
    >
      {/* ------------------------------------------------------- the numbers */}
      {it && (
        <Band tone="night" tight edge>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-6">
            {[
              { value: it.published_spaces, label: 'Worlds published' },
              { value: it.total_visits, label: 'Visits' },
              { value: it.total_accounts, label: 'People' },
              { value: it.people_online, label: 'Online now' },
            ].map((one, at) => (
              <Reveal key={one.label} delay={at * 70}>
                <Tally value={one.value} label={one.label} />
              </Reveal>
            ))}
          </div>
        </Band>
      )}

      {/* ------------------------------------------------------ what you do */}
      <Band tone="raised" edge>
        <Reveal>
          <BandHead
            eyebrow="The short version"
            title="Four things you can do here"
            lead="Every one of them is a page you can open right now, signed in or not."
          />
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {doings.map((one, at) => (
            <Reveal key={one.to} delay={at * 70} className="h-full">
              <Link
                to={one.to}
                className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-card/60 p-7 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-brand-bright/50 hover:bg-ink-card"
              >
                <PixelGrid from="top-right" className="opacity-40 transition-opacity duration-500 group-hover:opacity-80" />
                <span className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-brand/15">
                  <span className="absolute inset-0 rounded-2xl bg-brand/30 opacity-0 blur-lg transition-opacity group-hover:opacity-100" />
                  <Icon name={one.icon} tone="currentColor" className="relative h-7 w-7 text-brand-bright" />
                </span>
                <p className="relative mt-6 font-display text-2xl font-extrabold">{one.label}</p>
                <p className="relative mt-3 flex-1 leading-relaxed text-white/55">{one.body}</p>
                <span className="relative mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-link">
                  Open
                  <Glyph icon={faArrowRight} className="text-xs transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Band>

      {/* -------------------------------------------------------- the parts */}
      <Band tone="night" edge>
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <Figure
              src="/brand/landing-interior.png"
              alt="The inside of a room built in Kobblon, lit through two windows"
              ratio="wide"
              caption="Built, lit and published by hand."
            />
          </Reveal>

          <Reveal delay={90}>
            <BandHead eyebrow="How it runs" title="Three pieces, one account" />
            <ol className="mt-9 space-y-5">
              {pieces.map((one, at) => (
                <li key={one.name} className="flex gap-5">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] font-display text-sm font-extrabold tabular-nums text-brand-bright">
                    {at + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-extrabold">{one.name}</span>
                    <span className="mt-1 block leading-relaxed text-white/55">{one.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-9">
              <Button to="/download" variant="subtle">Get the Launcher</Button>
            </div>
          </Reveal>
        </div>
      </Band>

      {/* -------------------------------------------------------------- Brix */}
      <Band tone="raised" edge>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-ink-card/60 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/50">
              <CurrencyMark className="h-4 w-4" />
              {currency.plural}
            </span>
            <Title className="mt-6">Earned here, spent here</Title>
            <p className="mt-5 max-w-xl leading-relaxed text-white/55">
              {currency.plural} are what Kobblon runs on. You earn them from quests and from what
              you sell, and you spend them on what other people made. They are not money and they
              do not come back out.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/quests" variant="subtle" icon={faAward} iconName="laurel-quest">Quests</Button>
              <Button to="/policies/money" variant="ghost">The {currency.plural} policy</Button>
            </div>
          </Reveal>

          <ul className="space-y-3">
            {[
              { icon: 'laurel-quest' as KobIcon, line: 'Quests pay for playing, and the daily one comes back every day.' },
              { icon: 'assets' as KobIcon, line: 'Sell what you make in the Catalog or the marketplace and keep most of it.' },
              { icon: 'brix' as KobIcon, line: 'Every movement lands on your transactions, which only you can read.' },
            ].map((one, at) => (
              <Reveal key={one.line} as="li" delay={at * 80}>
                <span className="flex items-center gap-4 rounded-2xl border border-white/10 bg-ink-card/60 px-5 py-5">
                  <Icon name={one.icon} tone="currentColor" className="h-6 w-6 shrink-0 text-brand-bright" />
                  <span className="leading-relaxed text-white/65">{one.line}</span>
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
      </Band>

      {/* ---------------------------------------------------------- the rules */}
      <Band tone="night" edge>
        <Reveal>
          <div className="flex flex-col items-start gap-8 rounded-3xl border border-white/10 bg-ink-card/50 p-9 sm:flex-row sm:items-center sm:p-11">
            <Glyph icon={faScaleBalanced} className="text-4xl text-brand-bright" />
            <div className="min-w-0 flex-1">
              <Title>The rules are written down</Title>
              <p className="mt-4 max-w-2xl leading-relaxed text-white/55">
                Nine policies, each at its own address, in plain words. A moderation decision can
                be argued with, and your standing page says exactly where you are and why.
              </p>
            </div>
            <Button to="/policies" variant="subtle" size="lg">Read them</Button>
          </div>
        </Reveal>
      </Band>

      {/* ------------------------------------------------- what is not done */}
      <Band tone="raised" edge>
        <div className="grid items-center gap-12 sm:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <Character
              src="/brand/under_construction.png"
              alt="A Kobblon character in a branded shirt and cap, holding a hammer"
            />
          </Reveal>
          <Reveal delay={90}>
            <BandHead
              eyebrow="Being honest"
              title="Kobblon is not finished"
              lead="It is weeks old. Rather than hide that, here is what is still coming, so nothing on this page is a promise you have to find out about later."
            />
            <ul className="mt-8 space-y-3">
              {[
                'The Launcher is being built. There is nothing to download yet.',
                'The policies say what actually happens today, and have not been through a lawyer.',
                'Pages get rebuilt often, so what you see this week may look different next week.',
              ].map((line) => (
                <li
                  key={line}
                  className="rounded-2xl border border-white/10 bg-ink-card/60 px-5 py-4 leading-relaxed text-white/60"
                >
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Band>

      {/* ----------------------------------------------------------- the ask */}
      <Band tone="brand">
        <Reveal className="text-center">
          <Title className="mx-auto max-w-3xl">Make something nobody else has</Title>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-white/60">
            An account is free, takes a minute, and is the only thing between you and building.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button to="/signup" variant="yes" size="lg">Make an account</Button>
            <Button to="/discover" variant="subtle" size="lg">See what is here</Button>
          </div>
        </Reveal>
      </Band>
    </AboutShell>
  )
}
