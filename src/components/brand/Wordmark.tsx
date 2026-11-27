import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { asset } from '@/lib/asset'

/**
 * The name and the mark, in whichever appearance is being worn.
 *
 * One drawing, in every mode. `wordmark.png` and `logomark.png` - the
 * official pair, the ones with the stroke - are what the site wears dark
 * and light alike, because a stroked mark holds on both and that is what
 * the stroke is for. The flat silhouettes are not used anywhere any more:
 * they live at `wordmark2` and `logomark-darkmode`, and inverting one gave
 * a black name, which is not the mark and never was. The `-lightmode`
 * recolours are not used either, for the same reason.
 *
 * Staw swapped those names round: "the 'logomark' and 'wordmark' are both
 * without the strokes, while the 'wordmark2' and the 'logomark-darkmode'
 * are with the strokes (the one we use officially)". So the plain name is
 * the official drawing now, which is what a plain name should be. Nothing
 * on the site changed appearance - every reference moved with its own
 * picture.
 *
 * **Chosen by CSS, not by a hook.** All of them are in the markup and all
 * but one are hidden, the same way the avatar backdrop does it. Two reasons
 * and both have bitten this project: a hook needs its provider and these
 * mount in the Workspace, on bare pages and on the way in before anybody
 * has signed in; and a source that is computed after the first paint is a
 * blue mark that turns orange a moment later on every single load.
 *
 * `data-appearance` is on the document element, so the answer is there with
 * nothing supplied. Where it has never been set - which is the Workspace,
 * and any page mounted alone - the ordinary one is drawn, which is right.
 */
const LOOKS = [
  { look: 'default', mode: 'dark', wordmark: '/brand/wordmark.png', logomark: '/brand/logomark.png' },
  { look: 'halloween', mode: 'dark', wordmark: '/brand/wordmark-halloween.png', logomark: '/brand/logomark-halloween.png' },
  { look: 'christmas', mode: 'dark', wordmark: '/brand/wordmark-christmas.png', logomark: '/brand/logomark-christmas.png' },
  /*
   * Daylight, and the same drawing. Staw: "for the appearance & for the
   * navbar you should now use logomark & wordmark images (the official
   * ones)".
   *
   * There used to be a recoloured pair here - a dark fill for the pale bar,
   * learned off the old flat marks. It was built before the official
   * stroked drawing took the plain names, and it was never the official
   * mark: on the daylight bar the name came out as a dark smear and the
   * appearance tile in Settings wore a mark nothing else on the site wears.
   * A stroked mark does not need a second drawing, which is the whole
   * reason for the stroke: a white fill inside a brand-blue outline reads
   * on the deep bar and on the pale one.
   *
   * The seasonal drawings are one each, Staw's, and they are not flipped
   * or tinted: halloween is a dark fill in an orange outline and christmas
   * is red glitter in a silver one, and both read on either bar.
   *
   */
  { look: 'default', mode: 'light', wordmark: '/brand/wordmark.png', logomark: '/brand/logomark.png' },
  { look: 'halloween', mode: 'light', wordmark: '/brand/wordmark-halloween.png', logomark: '/brand/logomark-halloween.png' },
  { look: 'christmas', mode: 'light', wordmark: '/brand/wordmark-christmas.png', logomark: '/brand/logomark-christmas.png' },
] as const

/*
 * A height the caller asks for actually wins.
 *
 * `cn` joins rather than merges, so a default `h-5 sm:h-6` written into the
 * class list and an `h-14 sm:h-16` passed in from outside are both present
 * and whichever Tailwind emitted later wins - which is not the one the
 * caller asked for, and which is silent. The applications session lost
 * three goes to it putting this mark over the Launcher's login card, and
 * had to force it with `!h-14`.
 *
 * Forcing is not the fix, because the next caller has to know to force. The
 * default is simply not written when the caller has said a height, so the
 * two never meet in the first place. Same trap as `Title` and `Character`;
 * this is the first one where the component could keep its own default and
 * still give way.
 */
function heights(className: string | undefined, fallback: string) {
  return /(^|[\s:])!?h-/.test(className ?? '') ? undefined : fallback
}

/*
 * The name, falling back to the mark where the name will not fit.
 *
 * Staw: "for the logomark its only when the wordmark is too small". So the
 * two are not a lockup and are never drawn side by side - the logomark is
 * what the wordmark becomes when there is no room for nine letters, which
 * on this site is the bar at phone width, where it shares a line with the
 * menu button, the search and everything on the right.
 *
 * The swap is a breakpoint rather than a measurement: a component that
 * measures its own box has to render once to find out, and the one thing
 * this must not do is change a moment after the page has drawn.
 */
/**
 * How long Staw's reveal takes to draw the name, in milliseconds.
 *
 * Measured off the file rather than guessed: the frame delays in
 * `logo-reveal.gif` add up to 3.95 seconds. It is a looping GIF and its
 * last frames are **not** the finished name - left alone it runs the
 * reveal again for ever, and a navigation bar that re-animates every four
 * seconds is a navigation bar nobody can read a word on. So it is swapped
 * for the still mark the moment the name is fully drawn, which is what
 * makes it read as an entrance rather than as a loop.
 */
const REVEAL_MS = 3800

export function Wordmark({ className, to = '/', always = false, reveal = false }: {
  className?: string
  to?: string | null
  /**
   * Draw the name with Staw's reveal animation, once, then settle into the
   * ordinary mark.
   *
   * The caller decides *whether* - the At Kobblon bar rolls for it on each
   * load, so the reveal is a thing that happens sometimes rather than a
   * thing that happens every time, which is the difference between a
   * flourish and a splash screen. Only the default appearance has one
   * here: the seasonal reveals are a megabyte and a half and five
   * megabytes, which is not a navigation bar's worth of picture.
   */
  reveal?: boolean
  /**
   * Keep the full wordmark at every width.
   *
   * For the places that have a line to themselves - the footer, the story
   * pages - where the mark on its own would just look like something
   * failed to load.
   */
  always?: boolean
}) {
  /*
   * Decided here and then left alone. `playing` starts true so the first
   * paint is already the animation - a mark that swaps to a GIF a moment
   * after the page draws is the mark appearing twice.
   */
  const [playing, setPlaying] = useState(reveal)

  useEffect(() => {
    if (!playing) return
    const stop = window.setTimeout(() => setPlaying(false), REVEAL_MS)
    return () => window.clearTimeout(stop)
  }, [playing])

  const img = (
    <span className={cn('relative inline-flex items-center', heights(className, 'h-5 sm:h-6'), className)}>
      {/*
       * The reveal, drawn **over** the still mark rather than in place of
       * it, at two and two thirds its height.
       *
       * Staw's animation is on a 420x215 canvas with the name floating in
       * the middle of it, so at the bar's own height the letters came out
       * a third of the size and then jumped when the still one took over.
       * Sized and centred on the still mark instead, the letters are the
       * same letters at the same size and the handover is invisible - and
       * because the box underneath is the still mark, nothing on the bar
       * moves when the animation ends.
       *
       * Only the default appearance has one: the seasonal reveals are a
       * megabyte and a half and five megabytes.
       */}
      {playing && (['dark', 'light'] as const).map((mode) => (
        /* One per mode, because `.kob-mark` is hidden until a look and a
           mode both match - which is also what keeps the reveal off the
           seasonal appearances without a second check in here. */
        <img
          key={mode}
          data-look="default"
          data-mode={mode}
          src={asset('/brand/logo-reveal.gif')}
          alt=""
          aria-hidden="true"
          className="kob-mark pointer-events-none absolute left-1/2 top-1/2 h-[250%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
        />
      ))}
      {!always && (
        <span className="inline-flex h-full items-center sm:hidden">
          {LOOKS.map((one) => (
            <img
              key={`${one.look}-${one.mode}`}
              data-look={one.look}
              data-mode={one.mode}
              src={asset(one.logomark)}
              alt={one.look === 'default' ? 'Kobblon' : ''}
              aria-hidden={one.look === 'default' ? undefined : true}
              className="kob-mark h-full w-auto select-none"
            />
          ))}
        </span>
      )}

      <span className={cn('h-full items-center', always ? 'inline-flex' : 'hidden sm:inline-flex')}>
        {LOOKS.map((one) => (
          <img
            key={`${one.look}-${one.mode}`}
            data-look={one.look}
            data-mode={one.mode}
            src={asset(one.wordmark)}
            alt={one.look === 'default' ? 'Kobblon' : ''}
            aria-hidden={one.look === 'default' ? undefined : true}
            className="kob-mark h-full w-auto select-none"
          />
        ))}
      </span>
    </span>
  )
  return to ? (
    /*
     * `shrink-0` on the link itself, not only on the span inside it.
     *
     * In the top bar this sits in a flex row beside a search field that
     * asks for `w-full`, so the link - which had nothing saying otherwise -
     * was squeezed to six pixels while the mark inside it stayed thirteen.
     * The K then hung out of its own box and under the search field, which
     * is the clipped logo on a phone. Staw: "the logomark looks weird on
     * how you put it".
     */
    <Link to={to} className="inline-flex shrink-0 items-center" aria-label="Kobblon home">
      {img}
    </Link>
  ) : (
    img
  )
}

/**
 * The mark on its own, for somewhere there is no room for the name at all.
 *
 * Mostly this is not what you want: `Wordmark` already falls back to it at
 * phone width, which is the case Staw was describing. This is for a square
 * - a favicon-sized corner, a tile - where the name was never going to go.
 */
export function Logomark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center', heights(className, 'h-7'), className)} aria-hidden="true">
      {LOOKS.map((one) => (
        <img
          key={`${one.look}-${one.mode}`}
          data-look={one.look}
          data-mode={one.mode}
          src={asset(one.logomark)}
          alt=""
          className="kob-mark h-full w-auto select-none"
        />
      ))}
    </span>
  )
}
