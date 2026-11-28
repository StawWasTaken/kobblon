/*
 * The same elements, redesigned. Nothing removed.
 *
 * The last three attempts kept answering a question Staw did not ask: they
 * rearranged the page, or replaced its parts, or threw the shell away. The
 * ask is narrower and harder - the page keeps every element it has, in the
 * order it has them, and each element is drawn better.
 *
 * So this is a sheet: on the left, the element exactly as it ships today;
 * on the right, the same element with the same words and the same links,
 * redrawn. Judge them one at a time.
 *
 * What the redraw does to every element, consistently:
 *
 *   * a title strip in the element's own colour, so a block announces
 *     itself instead of starting with a bold line in the dark;
 *   * a body surface lifted off the page, with the lip we already use
 *     under it;
 *   * the art given room to bleed to the edges rather than sitting in
 *     padding;
 *   * one clear thing to press, where the element has one.
 */
import { createRoot } from 'react-dom/client'
import { Link, MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/hooks/useTheme'
import { AuthContext, type AuthValue } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/brand/Icon'
import { FACE_COLOUR } from '@/components/social/Reactions'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'
import '@/index.css'

const STRIP = {
  brand: 'from-brand-bright to-brand',
  red: 'from-[#ef4b3d] to-[#c22a1e]',
  green: 'from-[#35d46c] to-[#1b8f42]',
  gold: 'from-[#f7c13e] to-[#c18800]',
  violet: 'from-[#8b57ea] to-[#5b2bb0]',
} as const

function Strip({ title, tone, right }: { title: string; tone: keyof typeof STRIP; right?: React.ReactNode }) {
  return (
    <div className={cn('flex items-center gap-3 bg-gradient-to-b px-3.5 py-2', STRIP[tone])}>
      <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-on-art">{title}</h3>
      <div className="ml-auto text-xs font-bold text-on-art/80">{right}</div>
    </div>
  )
}

function Face({ face, className, turn, size = 'h-14 w-14' }: {
  face: keyof typeof FACE_COLOUR; className?: string; turn: number; size?: string
}) {
  return (
    <span aria-hidden="true" className={cn('pointer-events-none absolute select-none', className)}
      style={{ transform: `rotate(${turn}deg)` }}>
      <Icon name={`reaction-${face}` as 'reaction-smile'} tone={FACE_COLOUR[face]} className={size} />
    </span>
  )
}

/* ------------------------------------------------------------ the sheet */

function Row({ name, now, next: redrawn }: { name: string; now: React.ReactNode; next: React.ReactNode }) {
  return (
    <section className="border-t-2 border-ink-line py-10">
      <p className="mb-5 font-display text-xs font-extrabold uppercase tracking-[0.2em] text-muted">{name}</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">today</p>
          {now}
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-link">redrawn</p>
          {redrawn}
        </div>
      </div>
    </section>
  )
}

function Sheet() {
  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="font-display text-3xl font-extrabold">The same elements, drawn better</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Same words, same links, same order on the page. Only the drawing changes.
        </p>

        {/* ------------------------------------------------- the one claim */}
        <Row
          name="The claim"
          now={
            <div className="relative overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-7">
              <Face face="skull" turn={9} className="right-6 top-6 opacity-80" size="h-16 w-16" />
              <p className="font-display text-3xl font-extrabold leading-[1.05] text-white">
                A person made<br />every single thing<br />on this website.
              </p>
              <p className="mt-5 max-w-md text-lede leading-relaxed text-muted">
                Every World, every hat, every face, every word. Nothing on Kobblon
                was generated and nothing on Kobblon ever will be. We are the other
                thing.
              </p>
            </div>
          }
          next={
            <div className="overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-ink-card">
              <Strip title="Made by people" tone="brand" right="every single thing" />
              <div className="relative flex gap-5 p-5">
                <img src={asset('/mascot/kobby.gif')} alt="" aria-hidden="true"
                  className="h-28 w-24 shrink-0 select-none object-contain" />
                <div className="min-w-0">
                  <p className="font-display text-2xl font-extrabold leading-tight">
                    A person made every single thing on this website.
                  </p>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">
                    Every World, every hat, every face, every word. Nothing on
                    Kobblon was generated and nothing on Kobblon ever will be. We
                    are the other thing.
                  </p>
                </div>
                <Face face="skull" turn={9} className="-bottom-2 right-3 opacity-70" size="h-12 w-12" />
              </div>
            </div>
          }
        />

        {/* --------------------------------------------- a small statement */}
        <Row
          name="A small statement"
          now={
            <div className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
              <p className="font-display text-xl font-extrabold leading-none">No bots. None.</p>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">
                If it says four people are playing, it is four people. We would
                rather look quiet than lie about it.
              </p>
            </div>
          }
          next={
            <div className="overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-ink-card">
              <Strip title="No bots. None." tone="green" />
              <p className="p-5 text-sm leading-relaxed text-muted">
                If it says four people are playing, it is four people. We would
                rather look quiet than lie about it.
              </p>
            </div>
          }
        />

        {/* ------------------------------------------------- a link card */}
        <Row
          name="A card that goes somewhere"
          now={
            <Link to="/discover" className="group block overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6 transition-colors hover:border-brand">
              <p className="font-display text-xl font-extrabold leading-none">Worlds</p>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">
                Obbies, tycoons, hangouts, things nobody has a word for yet. Walk
                into any of them.
              </p>
              <span className="mt-4 inline-block text-sm font-bold text-link">Discover →</span>
            </Link>
          }
          next={
            <div className="overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-ink-card">
              <Strip title="Worlds" tone="red" right={<Link to="/discover" className="hover:underline">see them all ▸</Link>} />
              <Link to="/discover" className="group block">
                <img src={asset('/brand/landing-interior.png')} alt="" aria-hidden="true"
                  className="h-44 w-full select-none object-cover" />
                <div className="flex items-end gap-4 border-t-2 border-ink-line p-4">
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted">
                    Obbies, tycoons, hangouts, things nobody has a word for yet.
                    Walk into any of them.
                  </p>
                  <Button to="/discover" variant="yes" className="shrink-0">play!</Button>
                </div>
              </Link>
            </div>
          }
        />

        {/* -------------------------------------------------- a wide row */}
        <Row
          name="The wide row"
          now={
            <div className="flex flex-wrap items-center gap-5 rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
              <img src={asset('/mascot/construction_worker.png')} alt="" aria-hidden="true"
                className="h-20 w-16 shrink-0 select-none object-contain" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-extrabold leading-none">
                  Report anything, anywhere. A person reads it.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Your name never travels with a report. Moderation is people, and
                  the only thing a machine does here is point one of them at it.
                </p>
              </div>
              <Link to="/policies" className="text-sm font-bold text-link underline underline-offset-4">The rules</Link>
            </div>
          }
          next={
            <div className="overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-ink-card">
              <Strip title="Somebody reads it" tone="gold" right={<Link to="/policies" className="hover:underline">the rules ▸</Link>} />
              <div className="flex items-center gap-5 p-5">
                <img src={asset('/mascot/construction_worker.png')} alt="" aria-hidden="true"
                  className="h-24 w-20 shrink-0 select-none object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-extrabold leading-tight">
                    Report anything, anywhere. A person reads it.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    Your name never travels with a report. Moderation is people,
                    and the only thing a machine does here is point one of them
                    at it.
                  </p>
                </div>
              </div>
            </div>
          }
        />

        {/* ------------------------------------------------ the loud one */}
        <Row
          name="The loud one"
          now={
            <div className="relative overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line">
              <img src={asset('/brand/waves.png')} alt="" aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/45" />
              <div className="relative flex items-center gap-6 p-7">
                <img src={asset('/about/can.png')} alt="" aria-hidden="true"
                  className="w-28 shrink-0 select-none drop-shadow-2xl" style={{ transform: 'rotate(-6deg)' }} />
                <div className="min-w-0">
                  <p className="font-display text-2xl font-extrabold leading-none text-on-art">Go on then. Build one.</p>
                  <p className="mt-3 text-lede leading-relaxed text-on-art/75">
                    Worlds are built in Kobblon Workspace, on the desktop. Publish
                    one and it is here, ready for people, two minutes later.
                  </p>
                  <div className="mt-5"><Button to="/download" variant="primary">Get Workspace</Button></div>
                </div>
              </div>
            </div>
          }
          next={
            <div className="overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-ink-card">
              <Strip title="Go on then. Build one." tone="brand" right="free" />
              <div className="relative">
                <img src={asset('/brand/waves.png')} alt="" aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/55" />
                <div className="relative flex items-center gap-5 p-5">
                  <img src={asset('/about/can.png')} alt="" aria-hidden="true"
                    className="w-24 shrink-0 select-none drop-shadow-2xl" style={{ transform: 'rotate(-6deg)' }} />
                  <div className="min-w-0">
                    <p className="text-sm leading-relaxed text-on-art/85">
                      Worlds are built in Kobblon Workspace, on the desktop.
                      Publish one and it is here, ready for people, two minutes
                      later.
                    </p>
                    <div className="mt-3.5 flex flex-wrap items-center gap-3">
                      <Button to="/download" variant="primary">Get Workspace</Button>
                      <Link to="/create" className="text-xs font-bold text-on-art/70 underline underline-offset-4 hover:text-on-art">
                        or start in the Creator Hub
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        />
      </div>
    </div>
  )
}

const out = { profile: null, session: null, loading: false } as unknown as AuthValue

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/about']}>
    <ThemeProvider>
      <AuthContext.Provider value={out}>
        <ToastProvider><Sheet /></ToastProvider>
      </AuthContext.Provider>
    </ThemeProvider>
  </MemoryRouter>,
)
