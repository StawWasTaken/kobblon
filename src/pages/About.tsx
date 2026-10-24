import { Link } from 'react-router-dom'
import { faArrowRight, faArrowDown } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon, type KobIcon } from '@/components/brand/Icon'
import { Button } from '@/components/ui/Button'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band, Lane } from '@/components/about/Band'
import { Reveal } from '@/components/about/Reveal'
import { StatTile } from '@/components/about/Tally'
import { Figure } from '@/components/about/Figure'
import { GlassCard } from '@/components/about/GlassCard'
import { Floaters } from '@/components/about/Floaters'
import { Parallax } from '@/components/about/Parallax'
import { ScrollIn } from '@/components/about/ScrollIn'
import { PixelGrid } from '@/components/about/Motif'
import { BandHead, Title } from '@/components/about/Type'
import { useAsync } from '@/hooks/useAsync'
import { useAtTitle, useSocialCard } from '@/hooks/useTitle'
import { asset } from '@/lib/asset'
import { getPlatformStats } from '@/lib/api'
import { currency } from '@/lib/currency'

/**
 * What is Kobblon, for somebody who has never heard of it.
 *
 * The page is a scroll, in Staw's order: a few words over something
 * somebody built, then the paragraph that says what this is, then the
 * numbers, then Worlds, then what keeps it safe, then Workspace, then
 * what it runs on, then Communities, then the rules, then the newsroom.
 *
 * Three rules for anybody editing it:
 *
 *   * **A band is a heading, one line, and the way in.** If a second
 *     sentence is needed to make the first land, the first is wrong.
 *   * **The numbers come from the database.** Write with confidence; do
 *     not invent a figure anybody can check against Discover.
 *   * **This is not the landing page in other words.** The landing page
 *     shows you the site. This one says what the site is.
 */

/** The three pieces underneath, one line each. */
const inside = [
  {
    to: '/create',
    art: '/about/marketplace.png',
    alt: 'Glass shapes: a cube, a sphere and a wedge',
    name: 'Marketplace',
    body: 'Meshes, sounds, decals and fonts to build out of, uploaded by the people who made them.',
  },
  {
    to: '/policies/money',
    art: '/about/brix.png',
    alt: 'Glass Kobblon bricks, falling',
    name: currency.plural,
    body: `What Kobblon runs on. Earned playing and selling, spent on what other people made.`,
  },
  {
    to: '/quests',
    art: '/about/quests.png',
    alt: 'A glass laurel wreath',
    name: 'Quests',
    body: 'Something to go and do, set by Kobblon and by the people who build the worlds.',
  },
]

/**
 * What a person can do about somebody else, and what Kobblon does about
 * both of them. Every one of these is built and working today.
 */
const safety: { icon: KobIcon; name: string; body: string }[] = [
  { icon: 'report', name: 'Report', body: 'Anything, anywhere, and it goes to a person. Who reported it is never shown.' },
  { icon: 'remove-user', name: 'Block', body: 'They cannot write to you, find you, or follow you into a World.' },
  { icon: 'cross-user', name: 'Ignore', body: 'Quieter than a block: you simply stop seeing them.' },
  { icon: 'admin', name: 'Moderation', body: 'Decisions come with a reason, and every one of them can be appealed.' },
]

export default function About() {
  useAtTitle('What is Kobblon')
  useSocialCard({
    title: 'What is Kobblon',
    description: 'An online sandbox platform filled with user-generated 3D worlds.',
    image: null,
  })

  const stats = useAsync(() => getPlatformStats(), [])
  const it = stats.data

  return (
    <AboutShell
      /*
       * One extra screen of holding. The title is fully in at about
       * two-thirds of it, so the opening keeps still for a moment after it
       * has arrived and then hands the page over - which is the bit that
       * makes it read as "it let go" rather than as "it stuck".
       */
      pin={1}
      backdrop={
        <Parallax strength={90} className="absolute inset-0">
          <img
            src={asset('/about/towers-sunset.webp')}
            alt=""
            aria-hidden="true"
            className="h-[115%] w-full object-cover object-top"
          />
        </Parallax>
      }
      hero={
        <Lane className="flex h-full flex-col justify-center py-24 text-center">
          {/* ScrollIn rather than Reveal: this is the first screen, so it is
              already on screen at load and a Reveal would have finished before
              anybody scrolled. Staw wants it to arrive on the way down, and
              the shell holds the page still while it does. */}
          <ScrollIn over={0.66}>
            <h1 className="font-display text-[clamp(2.6rem,7vw,5.5rem)] font-extrabold leading-[0.95] tracking-tight drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)]">
              Everything you see here,
              <br />
              <span className="text-brand-bright">somebody made it</span>.
            </h1>
          </ScrollIn>
          <Reveal delay={260}>
            <p className="mt-10 flex items-center justify-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/50">
              Keep going
              <Glyph icon={faArrowDown} className="text-xs" />
            </p>
          </Reveal>
        </Lane>
      }
    >
      {/* ----------------------------------------------- what this actually is */}
      <Band tone="night" edge>
        <Reveal className="mx-auto max-w-3xl text-center">
          <img
            src={asset('/about/wordmark-brush.webp')}
            alt="Kobblon"
            className="mx-auto h-12 w-auto sm:h-16"
          />
          <p className="mt-9 text-xl leading-relaxed text-white/70 sm:text-2xl">
            Kobblon is an online sandbox platform filled with user-generated 3D worlds, where
            players can unleash their creativity, build unique experiences, and hang out together.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button to="/signup" variant="yes" size="lg">Make an account</Button>
            <Button to="/discover" variant="subtle" size="lg">Look around</Button>
          </div>
        </Reveal>
      </Band>

      {/* ------------------------------------------------------- the numbers */}
      {it && (
        <Band tone="raised" edge decor={<Floaters />}>
          <Reveal className="relative z-10">
            <BandHead eyebrow="Kobblon today" title="Counted this minute." />
          </Reveal>
          <div className="relative z-10 mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: it.published_spaces, label: 'Worlds published', icon: 'world' as KobIcon },
              { value: it.total_visits, label: 'Visits', icon: 'click' as KobIcon },
              { value: it.total_accounts, label: 'People', icon: 'people' as KobIcon },
              { value: it.people_online, label: 'Online now', icon: 'circle-user' as KobIcon },
            ].map((one, at) => (
              <Reveal key={one.label} delay={at * 70}>
                <StatTile value={one.value} label={one.label} icon={one.icon} delay={at * 70} />
              </Reveal>
            ))}
          </div>
        </Band>
      )}

      {/* ----------------------------------------------------------- worlds */}
      <Band tone="night" edge>
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <Parallax strength={56}>
              <Figure
                src="/brand/landing-towers.webp"
                alt="Two towers built in Kobblon, standing on open ground under a blue sky"
                ratio="wide"
              />
            </Parallax>
          </Reveal>
          <Reveal delay={90}>
            <BandHead
              eyebrow="Worlds"
              title="Somewhere to be."
              lead="Every world on Kobblon was built and published by one person. Walk in and see what they did with it."
            />
            <div className="mt-8">
              <Button to="/discover" variant="subtle">Discover</Button>
            </div>
          </Reveal>
        </div>
      </Band>

      {/* ----------------------------------------------------------- safety */}
      <Band tone="raised" edge>
        <Reveal>
          <BandHead
            eyebrow="Safety"
            title="You are not stuck with anybody."
            lead="Four things, all of them built and working today."
          />
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {safety.map((one, at) => (
            <Reveal key={one.name} delay={at * 70} className="h-full">
              <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-ink-card/50 p-7">
                <PixelGrid from="bottom-right" className="opacity-30" />
                <Icon name={one.icon} tone="currentColor" className="relative h-7 w-7 text-brand-bright" />
                <p className="relative mt-5 font-display text-xl font-extrabold">{one.name}</p>
                <p className="relative mt-3 leading-relaxed text-white/55">{one.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200}>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button to="/policies/moderation" variant="subtle">How moderation works</Button>
            <Button to="/standing" variant="ghost">Where you stand</Button>
          </div>
        </Reveal>
      </Band>

      {/* -------------------------------------------------------- Workspace */}
      <Band tone="night" edge>
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.15fr]">
          <Reveal>
            <BandHead
              eyebrow="Workspace"
              title="Build it, publish it, see who turns up."
              lead="Worlds are built in Kobblon Workspace on the desktop. Publish one there and it is here, ready for people."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/create" variant="subtle">Start building</Button>
              <Button to="/download" variant="ghost">Get Workspace</Button>
            </div>
          </Reveal>

          <Reveal delay={90}>
            <div className="relative">
              <Parallax strength={48}>
                <Figure
                  src="/about/workspace.png"
                  alt="Kobblon Workspace: the best place to create"
                  ratio="wide"
                />
              </Parallax>
              {/* Standing at the corner of the banner, because the thing being
                  advertised is still being built. Staw asked for him here. */}
              <img
                src={asset('/brand/under_construction.png')}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-10 -left-8 hidden w-24 drop-shadow-[0_18px_30px_rgba(0,0,0,0.6)] sm:block lg:-left-14 lg:w-32"
              />
            </div>
          </Reveal>
        </div>
      </Band>

      {/* --------------------------------------------------- inside Kobblon */}
      <Band tone="raised" edge>
        <Reveal>
          <BandHead eyebrow="Inside Kobblon" title="What it runs on." />
        </Reveal>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {inside.map((one, at) => (
            <Reveal key={one.name} delay={at * 80}>
              <Parallax strength={[22, 40, 28][at]}>
                <GlassCard
                  to={one.to}
                  art={one.art}
                  alt={one.alt}
                  name={one.name}
                  body={one.body}
                />
              </Parallax>
            </Reveal>
          ))}
        </div>
      </Band>

      {/* ------------------------------------------------------ communities */}
      <Band tone="night" edge decor={<Floaters />}>
        <div className="relative z-10 grid items-center gap-14 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <BandHead
              eyebrow="Communities"
              title="Hang out together."
              lead="Fan clubs, build teams and hobby corners, each with a wall, ranks and funds of its own."
            />
            <div className="mt-8">
              <Button to="/communities" variant="subtle">See them</Button>
            </div>
          </Reveal>
          <Reveal delay={90}>
            {/* Something somebody made and sells, rather than a stock
                illustration of people being friends. */}
            <div className="relative grid place-items-center">
              <div className="absolute h-48 w-48 rounded-full bg-brand/30 blur-3xl" />
              <Parallax strength={34}>
                <img
                  src={asset('/about/can.png')}
                  alt="A drinks can somebody made and put in the Catalog"
                  className="relative w-40 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] sm:w-52"
                />
              </Parallax>
            </div>
          </Reveal>
        </div>
      </Band>

      {/* --------------------------------------------------------- policies */}
      <Band tone="raised" edge>
        <Reveal>
          <BandHead
            eyebrow="Policies"
            title="Written down, in plain words."
          />
        </Reveal>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            { to: '/policies/terms', name: 'Terms of Service', body: 'The deal between you and Kobblon.' },
            { to: '/policies/guidelines', name: 'Community Guidelines', body: 'What is fine here, and what is not.' },
            { to: '/policies/privacy', name: 'Privacy', body: 'What is kept about you, and who can see it.' },
          ].map((one, at) => (
            <Reveal key={one.to} delay={at * 70} className="h-full">
              <Link
                to={one.to}
                className="group flex h-full items-center gap-4 rounded-2xl border border-white/10 bg-ink-card/50 px-6 py-5 transition-colors hover:border-brand-bright/50"
              >
                <span className="min-w-0">
                  <span className="block font-display text-lg font-extrabold">{one.name}</span>
                  <span className="mt-1 block text-sm text-white/50">{one.body}</span>
                </span>
                <Glyph
                  icon={faArrowRight}
                  className="ml-auto text-sm text-brand-bright transition-transform group-hover:translate-x-1"
                />
              </Link>
            </Reveal>
          ))}
        </div>
        <Reveal delay={220}>
          <p className="mt-6 text-sm font-semibold text-white/40">
            <Link to="/policies" className="text-link hover:underline">All nine policies</Link>
            {' '}- each at its own address, so support can point at one.
          </p>
        </Reveal>
      </Band>

      {/* --------------------------------------------------------- newsroom */}
      <Band tone="night" edge>
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-card/40 p-9 sm:p-11">
            <PixelGrid from="top-left" className="opacity-30" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-bright">
                  Newsroom
                </p>
                <Title className="mt-4">What is new at Kobblon.</Title>
                {/*
                 * No posts here, and no card that looks like one. The
                 * newsroom is not built; three grey rectangles labelled
                 * "coming soon" is a page pretending to have news.
                 */}
                <p className="mt-4 max-w-xl leading-relaxed text-white/55">
                  Releases, decisions and the occasional apology, in one place. It is being built;
                  until it is here, the Discord is where things get said first.
                </p>
              </div>
              <a
                href="https://discord.gg/SsjvR6rmez"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-sm font-extrabold text-link hover:underline"
              >
                Join the Discord
              </a>
            </div>
          </div>
        </Reveal>
      </Band>
    </AboutShell>
  )
}
