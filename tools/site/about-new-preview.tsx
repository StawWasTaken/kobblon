/*
 * What is Kobblon, proposed - one screen instead of six thousand pixels.
 *
 * What is wrong with the page today: it is five bands of picture-left,
 * heading-and-two-grey-lines-right, alternating. That shape is the
 * corporate marketing page, and the strange things Kobblon actually has -
 * the can, the stickers, Kobby - are buried inside it.
 *
 * So: one screen. The name, one sentence a person would say, three facts
 * that are true and that no other platform can write, and three ways in.
 * Everything else was a link to somewhere that already explains itself.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'
import '@/index.css'

/** A sticker, dropped on the page at an angle. Decoration, and it says so. */
function Sticker({ name, className, turn }: {
  name: string; className?: string; turn: number
}) {
  return (
    <img
      src={asset(`/stickers/plunk/${name}.webp`)}
      alt=""
      aria-hidden="true"
      className={cn('pointer-events-none absolute w-16 select-none drop-shadow-2xl sm:w-24', className)}
      style={{ transform: `rotate(${turn}deg)` }}
    />
  )
}

/** One true thing, in the pixel face, with the sentence under it. */
function Fact({ big, says }: { big: string; says: string }) {
  return (
    <div className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card/80 p-5 backdrop-blur-sm">
      <p className="font-display text-xl font-extrabold leading-none text-on-art">{big}</p>
      <p className="mt-2 text-sm leading-snug text-on-art/60">{says}</p>
    </div>
  )
}

function AboutNew() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
      {/* The whole page stands on one picture, not on a colour. */}
      <img
        src={asset('/about/towers-sunset.webp')}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] w-full object-cover"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-gradient-to-b from-brand-ink/40 via-ink/70 to-ink"
      />

      <Sticker name="excited" turn={-14} className="left-[4%] top-[16%]" />
      <Sticker name="smug" turn={11} className="right-[6%] top-[10%]" />

      <div className="relative mx-auto max-w-4xl px-5 pb-20 pt-16 text-center sm:pt-24">
        <img
          src={asset('/about/wordmark-brush.webp')}
          alt="Kobblon"
          className="mx-auto w-[min(80vw,30rem)] select-none"
        />

        <p className="mx-auto mt-8 max-w-2xl font-display text-2xl font-extrabold leading-[1.1] text-on-art sm:text-4xl">
          People build things here.
          <br />
          Then they stand inside them.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button to="/signup" variant="yes" size="lg">Make an account</Button>
          <Button to="/discover" variant="subtle" size="lg">Look around first</Button>
        </div>

        {/* The three things that are true here and are not true next door.
            No headings over them: each one is its own heading. */}
        <div className="mt-16 grid gap-3 text-left sm:grid-cols-3">
          <Fact
            big="Made by people"
            says="Every World, every item, every face. Nothing here was generated."
          />
          <Fact
            big="No bots"
            says="If it says four people are playing, four people are playing."
          />
          <Fact
            big="Free"
            says="Make an account, build a World, put it out. Nothing to pay."
          />
        </div>

        {/* The can carries the second half rather than floating over it:
            the page had a hundred pixels of nothing under it and the one
            strange object on the screen was marooned in the middle. */}
        <div className="relative mt-16 overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line text-left">
          <img
            src={asset('/brand/waves.png')}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/45" />
          <div className="relative flex flex-col items-center gap-6 p-7 sm:flex-row sm:p-9">
            <img
              src={asset('/about/can.png')}
              alt=""
              aria-hidden="true"
              className="w-28 shrink-0 select-none drop-shadow-2xl sm:w-36"
              style={{ transform: 'rotate(-6deg)' }}
            />
            <div className="min-w-0">
              <p className="font-display text-2xl font-extrabold leading-none text-on-art">
                Build one yourself.
              </p>
              <p className="mt-3 text-lede leading-relaxed text-on-art/75">
                Worlds are built in Kobblon Workspace, on the desktop. Publish
                one and it is here, ready for people, two minutes later.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button to="/download" variant="primary">Get Workspace</Button>
                <Link
                  to="/create"
                  className="text-sm font-bold text-on-art/70 underline underline-offset-4 transition-colors hover:text-on-art"
                >
                  or start in the Creator Hub
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Somebody new, looking up at the whole thing. The drawing has
            been in the repository unused since it arrived. */}
        <img
          src={asset('/mascot/newbie.png')}
          alt=""
          aria-hidden="true"
          className="pointer-events-none mx-auto mt-12 w-28 select-none opacity-90"
        />
        <p className="mt-3 text-mini font-extrabold uppercase tracking-[0.3em] text-on-art/35">
          See you in there
        </p>

      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <AboutNew />
  </MemoryRouter>,
)
