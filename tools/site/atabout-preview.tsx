/*
 * What is Kobblon, drawn again. Dark, same shell, same words.
 *
 * What is wrong with the page today is not its colours and not its bar -
 * it is that the middle is a narrow column of dark cards floating in a
 * darker void, so two thirds of a wide window is empty and every section
 * is the same weight as every other one.
 *
 * So the cards go and bands take their place: each one runs the full
 * width of the window, carries its own surface, and is as tall as what it
 * has to say. A claim that matters gets the size of a claim that matters.
 * Nothing new is invented - the surfaces, the stroke, the faces, the
 * display face and the buttons are the ones we already have.
 *
 * `?page=about` for now; the other three follow once this is approved.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Link } from 'react-router-dom'
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

/** A full-width band. The only layout shape on the page. */
function Band({ raised, className, children }: { raised?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('relative border-t-2 border-ink-line', raised ? 'bg-ink-raised' : 'bg-ink', className)}>
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">{children}</div>
    </section>
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
      {/* ---------------------------------------------------- the claim */}
      <Band>
        <div className="grid items-center gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div className="relative">
            <p className="font-display text-4xl font-extrabold leading-[1.02] text-white sm:text-6xl">
              A person made every single thing on this website.
            </p>
            <p className="mt-6 max-w-xl text-lede leading-relaxed text-muted">
              Every World, every hat, every face, every word. Nothing on Kobblon
              was generated and nothing on Kobblon ever will be. We are the other
              thing.
            </p>
          </div>
          <div className="relative flex items-center justify-center">
            <img src={asset('/mascot/kobby.gif')} alt="" aria-hidden="true"
              className="w-40 select-none sm:w-52" />
            <Face face="skull" turn={9} className="right-0 top-2 opacity-80" size="h-16 w-16" />
          </div>
        </div>
      </Band>

      {/* ------------------------------------------- the two other claims */}
      <Band raised>
        <div className="grid gap-y-12 sm:grid-cols-2 sm:gap-x-14">
          <div className="sm:border-r-2 sm:border-ink-line sm:pr-14">
            <p className="font-display text-2xl font-extrabold leading-none sm:text-3xl">No bots. None.</p>
            <p className="mt-4 text-lede leading-relaxed text-muted">
              If it says four people are playing, it is four people. We would
              rather look quiet than lie about it.
            </p>
          </div>
          <div>
            <p className="font-display text-2xl font-extrabold leading-none sm:text-3xl">Free, and not the bad kind.</p>
            <p className="mt-4 text-lede leading-relaxed text-muted">
              Make an account, build a World, put it out. Nothing is paywalled on
              the way in.
            </p>
          </div>
        </div>
      </Band>

      {/* ---------------------------------------------- what is in there */}
      <Band>
        <p className="mb-10 font-display text-sm font-extrabold uppercase tracking-[0.2em] text-muted">
          What is in there
        </p>
        <div className="grid gap-8 sm:grid-cols-2">
          <Link to="/discover" className="group relative block overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card transition-colors hover:border-brand">
            <img src={asset('/about/play.webp')} alt="" aria-hidden="true"
              className="h-52 w-full select-none object-cover" />
            <div className="p-6">
              <p className="font-display text-2xl font-extrabold leading-none">Worlds</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Obbies, tycoons, hangouts, things nobody has a word for yet. Walk
                into any of them.
              </p>
              <span className="mt-4 inline-block text-sm font-bold text-link">Discover →</span>
            </div>
          </Link>
          <Link to="/communities" className="group relative block overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card transition-colors hover:border-brand">
            <img src={asset('/about/marketplace.png')} alt="" aria-hidden="true"
              className="h-52 w-full select-none object-cover" />
            <div className="relative p-6">
              <Face face="laugh" turn={-10} className="right-5 top-5 opacity-90" size="h-12 w-12" />
              <p className="font-display text-2xl font-extrabold leading-none">Communities</p>
              <p className="mt-3 max-w-[22rem] text-sm leading-relaxed text-muted">
                Fan clubs, build teams and whatever else people start. Each one has
                a wall and a bank.
              </p>
              <span className="mt-4 inline-block text-sm font-bold text-link">Have a look →</span>
            </div>
          </Link>
        </div>
      </Band>

      {/* ---------------------------------------------------------- safety */}
      <Band raised className="overflow-hidden">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:gap-12">
          <img src={asset('/mascot/construction_worker.png')} alt="" aria-hidden="true"
            className="w-28 shrink-0 select-none sm:w-36" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
              Report anything, anywhere. A person reads it.
            </p>
            <p className="mt-4 max-w-2xl text-lede leading-relaxed text-muted">
              Your name never travels with a report. Moderation is people, and the
              only thing a machine does here is point one of them at it.
            </p>
            <Link to="/policies" className="mt-5 inline-block text-sm font-bold text-link underline underline-offset-4">
              The rules
            </Link>
          </div>
        </div>
      </Band>

      {/* ------------------------------------------------------ build one */}
      <section className="relative border-t-2 border-ink-line">
        <img src={asset('/brand/waves.png')} alt="" aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/50" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-5 py-16 sm:flex-row sm:px-8 sm:py-20">
          <img src={asset('/about/can.png')} alt="" aria-hidden="true"
            className="w-32 shrink-0 select-none drop-shadow-2xl sm:w-48"
            style={{ transform: 'rotate(-6deg)' }} />
          <div className="min-w-0">
            <p className="font-display text-3xl font-extrabold leading-none text-on-art sm:text-5xl">
              Go on then. Build one.
            </p>
            <p className="mt-4 max-w-xl text-lede leading-relaxed text-on-art/75">
              Worlds are built in Kobblon Workspace, on the desktop. Publish one
              and it is here, ready for people, two minutes later.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button to="/download" variant="primary" size="lg">Get Workspace</Button>
              <Link to="/create" className="text-sm font-bold text-on-art/70 underline underline-offset-4 transition-colors hover:text-on-art">
                or start in the Creator Hub
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- somebody new */}
      <Band className="text-center">
        <img src={asset('/mascot/newbie.png')} alt="" aria-hidden="true"
          className="pointer-events-none mx-auto w-32 select-none sm:w-40" />
        <p className="mt-5 font-display text-2xl font-extrabold">See you in there.</p>
      </Band>
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
