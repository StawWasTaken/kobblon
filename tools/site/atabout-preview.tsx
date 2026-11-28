/*
 * What is Kobblon, drawn the way the old thing felt.
 *
 * The vibe Staw is after is not stickers and it is not pastel: it is the
 * 2006 panel. Every block of that site announced itself with a little
 * coloured title strip across the top - Welcome to ROBLOX!, Multiplayer
 * Games, Newest People - and then a bordered body packed tight with
 * things. The page was a notice board of labelled boxes, and the colour
 * on the strip was how you told one from another.
 *
 * So that is the chrome here, in our dark: a panel is a strip in one of
 * our own colours over a `ink-card` body, the type is small and close,
 * and the page is a wide column with a narrow one beside it rather than
 * one centred sheet. Nothing is beige and nothing is copied; the strip is
 * the idea we are taking.
 *
 * The shell, the bar, the hero and the words are untouched.
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

/* The strip colours. Ours, not theirs: brand blue carries the important
   one, and the rest are the accents the system already has. */
const STRIP = {
  brand: 'from-brand-bright to-brand',
  red: 'from-[#ef4b3d] to-[#c22a1e]',
  green: 'from-[#35d46c] to-[#1b8f42]',
  gold: 'from-[#f7c13e] to-[#c18800]',
  violet: 'from-[#8b57ea] to-[#5b2bb0]',
} as const

/** A panel: a titled strip over a body. The one shape on the page. */
function Panel({ title, tone = 'brand', right, className, bodyClass, children }: {
  title: string
  tone?: keyof typeof STRIP
  /** A small thing on the right of the strip, like the old "see more". */
  right?: React.ReactNode
  className?: string
  bodyClass?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-ink-card', className)}>
      <div className={cn('flex items-center gap-3 bg-gradient-to-b px-3.5 py-2', STRIP[tone])}>
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-on-art">{title}</h2>
        <div className="ml-auto text-xs font-bold text-on-art/80">{right}</div>
      </div>
      <div className={cn('p-4 sm:p-5', bodyClass)}>{children}</div>
    </section>
  )
}

function Face({ face, className, turn, size = 'h-14 w-14 sm:h-20 sm:w-20' }: {
  face: keyof typeof FACE_COLOUR; className?: string; turn: number; size?: string
}) {
  return (
    <span aria-hidden="true" className={cn('pointer-events-none absolute select-none', className)}
      style={{ transform: `rotate(${turn}deg)` }}>
      <Icon name={`reaction-${face}` as 'reaction-smile'} tone={FACE_COLOUR[face]} className={size} />
    </span>
  )
}

function AboutNew() {
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
              People build things here.
              <br />
              Then they stand inside them.
            </>
          }
        >
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button to="/signup" variant="yes" size="lg">Make an account</Button>
            <Button to="/discover" variant="subtle" size="lg">Look around first</Button>
          </div>
          <Face face="heart-eyes" turn={-14} className="right-10 top-28 hidden sm:block" />
          <Face face="sunglasses" turn={12} className="bottom-10 right-28 hidden sm:block" size="h-16 w-16" />
        </AtTop>
      }
    >
      <div className="bg-ink">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* ------------------------------------------------ main column */}
          <div className="grid content-start gap-4">
            <Panel title="Welcome to Kobblon!" tone="brand">
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <img src={asset('/mascot/kobby.gif')} alt="" aria-hidden="true"
                  className="w-24 shrink-0 select-none sm:w-28" />
                <div className="min-w-0">
                  <p className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                    A person made every single thing on this website.
                  </p>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">
                    Every World, every hat, every face, every word. Nothing on
                    Kobblon was generated and nothing on Kobblon ever will be. We
                    are the other thing.
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Worlds" tone="red" right={<Link to="/discover" className="hover:underline">see them all ▸</Link>}
              bodyClass="p-0">
              <Link to="/discover" className="group block">
                <img src={asset('/brand/landing-interior.png')} alt="" aria-hidden="true"
                  className="h-64 w-full select-none object-cover" />
                <div className="flex items-end gap-4 border-t-2 border-ink-line p-4">
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted">
                    Obbies, tycoons, hangouts, things nobody has a word for yet.
                    Walk into any of them. The quiet ones are the good ones.
                  </p>
                  <Button to="/discover" variant="yes" className="shrink-0">play!</Button>
                </div>
              </Link>
            </Panel>

            <div className="grid gap-4 sm:grid-cols-2">
              <Panel title="No bots. None." tone="green">
                <p className="text-sm leading-relaxed text-muted">
                  If it says four people are playing, it is four people. We would
                  rather look quiet than lie about it.
                </p>
              </Panel>
              <Panel title="Free, and not the bad kind." tone="gold">
                <p className="text-sm leading-relaxed text-muted">
                  Make an account, build a World, put it out. Nothing is paywalled
                  on the way in.
                </p>
              </Panel>
            </div>

            <Panel title="Go on then. Build one." tone="brand" bodyClass="relative p-0">
              <img src={asset('/brand/waves.png')} alt="" aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/55" />
              <div className="relative flex flex-col items-center gap-5 p-5 sm:flex-row">
                <img src={asset('/about/can.png')} alt="" aria-hidden="true"
                  className="w-24 shrink-0 select-none drop-shadow-2xl sm:w-28"
                  style={{ transform: 'rotate(-6deg)' }} />
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-on-art/85">
                    Worlds are built in Kobblon Workspace, on the desktop. Publish
                    one and it is here, ready for people, two minutes later.
                  </p>
                  <div className="mt-3.5 flex flex-wrap items-center gap-3">
                    <Button to="/download" variant="primary">Get Workspace</Button>
                    <Link to="/create" className="text-xs font-bold text-on-art/70 underline underline-offset-4 hover:text-on-art">
                      or start in the Creator Hub
                    </Link>
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          {/* ------------------------------------------------ side column */}
          <div className="grid content-start gap-4">
            <Panel title="Communities" tone="violet" right={<Link to="/communities" className="hover:underline">more ▸</Link>}
              bodyClass="p-0">
              <img src={asset('/about/marketplace.png')} alt="" aria-hidden="true"
                className="h-32 w-full select-none object-cover" />
              <div className="relative border-t-2 border-ink-line p-4">
                <Face face="laugh" turn={-10} className="right-3 top-3 opacity-90" size="h-10 w-10" />
                <p className="pr-12 text-sm leading-relaxed text-muted">
                  Fan clubs, build teams and whatever else people start. Each one
                  has a wall and a bank.
                </p>
              </div>
            </Panel>

            <Panel title="Somebody reads it" tone="gold">
              <div className="flex gap-4">
                <img src={asset('/mascot/construction_worker.png')} alt="" aria-hidden="true"
                  className="h-20 w-16 shrink-0 select-none object-contain" />
                <div className="min-w-0">
                  <p className="font-display text-base font-extrabold leading-tight">
                    Report anything, anywhere.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    Your name never travels with a report. Moderation is people,
                    and the only thing a machine does here is point one of them
                    at it.
                  </p>
                  <Link to="/policies" className="mt-3 inline-block text-xs font-bold text-link underline underline-offset-4">
                    The rules
                  </Link>
                </div>
              </div>
            </Panel>

            <Panel title="New here?" tone="green">
              <div className="text-center">
                <img src={asset('/mascot/newbie.png')} alt="" aria-hidden="true"
                  className="pointer-events-none mx-auto w-24 select-none" />
                <p className="mt-3 font-display text-lg font-extrabold">See you in there.</p>
                <Button to="/signup" variant="yes" block className="mt-3">Make an account</Button>
              </div>
            </Panel>
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
        <ToastProvider>
          <AboutNew />
        </ToastProvider>
      </AuthContext.Provider>
    </ThemeProvider>
  </MemoryRouter>,
)
