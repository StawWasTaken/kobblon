import { Link } from 'react-router-dom'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Button } from '@/components/ui/Button'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band } from '@/components/about/Band'
import { Hero } from '@/components/about/Hero'
import { Reveal } from '@/components/about/Reveal'
import { Tally } from '@/components/about/Tally'
import { Figure } from '@/components/about/Figure'
import { Plate } from '@/components/about/Plate'
import { BandHead, Title } from '@/components/about/Type'
import { useAsync } from '@/hooks/useAsync'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import { getPlatformStats } from '@/lib/api'
import { currency } from '@/lib/currency'

/**
 * What Kobblon is, for somebody who has never heard of it.
 *
 * This page is a pitch, and the first two attempts at it were not. They
 * explained Kobblon the way a manual explains a feature - four tiles of
 * three sentences each, a heading that asked a question, a band that
 * apologised for what was not finished yet. Staw, and he is right: "it
 * looks like a ChatGPT answer".
 *
 * The shape it follows now is the one a company's own film follows. A
 * sentence at a time, each one a claim about what this is rather than a
 * description of where to click, and each one standing next to the thing
 * it is talking about. Nothing on this page is a list. Nothing on it is
 * three sentences where one will do.
 *
 * The one rule it keeps from before: the numbers are read from the
 * database. Confidence is a way of writing; an invented figure is a lie,
 * and it is the kind that gets found out by anybody who can count the
 * Worlds on Discover.
 *
 * It must also not be the landing page in different words. The landing
 * page shows you the site - what is on it, what is popular, where to go.
 * This one says what the site *is*. If a sentence here would work
 * equally well on the front page, it belongs on the front page.
 */

export default function About() {
  useTitle('What Kobblon is')
  useSocialCard({
    title: 'What Kobblon is',
    description: 'The platform where the games, the worlds and everything in them are made by the people playing them.',
    image: null,
  })

  const stats = useAsync(() => getPlatformStats(), [])
  const it = stats.data

  return (
    <AboutShell
      hero={
        <Hero
          eyebrow="Kobblon"
          title={<>Everything here was made <span className="text-brand-bright">by somebody here</span>.</>}
          lead="Kobblon is a platform for building: the Worlds, the clothes, the meshes, the sounds, the Communities. One account makes all of it, and plays all of it."
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

      {/* ---------------------------------------------------------- Worlds */}
      <Band tone="raised" edge>
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <BandHead
              eyebrow="Worlds"
              title="At the heart of Kobblon are Worlds."
              lead="A World is a place one person built and published: ground, physics, sound, and whoever walks in. No two of them are alike, because no two people build the same thing."
            />
            <div className="mt-9">
              <Button to="/discover" variant="subtle">Go somewhere</Button>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <Figure
              src="/brand/landing-interior.png"
              alt="The inside of a room built in Kobblon, lit through two windows"
              ratio="wide"
            />
          </Reveal>
        </div>
      </Band>

      {/* ----------------------------------------------------- the three */}
      <Band tone="night" edge>
        <Reveal>
          <BandHead
            eyebrow="What runs underneath"
            title="Three things hold it up."
            lead="A marketplace to build out of, a currency that stays inside, and a reason to come back tomorrow."
          />
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {[
            {
              to: '/create',
              art: '/about/marketplace.png',
              alt: 'Glass shapes: a cube, a sphere and a wedge',
              name: 'The Marketplace',
              body: 'Meshes, sounds, decals and fonts, uploaded by the people who made them and used by everybody else. Nothing on Kobblon was shipped with it.',
            },
            {
              to: '/policies/money',
              art: '/about/brix.png',
              alt: 'Glass Kobblon bricks, falling',
              name: currency.plural,
              body: `${currency.plural} are what Kobblon runs on. Earned from playing and from selling, spent on what other people made, and they never leave the platform.`,
            },
            {
              to: '/quests',
              art: '/about/quests.png',
              alt: 'A glass laurel wreath',
              name: 'Quests',
              body: 'Something to go and do, set by Kobblon and by the people who build the Worlds, paid in Brix when it is done.',
            },
          ].map((one, at) => (
            <Reveal key={one.name} delay={at * 80} className="h-full">
              <Link
                to={one.to}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-card/60 transition-[border-color,transform] hover:-translate-y-1 hover:border-brand-bright/50"
              >
                <Plate src={one.art} alt={one.alt} />
                <span className="flex flex-1 flex-col p-7">
                  <span className="font-display text-2xl font-extrabold">{one.name}</span>
                  <span className="mt-3 flex-1 leading-relaxed text-white/55">{one.body}</span>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-link">
                    Look
                    <Glyph icon={faArrowRight} className="text-xs transition-transform group-hover:translate-x-1" />
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Band>

      {/* ------------------------------------------------------ Communities */}
      <Band tone="raised" edge>
        <Reveal>
          <BandHead
            centre
            eyebrow="Communities"
            title="Nobody builds anything good alone."
            lead="Fan clubs, build teams and hobby corners, each with a wall, its own ranks and funds of its own. The work that lasts on Kobblon comes out of them."
          />
          <div className="mt-9 flex justify-center">
            <Button to="/communities" variant="subtle">See the Communities</Button>
          </div>
        </Reveal>
      </Band>

      {/* --------------------------------------------------------- the parts */}
      <Band tone="night" edge>
        <Reveal>
          <BandHead eyebrow="How it runs" title="Three pieces, one account." />
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ['The website', 'Find Worlds, people and Communities. Everything you own lives here.'],
            ['The Launcher', 'Where a World actually runs. An application, not a browser tab.'],
            ['Creator', 'Where a World is built, published, and changed again afterwards.'],
          ].map(([name, body], at) => (
            <Reveal key={name} delay={at * 70} className="h-full">
              <div className="h-full rounded-3xl border border-white/10 bg-ink-card/50 p-7">
                <p className="font-display text-xl font-extrabold">{name}</p>
                <p className="mt-3 leading-relaxed text-white/55">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Band>

      {/* ---------------------------------------------------------- the rules */}
      <Band tone="raised" edge>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
          <Reveal className="min-w-0 flex-1">
            <Title>The rules are written down.</Title>
            <p className="mt-4 max-w-2xl leading-relaxed text-white/55">
              Nine policies, each at its own address, in plain words. A decision against your
              account can be argued with, and your standing page says exactly where you are.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <Button to="/policies" variant="subtle" size="lg">Read them</Button>
          </Reveal>
        </div>
      </Band>
    </AboutShell>
  )
}
