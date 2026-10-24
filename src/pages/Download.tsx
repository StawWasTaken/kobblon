import { faWindows, faApple, faLinux } from '@fortawesome/free-brands-svg-icons'
import { faArrowRight, faArrowDown } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import { Icon, type KobIcon } from '@/components/brand/Icon'
import { Button } from '@/components/ui/Button'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band, Lane } from '@/components/about/Band'
import { Reveal } from '@/components/about/Reveal'
import { ScrollIn } from '@/components/about/ScrollIn'
import { Parallax } from '@/components/about/Parallax'
import { Floaters } from '@/components/about/Floaters'
import { Character } from '@/components/about/Figure'
import { BandHead, Title } from '@/components/about/Type'
import { useAtTitle, useSocialCard } from '@/hooks/useTitle'
import { asset } from '@/lib/asset'

/*
 * Where the Launcher comes from.
 *
 * It is not released, so the page says that in the headline rather than in
 * a notice under three buttons that download nothing. That is the only
 * honest shape for this page today, and it is also the better one: a page
 * whose subject is "soon" should look like it is being built, which is
 * what the character with the hammer is doing here.
 *
 * When there are installers, the three platforms below become buttons and
 * the headline changes. Nothing else on the page has to move.
 */

const platforms: { name: string; icon: IconDefinition }[] = [
  { name: 'Windows', icon: faWindows },
  { name: 'macOS', icon: faApple },
  { name: 'Linux', icon: faLinux },
]

const does: { icon: KobIcon; name: string; body: string }[] = [
  {
    icon: 'world',
    name: 'It runs the Worlds',
    body: 'A World is a place with physics, sound and other people in it. That runs in an application, not in a browser tab.',
  },
  {
    icon: 'avatar',
    name: 'It brings your avatar',
    body: 'What you are wearing on the website is what you walk in as. One account, one wardrobe.',
  },
  {
    icon: 'people',
    name: 'It keeps your friends',
    body: 'Who is online and where they are playing, so joining somebody is one press rather than a search.',
  },
]

export default function Download() {
  useAtTitle('Get the Launcher')
  useSocialCard({
    title: 'Get the Kobblon Launcher',
    description: 'The Kobblon Launcher plays Worlds. It is being built.',
    image: null,
  })

  return (
    <AboutShell
      backdrop={
        <Parallax strength={80} className="absolute inset-0">
          <img
            src={asset('/brand/landing-interior.png')}
            alt=""
            aria-hidden="true"
            className="h-[115%] w-full object-cover object-center"
          />
        </Parallax>
      }
      hero={
        <Lane className="flex min-h-[70vh] flex-col justify-center py-24 text-center">
          <ScrollIn over={0.22}>
            <h1 className="font-display text-[clamp(2.4rem,6.4vw,5rem)] font-extrabold leading-[0.95] tracking-tight drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)]">
              Worlds run here,
              <br />
              <span className="text-brand-bright">not in a browser tab</span>.
            </h1>
          </ScrollIn>
          <Reveal delay={200}>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-white/65">
              The Kobblon Launcher is the part you play in. It is being built, and there is
              nothing to download today; the installers land on this page the day there are.
            </p>
          </Reveal>
          <Reveal delay={280}>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button to="/discover" variant="yes" size="lg">See what people are making</Button>
              <Button to="/signup" variant="subtle" size="lg">Make an account</Button>
            </div>
          </Reveal>
          <Reveal delay={340}>
            <p className="mt-8 flex items-center justify-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/45">
              No release date, and none guessed at here
              <Glyph icon={faArrowDown} className="text-xs" />
            </p>
          </Reveal>
        </Lane>
      }
    >
      {/* ------------------------------------------------------- platforms */}
      <Band
        tone="raised"
        tight
        edge
        decor={
          /* Wrapped rather than given the classes directly: `Character` is
             itself `relative`, and Tailwind emits `relative` after
             `absolute`, so the two on one element leave it in the flow -
             which put the builder in the middle of the band at full height
             instead of standing in the gutter. */
          <div className="pointer-events-none absolute bottom-0 right-[2%] hidden w-28 xl:block">
            <Character src="/brand/under_construction.png" alt="" imgClassName="w-full" />
          </div>
        }
      >
        <Reveal>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/40">
            Planned for
          </p>
        </Reveal>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {platforms.map((one, at) => (
            <Reveal key={one.name} delay={at * 70} className="h-full">
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-ink-card/50 px-6 py-5">
                <Glyph icon={one.icon} className="text-2xl text-white/35" />
                <span className="font-display text-lg font-extrabold text-white/70">{one.name}</span>
                <span className="ml-auto text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/30">
                  Not yet
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </Band>

      {/* ---------------------------------------------------- what it is for */}
      <Band tone="night" edge>
        <Reveal>
          <BandHead
            eyebrow="What it is for"
            title="The part of Kobblon you play in"
          />
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {does.map((one, at) => (
            <Reveal key={one.name} delay={at * 70} className="h-full">
              <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-ink-card/50 p-7">
                <Icon name={one.icon} tone="currentColor" className="h-8 w-8 text-brand-bright" />
                <p className="mt-5 font-display text-xl font-extrabold">{one.name}</p>
                <p className="mt-3 leading-relaxed text-white/55">{one.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Band>

      {/* ------------------------------------------------------------- the ask */}
      {/*
        * A band and not a coloured banner across the foot. Staw: "i dont want
        * that footer thing, only the normal footer" - so what was a brand
        * block is a section that happens to be last.
        */}
      <Band tone="raised" edge decor={<Floaters />}>
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_auto]">
          <Reveal>
            <Title className="max-w-2xl">The website already works.</Title>
            <p className="mt-5 max-w-xl leading-relaxed text-white/60">
              Everything but walking into a World is here: building, selling, Communities,
              people. The Launcher is the last piece, not the first.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="flex flex-wrap gap-3">
              <Button to="/signup" variant="yes" size="lg">Make an account</Button>
              <Button to="/about" variant="subtle" size="lg" iconRight={faArrowRight}>
                What Kobblon is
              </Button>
            </div>
          </Reveal>
        </div>
      </Band>
    </AboutShell>
  )
}
