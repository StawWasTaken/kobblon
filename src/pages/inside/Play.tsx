import { Icon, type KobIcon } from '@/components/brand/Icon'
import { Button } from '@/components/ui/Button'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band } from '@/components/about/Band'
import { Hero } from '@/components/about/Hero'
import { Reveal } from '@/components/about/Reveal'
import { Figure } from '@/components/about/Figure'
import { Parallax } from '@/components/about/Parallax'
import { Floaters } from '@/components/about/Floaters'
import { StatTile } from '@/components/about/Tally'
import { BandHead } from '@/components/about/Type'
import { InsideNav } from '@/components/about/InsideNav'
import { useAsync } from '@/hooks/useAsync'
import { useAtTitle, useSocialCard } from '@/hooks/useTitle'
import { getPlatformStats } from '@/lib/api'

/**
 * Play, the second of the three Inside Kobblon pages.
 *
 * The numbers on this page come from `platform_stats` and nowhere else.
 * Staw's rule for the About side holds hardest here: never write a figure
 * somebody can check against Discover and find wrong. If the database is
 * quiet the band simply does not draw, which is better than a page
 * confidently saying nothing.
 *
 * And it says "a World", not "a game". A World is the thing somebody built
 * and published; what happens inside it is up to them.
 */

const together: { icon: KobIcon; name: string; body: string }[] = [
  {
    icon: 'playing',
    name: 'See where they are',
    body: 'Your friends list says who is in a World right now, and which one. One press and you are standing next to them.',
  },
  {
    icon: 'voice-user',
    name: 'Talk',
    body: 'Voice and chat in the World. Anybody being a pest goes quiet for you the moment you say so.',
  },
  {
    icon: 'people',
    name: 'Communities',
    body: 'Fan clubs, build teams and hobby corners, each with a wall, ranks and funds of its own.',
  },
  {
    icon: 'laurel-quest',
    name: 'Quests',
    body: 'Something to go and do, set by Kobblon and by the people who build the Worlds.',
  },
]

export default function InsidePlay() {
  useAtTitle('Play')
  useSocialCard({
    title: 'Play - Kobblon',
    description: 'Every World here was built and published by one person. Walk in and see what they did with it.',
    image: null,
  })

  const stats = useAsync(() => getPlatformStats(), [])
  const it = stats.data

  return (
    <AboutShell
      hero={(
        <Hero
          eyebrow="Inside Kobblon"
          title={<>Every door here <span className="text-brand-bright">opens</span>.</>}
          lead="Nothing on Kobblon is a demo. Every World in Discover is finished enough that somebody pressed publish, and you can be inside any one of them in about four seconds."
          actions={(
            <>
              <Button to="/discover" variant="yes" size="lg">Find a World</Button>
              <Button to="/download" variant="subtle" size="lg">Build one</Button>
            </>
          )}
          art={(
            <Parallax strength={40}>
              <Figure
                src="/about/play.webp"
                alt="A player and a play mark"
                ratio="tall"
              />
            </Parallax>
          )}
        />
      )}
    >
      {/* ------------------------------------------------------- the numbers */}
      {it && (
        <Band tone="night" edge decor={<Floaters />}>
          <Reveal className="relative z-10">
            <BandHead
              eyebrow="Right now"
              title="Not a mock-up. These are today's."
            />
          </Reveal>
          <div className="relative z-10 mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: it.published_spaces, label: 'Worlds published', icon: 'world' as KobIcon },
              { value: it.total_visits, label: 'Visits, all time', icon: 'click' as KobIcon },
              { value: it.total_accounts, label: 'People', icon: 'people' as KobIcon },
              { value: it.people_online, label: 'Online this minute', icon: 'circle-user' as KobIcon },
            ].map((one, at) => (
              <Reveal key={one.label} delay={at * 70}>
                <StatTile value={one.value} label={one.label} icon={one.icon} delay={at * 70} />
              </Reveal>
            ))}
          </div>
        </Band>
      )}

      {/* -------------------------------------------------------- what it is */}
      <Band tone="raised" edge>
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <Parallax strength={52}>
              <Figure
                src="/brand/landing-towers.webp"
                alt="Two towers built in Kobblon, standing on open ground under a blue sky"
                ratio="wide"
              />
            </Parallax>
          </Reveal>
          <Reveal delay={90}>
            <BandHead
              title="A World is somebody's afternoon."
              lead="An obby thrown together in a night, a city somebody has been adding to since the first week, a shop that is really just a place to sit about in. They are all here, and the person who made each one is a name you can go and look at."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/discover" variant="subtle">Discover</Button>
              <Button to="/people" variant="ghost">The people</Button>
            </div>
          </Reveal>
        </div>
      </Band>

      {/* ---------------------------------------------------------- together */}
      <Band tone="night" edge>
        <Reveal>
          <BandHead
            eyebrow="Nobody plays alone"
            title="The point was never the World on its own."
            lead="It is who you dragged into it."
          />
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {together.map((one, at) => (
            <Reveal key={one.name} delay={at * 70}>
              <div className="flex h-full gap-4 rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
                <Icon name={one.icon} className="h-9 w-9 shrink-0" />
                <div>
                  <p className="font-display text-lg font-extrabold">{one.name}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/65">{one.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Band>

      {/* ------------------------------------------------------ then build one */}
      <Band tone="raised" edge>
        <Reveal className="mx-auto max-w-3xl text-center">
          <BandHead
            centre
            title="And when you have had enough of other people's Worlds."
            lead="Kobblon Workspace is free, it is on your desktop, and the thing you publish in it is in Discover beside everything else. No approval queue, no deal, no cut taken before you have earned anything."
          />
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button to="/download" variant="yes" size="lg">Get Workspace</Button>
            <Button to="/create" variant="subtle" size="lg">Creator Hub</Button>
          </div>
        </Reveal>
      </Band>

      <InsideNav not="play" />
    </AboutShell>
  )
}
