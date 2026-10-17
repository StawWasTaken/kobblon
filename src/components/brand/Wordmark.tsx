import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { asset } from '@/lib/asset'

/**
 * The name and the mark, in whichever appearance is being worn.
 *
 * There is a drawing for each mode rather than a filter: the white
 * silhouette for the dark interface it was drawn for, and `wordmark2`,
 * the blue-outlined one, for daylight. Inverting the white one gave a
 * flat black name, which is not the mark and never was. Nothing is
 * flipped here now; the logomark is brand blue and reads on either.
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
   * Daylight. The ordinary one is `wordmark2`, which is drawn with the
   * blue outline that carries it on a pale bar. The seasons get the flat
   * silhouette in a deep version of their colour instead, because their
   * three-dimensional drawings are nearly white inside and vanish there.
   */
  { look: 'default', mode: 'light', wordmark: '/brand/wordmark2.png', logomark: '/brand/logomark.png' },
  { look: 'halloween', mode: 'light', wordmark: '/brand/wordmark-halloween-light.png', logomark: '/brand/logomark-halloween-light.png' },
  { look: 'christmas', mode: 'light', wordmark: '/brand/wordmark-christmas-light.png', logomark: '/brand/logomark-christmas-light.png' },
] as const

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
export function Wordmark({ className, to = '/', always = false }: {
  className?: string
  to?: string | null
  /**
   * Keep the full wordmark at every width.
   *
   * For the places that have a line to themselves - the footer, the story
   * pages - where the mark on its own would just look like something
   * failed to load.
   */
  always?: boolean
}) {
  const img = (
    <span className={cn('inline-flex h-5 items-center sm:h-6', className)}>
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
    <Link to={to} className="inline-flex items-center" aria-label="Kobblon home">
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
    <span className={cn('inline-flex h-7 items-center', className)} aria-hidden="true">
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
