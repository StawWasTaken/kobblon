import { Icon, type KobIcon } from '@/components/brand/Icon'
import { Button } from '@/components/ui/Button'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band } from '@/components/about/Band'
import { Hero } from '@/components/about/Hero'
import { Reveal } from '@/components/about/Reveal'
import { Figure } from '@/components/about/Figure'
import { Parallax } from '@/components/about/Parallax'
import { Floaters } from '@/components/about/Floaters'
import { BandHead } from '@/components/about/Type'
import { InsideNav } from '@/components/about/InsideNav'
import { useAtTitle, useSocialCard } from '@/hooks/useTitle'

/**
 * Report, the first of the three Inside Kobblon pages.
 *
 * Staw asked for these to be written "in a very proud & human way", and
 * not "AI-ish too wordy, too wiki stuff". So the rule for anybody editing
 * this page: say the thing, then stop. No sentence here explains the
 * sentence before it, nothing is hedged, and nothing is described that the
 * platform does not actually do today - a safety page that oversells is
 * worse than no safety page, because the first person it lets down stops
 * believing the rest of it.
 *
 * Everything below is built: `report_content` takes a report from any
 * surface, the reporter is never shown to anybody, decisions carry a reason
 * and appear on /standing, and every one of them can be appealed. What is
 * deliberately not claimed: that a machine decides anything. It does not.
 */

const yours: { icon: KobIcon; name: string; body: string }[] = [
  {
    icon: 'report',
    name: 'Report',
    body: 'A person, a World, a message, an item, a post. Three taps, and your name never travels with it.',
  },
  {
    icon: 'remove-user',
    name: 'Block',
    body: 'They cannot message you, find you, or follow you into a World. It holds everywhere, not just where you pressed it.',
  },
  {
    icon: 'cross-user',
    name: 'Ignore',
    body: 'Quieter than a block, and nobody is told. You simply stop seeing them.',
  },
  {
    icon: 'mute-microphone',
    name: 'Mute',
    body: 'One voice off in a World, for you, straight away. No argument and no waiting.',
  },
]

const promises = [
  {
    name: 'You are told why.',
    body: 'Every decision says what it was about and what happens now. No quiet strikes, no mystery timeouts.',
  },
  {
    name: 'You can argue back.',
    body: 'Every single one can be appealed, and a person reads the appeal. We get things wrong and we would rather hear about it.',
  },
  {
    name: 'A machine never ends an account.',
    body: 'Kobby helps us look. Warnings and suspensions are where its reach stops, and a human signs off on anything heavier.',
  },
  {
    name: 'Reporting is anonymous. Fully.',
    body: 'The person you reported is never shown who reported them. Not on appeal, not afterwards, not ever.',
  },
]

export default function InsideReport() {
  useAtTitle('Report')
  useSocialCard({
    title: 'Report - Kobblon',
    description: 'Report anything, anywhere. It goes to a person, and your name never travels with it.',
    image: null,
  })

  return (
    <AboutShell
      hero={(
        <Hero
          eyebrow="Inside Kobblon"
          title={<>Nobody here has to <span className="text-brand-bright">put up with it</span>.</>}
          lead="Kobblon is full of strangers, and most of them are great. For the rest, every page on this site has a report on it, and pressing it does something."
          actions={(
            <>
              <Button to="/support" variant="yes" size="lg">Get help now</Button>
              <Button to="/policies/moderation" variant="subtle" size="lg">The rules we use</Button>
            </>
          )}
          art={(
            <Parallax strength={40}>
              <Figure
                src="/about/report.webp"
                alt="A blue flag, raised"
                ratio="tall"
              />
            </Parallax>
          )}
        />
      )}
    >
      {/* ----------------------------------------------------- what you hold */}
      <Band tone="night" edge>
        <Reveal>
          <BandHead
            title="Four things, and they are all yours."
            lead="You do not have to wait for us to act. Most of what keeps a day pleasant is in your hands already."
          />
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {yours.map((one, at) => (
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

      {/* ------------------------------------------------- what happens next */}
      <Band tone="raised" edge decor={<Floaters />}>
        <Reveal className="relative z-10">
          <BandHead
            eyebrow="After you press it"
            title="It lands on a desk, not in a bin."
            lead="A report opens a case. The case gets read."
          />
        </Reveal>
        <ol className="relative z-10 mt-12 grid gap-4 lg:grid-cols-3">
          {[
            ['You send it', 'Say what happened in your own words. A screenshot helps and is never required.'],
            ['Somebody looks', 'We read it against the Guidelines - the same ones that are published, not a private list.'],
            ['A decision, with a reason', 'It shows up on your Standing page, in plain words, with the way to appeal it underneath.'],
          ].map(([name, body], at) => (
            <Reveal key={name} delay={at * 80}>
              <li className="h-full rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
                <p className="font-display text-3xl font-extrabold text-brand-bright">{at + 1}</p>
                <p className="mt-3 font-display text-lg font-extrabold">{name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">{body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
        <Reveal delay={260}>
          <div className="relative z-10 mt-8">
            <Button to="/standing" variant="subtle">See where you stand</Button>
          </div>
        </Reveal>
      </Band>

      {/* ------------------------------------------------------- the promise */}
      <Band tone="night" edge>
        <Reveal>
          <BandHead
            eyebrow="What we will not do"
            title="Four things we are holding ourselves to."
          />
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {promises.map((one, at) => (
            <Reveal key={one.name} delay={at * 70}>
              <div className="h-full rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
                <p className="font-display text-lg font-extrabold">{one.name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">{one.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={300}>
          <p className="mt-10 max-w-2xl text-lg leading-relaxed text-white/70">
            We are a young platform and we are small. That is exactly why this part is not
            an afterthought: it is far easier to be the place that got this right from the
            first week than to be the place that fixes it at ten million people.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button to="/guidelines" variant="subtle">Community Guidelines</Button>
            <Button to="/support" variant="ghost">Talk to us</Button>
          </div>
        </Reveal>
      </Band>

      <InsideNav not="report" />
    </AboutShell>
  )
}
