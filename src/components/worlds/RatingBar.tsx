import { Glyph } from '@/components/brand/Glyph'
import { faThumbsUp, faThumbsDown } from '@fortawesome/free-solid-svg-icons'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Likes and dislikes, and the line that is the ratio between them.
 *
 * Staw sent the shape: the two thumbs apart at the top, one line running
 * the whole width underneath both of them, and the counts at the outer
 * ends under that. The line is the rating - green from the left as far as
 * people liked it, red the rest of the way - so the thing the eye reads
 * first is the ratio rather than two numbers it has to divide.
 *
 * With no votes the line sits flat and grey rather than reading as all
 * bad, which is what a red line at nought percent would say about a World
 * nobody has rated yet.
 *
 * It cannot size itself: the line is the width it is given. A caller that
 * puts it in a box sized to its own content gets a rating with no ratio in
 * it, which is exactly what happened on the World page's stage.
 */
export function RatingBar({
  likes, dislikes, iLike, iDislike, disabled, onLike, onDislike,
}: {
  likes: number
  dislikes: number
  iLike: boolean
  iDislike: boolean
  disabled?: boolean
  onLike: () => void
  onDislike: () => void
}) {
  const total = likes + dislikes
  const share = total ? (likes / total) * 100 : 0

  /* One button, twice, because the two differ only in which way the thumb
     points and which colour it takes when it is yours. */
  const thumb = (
    which: 'up' | 'down',
    on: boolean,
    press: () => void,
  ) => (
    <button
      onClick={press}
      disabled={disabled}
      aria-pressed={on}
      aria-label={which === 'up' ? 'Like this World' : 'Dislike this World'}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-lg text-lg transition-colors disabled:opacity-40',
        on
          ? (which === 'up' ? 'text-space-bright' : 'text-danger')
          : 'text-white/70 hover:bg-white/10 hover:text-white',
      )}
    >
      <Glyph icon={which === 'up' ? faThumbsUp : faThumbsDown} on={on} />
    </button>
  )

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between">
        {thumb('up', iLike, onLike)}
        {thumb('down', iDislike, onDislike)}
      </div>

      {/*
        * The line itself.
        *
        * Staw: "i want lil lines in it, i want a better bar design cuz
        * this is too basic". So it is notched - a mark every tenth, taller
        * at the quarters - which gives the eye something to measure the
        * green against. A bar with no marks on it only says "mostly good";
        * a notched one says "about four fifths", which is the thing
        * somebody is actually reading it for.
        *
        * The notches sit over both colours at the same strength, so the
        * join between green and red is the only edge that moves.
        */}
      <div
        className={cn(
          'relative mt-1.5 h-2.5 overflow-hidden rounded-full ring-1 ring-inset ring-white/10',
          total ? 'bg-danger' : 'bg-white/10',
        )}
        role="img"
        aria-label={total ? `${Math.round(share)} percent of ${formatCount(total)} liked it` : 'No ratings yet'}
        title={total ? `${Math.round(share)}% liked this` : 'No ratings yet'}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-space to-space-bright transition-[width] duration-300"
          style={{ width: `${share}%` }}
        />

        {/* The marks, drawn on top of whichever colour is under them. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 9 }, (_, i) => {
            const at = (i + 1) * 10
            const quarter = at === 25 || at === 50 || at === 75
            return (
              <span
                key={at}
                className={cn(
                  'absolute w-px bg-black/45',
                  quarter ? 'inset-y-0' : 'inset-y-[3px]',
                )}
                style={{ left: `${at}%` }}
              />
            )
          })}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] font-bold tabular-nums text-white/70">
        <span>{formatCount(likes)}</span>
        <span>{formatCount(dislikes)}</span>
      </div>
    </div>
  )
}
