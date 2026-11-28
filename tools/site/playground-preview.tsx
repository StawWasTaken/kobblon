/*
 * What is Kobblon, again: dark, our bar, our buttons, and loose.
 *
 * What was wrong with the last one, in Staw's words: it was light, it had
 * its own bar, it restyled the buttons, it felt recent rather than like a
 * website somebody actually made, and everything was too perfect and too
 * geometrical. And the writing read as written by a machine.
 *
 * So the rules this draft is built under:
 *
 *   * the real `AboutShell` - real bar, real footer, nothing drawn here;
 *   * the real `Button`, untouched, in its own variants;
 *   * dark, on our own surfaces, no sky, no cream;
 *   * nothing is a rectangle with a rule through it. A panel's name sits
 *     on a pill that leans and hangs over the top edge of the panel, the
 *     corners are big and uneven, the separators are dashed, and faces
 *     peek over the sides;
 *   * the words are short and they sound like a person. Headings and
 *     buttons end in "!", the body does not.
 */
import { createRoot } from 'react-dom/client'
import { Link, MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/hooks/useTheme'
import { AuthContext, type AuthValue } from '@/hooks/useAuth'
import { AboutShell } from '@/components/layout/AboutShell'
import { AtTop } from '@/components/about/AtTop'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/brand/Icon'
import { FACE_COLOUR } from '@/components/social/Reactions'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'
import '@/index.css'

/* The panel's name is a pill, not a bar: it leans, it hangs over the top
   edge, and it is a different colour per block. */
const TAB = {
  brand: 'bg-brand border-brand-deep',
  green: 'bg-[#22a74d] border-[#13642e]',
  red: 'bg-[#e33b2e] border-[#8d1d13]',
  gold: 'bg-[#eda51c] border-[#8f6200]',
  violet: 'bg-[#7b3fe4] border-[#46208a]',
} as const

/* Corners that do not match each other. Three shapes, used on purpose. */
const ROUND = [
  'rounded-[2.2rem_1.4rem_2rem_1.6rem]',
  'rounded-[1.5rem_2.4rem_1.5rem_2.2rem]',
  'rounded-[2rem_2rem_1.4rem_2.4rem]',
]

function Panel({ name, tone = 'brand', lean = -1.5, shape = 0, className, children }: {
  name: string
  tone?: keyof typeof TAB
  /** Degrees the name pill leans. The panel itself stays straight. */
  lean?: number
  shape?: 0 | 1 | 2
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('relative border-2 border-b-4 border-ink-line bg-ink-card', ROUND[shape], className)}>
      <span
        className={cn(
          'absolute -top-4 left-5 z-10 inline-block select-none rounded-full border-2 px-4 py-1.5',
          'font-display text-sm font-extrabold uppercase tracking-wide text-on-art shadow-lg',
          TAB[tone],
        )}
        style={{ transform: `rotate(${lean}deg)` }}
      >
        {name}
      </span>
      <div className="px-5 pb-5 pt-8 sm:px-6 sm:pb-6">{children}</div>
    </section>
  )
}

function Face({ face, className, turn, size = 'h-14 w-14' }: {
  face: keyof typeof FACE_COLOUR; className?: string; turn: number; size?: string
}) {
  return (
    <span aria-hidden="true" className={cn('pointer-events-none absolute z-20 select-none', className)}
      style={{ transform: `rotate(${turn}deg)` }}>
      <Icon name={`reaction-${face}` as 'reaction-smile'} tone={FACE_COLOUR[face]} className={size} />
    </span>
  )
}

/** A wobbly line instead of a border. Nothing on this page is ruled. */
function Squiggle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 14" preserveAspectRatio="none" aria-hidden="true"
      className={cn('h-3 w-full text-ink-line/90', className)}>
      <path d="M0 7 C 40 0, 80 14, 120 7 S 200 0, 240 7 S 320 14, 360 7 S 440 0, 480 7 S 560 14, 600 7"
        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function Page() {
  return (
    <AboutShell
      top={
        <AtTop
          art="/about/towers-sunset.webp"
          tall
          title={
            <>
              <img src={asset('/about/wordmark-brush.webp')} alt="Kobblon"
                className="mb-6 w-[min(70vw,22rem)] select-none" />
              People build things here!
              <br />
              Then they stand inside them.
            </>
          }
        >
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button to="/signup" variant="yes" size="lg">Make an account!</Button>
            <Button to="/discover" variant="subtle" size="lg">Look around first</Button>
          </div>
          <Face face="heart-eyes" turn={-14} className="right-10 top-28 hidden h-20 w-20 sm:block" size="h-20 w-20" />
          <Face face="sunglasses" turn={12} className="bottom-10 right-28 hidden sm:block" size="h-16 w-16" />
        </AtTop>
      }
    >
      <div className="bg-ink">
        <div className="mx-auto max-w-5xl space-y-7 px-5 py-12 sm:px-8">

          {/* -------------------------------------------------- who made it */}
          <Panel name="Who made all this?" tone="brand" lean={-2} shape={0} className="relative">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
              <img src={asset('/mascot/kobby.gif')} alt="" aria-hidden="true"
                className="h-28 w-24 shrink-0 select-none object-contain" />
              <div className="min-w-0">
                <p className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                  People did! All of it!
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  Every World, every hat, every face, every word on here was made
                  by somebody. Nothing is generated. Nothing ever will be. That is
                  the whole point of us.
                </p>
              </div>
            </div>
            <Face face="skull" turn={14} className="-right-3 -top-5 hidden sm:block" size="h-12 w-12" />
          </Panel>

          <Squiggle />

          {/* ------------------------------------------------------- worlds */}
          <Panel name="Worlds!" tone="red" lean={2} shape={1} className="overflow-hidden">
            <Link to="/discover" className="group block">
              <img src={asset('/brand/landing-interior.png')} alt="" aria-hidden="true"
                className="h-56 w-full select-none rounded-[1.4rem] border-2 border-ink-line object-cover" />
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted">
                Obbies, tycoons, hangouts, and about nine things nobody has a
                word for. Walk into any of them. The quiet ones are the good
                ones.
              </p>
              <Button to="/discover" variant="yes">Go and look!</Button>
            </div>
          </Panel>

          {/* ------------------------------------------------- two small ones */}
          <div className="grid gap-7 sm:grid-cols-2">
            <Panel name="No bots!" tone="green" lean={-2.5} shape={2}>
              <p className="text-sm leading-relaxed text-muted">
                None. Not one. If it says four people are in there, it is four
                people. We would rather look empty than make numbers up.
              </p>
            </Panel>
            <Panel name="It is free!" tone="gold" lean={2.5} shape={0}>
              <p className="text-sm leading-relaxed text-muted">
                Properly free. Make an account, build something, put it out.
                Nothing is locked behind a wall on the way in.
              </p>
            </Panel>
          </div>

          <Squiggle className="scale-x-[-1]" />

          {/* ------------------------------------------------- communities */}
          <Panel name="Hang about with people" tone="violet" lean={-1.5} shape={1}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <img src={asset('/about/marketplace.png')} alt="" aria-hidden="true"
                className="h-32 w-full select-none rounded-[1.4rem] border-2 border-ink-line object-cover sm:w-56" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-muted">
                  Fan clubs, build teams, and a lot of groups about one in-joke.
                  Every one of them gets a wall to shout on and a bank to put
                  Brix in.
                </p>
                <div className="mt-4"><Button to="/communities" variant="subtle">Have a look</Button></div>
              </div>
              <Face face="laugh" turn={-12} className="right-2 top-2 sm:right-4" size="h-12 w-12" />
            </div>
          </Panel>

          {/* ------------------------------------------------------ safety */}
          <Panel name="Somebody reads it" tone="gold" lean={1.5} shape={2}>
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <img src={asset('/mascot/construction_worker.png')} alt="" aria-hidden="true"
                className="h-24 w-20 shrink-0 select-none object-contain" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-extrabold leading-tight">
                  Report anything, anywhere. A person reads it!
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Your name never goes with it. The people who sort it out are
                  people; a machine only points them at the thing.
                </p>
              </div>
              <Button to="/policies" variant="subtle">The rules</Button>
            </div>
          </Panel>

          {/* ---------------------------------------------------- build one */}
          <Panel name="Go on then!" tone="brand" lean={-2} shape={0}>
            <div className="relative overflow-hidden rounded-[1.6rem] border-2 border-ink-line">
              <img src={asset('/brand/waves.png')} alt="" aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/55" />
              <div className="relative flex flex-col items-center gap-5 p-5 sm:flex-row sm:p-6">
                <img src={asset('/about/can.png')} alt="" aria-hidden="true"
                  className="w-28 shrink-0 select-none drop-shadow-2xl"
                  style={{ transform: 'rotate(-7deg)' }} />
                <div className="min-w-0">
                  <p className="font-display text-xl font-extrabold text-on-art">Build one yourself!</p>
                  <p className="mt-2 text-sm leading-relaxed text-on-art/80">
                    You make Worlds in Kobblon Workspace, on a desktop. Put one
                    out and it is here two minutes later, ready for whoever walks
                    in.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button to="/download" variant="primary">Get Workspace!</Button>
                    <Link to="/create" className="text-sm font-bold text-on-art/70 underline underline-offset-4 hover:text-on-art">
                      or start in the Creator Hub
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* ------------------------------------------------------- newbie */}
          <div className="relative pb-4 pt-6 text-center">
            <img src={asset('/mascot/newbie.png')} alt="" aria-hidden="true"
              className="pointer-events-none mx-auto w-28 select-none" style={{ transform: 'rotate(-3deg)' }} />
            <p className="mt-3 font-display text-xl font-extrabold">See you in there!</p>
          </div>
        </div>
      </div>
    </AboutShell>
  )
}

const out = { profile: null, session: null, loading: false } as unknown as AuthValue

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/about']}>
    <ThemeProvider>
      <AuthContext.Provider value={out}>
        <ToastProvider><Page /></ToastProvider>
      </AuthContext.Provider>
    </ThemeProvider>
  </MemoryRouter>,
)
