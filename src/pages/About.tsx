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
import { BandHead } from '@/components/about/Type'
import { useAsync } from '@/hooks/useAsync'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import { getPlatformStats } from '@/lib/api'
import { currency } from '@/lib/currency'

/**
 * What Kobblon is, for somebody who has never heard of it.
 *
 * Written short on purpose, and that is the whole brief. Three attempts
 * at this page explained Kobblon; Staw wanted it to *state* Kobblon. The
 * difference is a sentence count - a band here is a heading, one line
 * under it, and the way in. If a second sentence is needed to make the
 * first one land, the first one is wrong.
 *
 * What Kobblon is, in Staw's own words and the words this page opens
 * with: an online sandbox platform filled with user-generated 3D worlds,
 * where players can unleash their creativity, build unique experiences,
 * and hang out together.
 *
 * Two standing rules for anybody editing it:
 *
 *   * The numbers come from the database. Write with confidence; do not
 *     invent a figure anybody can check against Discover.
 *   * This is not the landing page in other words. The landing page shows
 *     you the site. This one says what the site is.
 */

/** The three pieces underneath, one line each. */
const inside = [
  {
    to: '/create',
    art: '/about/marketplace.png',
    alt: 'Glass shapes: a cube, a sphere and a wedge',
    name: 'Marketplace',
    body: 'Meshes, sounds, decals and fonts to build out of, all of it uploaded by somebody here.',
  },
  {
    to: '/policies/money',
    art: '/about/brix.png',
    alt: 'Glass Kobblon bricks, falling',
    name: currency.plural,
    body: `What Kobblon runs on. Earn ${currency.plural} playing and selling, spend them on what other people made.`,
  },
  {
    to: '/quests',
    art: '/about/quests.png',
    alt: 'A glass laurel wreath',
    name: 'Quests',
    body: 'Something to go and do, set by Kobblon and by the people who build the worlds.',
  },
]

export default function About() {
  useTitle('What Kobblon is')
  useSocialCard({
    title: 'What Kobblon is',
    description: 'An online sandbox platform filled with user-generated 3D worlds.',
    image: null,
  })

  const stats = useAsync(() => getPlatformStats(), [])
  const it = stats.data

  return (
    <AboutShell
      hero={
        <Hero
          centre
          title={
            <>
              Kobblon is an online sandbox platform filled with{' '}
              <span className="text-brand-bright">user-generated 3D worlds</span>.
            </>
          }
          lead="Unleash your creativity, build unique experiences, and hang out together."
          actions={
            <>
              <Button to="/signup" variant="yes" size="lg">Make an account</Button>
              <Button to="/discover" variant="subtle" size="lg">Look around</Button>
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

      {/* ----------------------------------------------------------- worlds */}
      <Band tone="raised" edge>
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <Figure
              src="/brand/landing-interior.png"
              alt="The inside of a room built in Kobblon, lit through two windows"
              ratio="wide"
            />
          </Reveal>
          <Reveal delay={90}>
            <BandHead
              eyebrow="Worlds"
              title="Find somewhere to be."
              lead="Every world on Kobblon was built and published by one person."
            />
            <div className="mt-8">
              <Button to="/discover" variant="subtle">Discover</Button>
            </div>
          </Reveal>
        </div>
      </Band>

      {/* ----------------------------------------------------------- create */}
      <Band tone="night" edge>
        <Reveal className="max-w-xl">
          <BandHead
            eyebrow="Creator"
            title="Build anything you can imagine."
            lead="Open Creator, build it, publish it. People turn up the same day."
          />
          <div className="mt-8">
            <Button to="/create" variant="subtle">Start building</Button>
          </div>
        </Reveal>
      </Band>

      {/* --------------------------------------------------- inside Kobblon */}
      <Band tone="raised" edge>
        <Reveal>
          <BandHead eyebrow="Inside Kobblon" title="What it runs on." />
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {inside.map((one, at) => (
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

      {/* ------------------------------------------------------ communities */}
      <Band tone="night" edge>
        {/* Text-only bands are all left, so the eye has one edge to follow
            down the page; only a band with a picture swaps sides. */}
        <Reveal className="max-w-xl">
          <BandHead
            eyebrow="Communities"
            title="Hang out together."
            lead="Fan clubs, build teams and hobby corners, each with a wall, ranks and funds of its own."
          />
          <div className="mt-8">
            <Button to="/communities" variant="subtle">See them</Button>
          </div>
        </Reveal>
      </Band>

      {/* ---------------------------------------------------------- the rules */}
      <Band tone="raised" edge>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
          <Reveal className="min-w-0 flex-1">
            <BandHead
              eyebrow="The rules"
              title="Written down, in plain words."
              lead="Nine policies, each at its own address, and a standing page that says where you are."
            />
          </Reveal>
          <Reveal delay={80}>
            <Button to="/policies" variant="subtle" size="lg">Read them</Button>
          </Reveal>
        </div>
      </Band>
    </AboutShell>
  )
}
