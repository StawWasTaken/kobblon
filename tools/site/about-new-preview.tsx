/*
 * What is Kobblon, proposed - one screen instead of six thousand pixels.
 *
 * What is wrong with the page today: it is five bands of picture-left,
 * heading-and-two-grey-lines-right, alternating. That shape is the
 * corporate marketing page, and the strange things Kobblon actually has -
 * the can, the faces, Kobby - are buried inside it.
 *
 * The second draft of this one had its own version of the same fault: three
 * equal cards in a row, each a bold label over one tidy line. Three of
 * anything, evenly spaced, with a label and a caption, is the shape a
 * machine writes. So the middle of the page is deliberately uneven now -
 * one big claim, two small ones beside it, a sentence with a joke in it -
 * and the faces are Kobblon's own reactions rather than stickers.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Link } from 'react-router-dom'
import { Icon } from '@/components/brand/Icon'
import { FACE_COLOUR } from '@/components/social/Reactions'
import { Button } from '@/components/ui/Button'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'
import '@/index.css'

/*
 * One of our own faces, dropped on the page at an angle.
 *
 * Painted its own colour rather than the colour of the page, which is what
 * `tone` does: these are the pressed ones, the way a face looks when
 * somebody has actually reacted with it.
 */
function Face({ face, className, turn, size = 'h-14 w-14 sm:h-20 sm:w-20' }: {
  face: keyof typeof FACE_COLOUR
  className?: string
  turn: number
  size?: string
}) {
  /*
   * The placing goes on a span of our own rather than on `Icon`.
   *
   * `Icon` paints a mask and, for the faces with something inside them -
   * the hearts, the tongue, the tears - stacks more than one span to do
   * it. The classes handed to it land on the paint, not on the box, so
   * `absolute top-[15%]` was being resolved against the icon itself and
   * every face piled up in the corner of the page.
   */
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute select-none', className)}
      style={{ transform: `rotate(${turn}deg)` }}
    >
      <Icon
        name={`reaction-${face}` as 'reaction-smile'}
        tone={FACE_COLOUR[face]}
        className={size}
      />
    </span>
  )
}

function AboutNew() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
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

      <Face face="heart-eyes" turn={-14} className="left-[5%] top-[7rem]" />
      <Face face="sunglasses" turn={12} className="right-[7%] top-[5rem]" />

      <div className="relative mx-auto max-w-4xl px-5 pb-20 pt-16 sm:pt-24">
        <img
          src={asset('/about/wordmark-brush.webp')}
          alt="Kobblon"
          className="mx-auto w-[min(80vw,30rem)] select-none"
        />

        <p className="mx-auto mt-8 max-w-2xl text-center font-display text-2xl font-extrabold leading-[1.1] text-on-art sm:text-4xl">
          People build things here.
          <br />
          Then they stand inside them.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button to="/signup" variant="yes" size="lg">Make an account</Button>
          <Button to="/discover" variant="subtle" size="lg">Look around first</Button>
        </div>

        {/* ------------------------------------------------- the one claim */}
        <div className="relative mt-20 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-7 sm:p-9">
            <Face face="skull" turn={9} className="right-6 top-6 opacity-80" size="h-16 w-16" />
            <p className="font-display text-3xl font-extrabold leading-[1.05] text-white sm:text-4xl">
              A person made
              <br />
              every single thing
              <br />
              on this website.
            </p>
            <p className="mt-5 max-w-md text-lede leading-relaxed text-muted">
              Every World, every hat, every face, every word. Nothing on Kobblon
              was generated and nothing on Kobblon ever will be. We are the
              other thing.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
              <p className="font-display text-xl font-extrabold leading-none">No bots. None.</p>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">
                If it says four people are playing, it is four people. We would
                rather look quiet than lie about it.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
              <p className="font-display text-xl font-extrabold leading-none">Free, and not the bad kind.</p>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">
                Make an account, build a World, put it out. Nothing is paywalled
                on the way in.
              </p>
            </div>
          </div>
        </div>

        {/* --------------------------------------------- what is in there */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            to="/discover"
            className="group relative overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6 transition-colors hover:border-brand"
          >
            <p className="font-display text-xl font-extrabold leading-none">Worlds</p>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              Obbies, tycoons, hangouts, things nobody has a word for yet. Walk
              into any of them.
            </p>
            <span className="mt-4 inline-block text-sm font-bold text-link">Discover →</span>
          </Link>

          <Link
            to="/communities"
            className="group relative overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6 transition-colors hover:border-brand"
          >
            <Face face="laugh" turn={-10} className="right-4 top-4 opacity-90" size="h-12 w-12" />
            <p className="font-display text-xl font-extrabold leading-none">Communities</p>
            <p className="mt-2.5 max-w-[22rem] text-sm leading-relaxed text-muted">
              Fan clubs, build teams and whatever else people start. Each one
              has a wall and a bank.
            </p>
            <span className="mt-4 inline-block text-sm font-bold text-link">Have a look →</span>
          </Link>
        </div>

        {/* ------------------------------------------------------ safety */}
        <div className="mt-6 flex flex-wrap items-center gap-5 rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
          <img
            src={asset('/mascot/construction_worker.png')}
            alt=""
            aria-hidden="true"
            className="w-16 shrink-0 select-none"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-extrabold leading-none">
              Report anything, anywhere. A person reads it.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Your name never travels with a report. Moderation is people, and
              the only thing a machine does here is point one of them at it.
            </p>
          </div>
          <Link to="/policies" className="text-sm font-bold text-link underline underline-offset-4">
            The rules
          </Link>
        </div>

        {/* ------------------------------------------------- build one */}
        <div className="relative mt-6 overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line">
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
                Go on then. Build one.
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

        {/* Somebody new, looking up at the whole thing. */}
        <div className="mt-14 text-center">
          <img
            src={asset('/mascot/newbie.png')}
            alt=""
            aria-hidden="true"
            className="pointer-events-none mx-auto w-28 select-none"
          />
          <p className="mt-3 font-display text-lg font-extrabold">See you in there.</p>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <AboutNew />
  </MemoryRouter>,
)
