import { Glyph } from '@/components/brand/Glyph'
import { faThumbsUp, faThumbsDown } from '@fortawesome/free-solid-svg-icons'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * How much people like a World: the share, the number of votes, and the
 * two thumbs that let you add yours.
 *
 * Staw sent the shape as a screenshot - one dark pill, a thumb and a big
 * percentage on the left, the vote count under it in small capitals, and
 * two pressable squares on the right - with one change to it: the two
 * squares are a thumb up and a thumb down, up on the left, rather than a
 * pair of chevrons.
 *
 * It replaces the notched green-and-red line. The line asked the eye to
 * measure a bar; this says the number. The counts either side of the
 * line are gone too, because the thing somebody reads a rating for is the
 * share and the weight behind it, not the two halves separately.
 *
 * With no votes it shows a dash rather than nought percent, which is what
 * a World nobody has rated yet actually deserves: a red zero is a verdict
 * and there has not been one.
 *
 * It sizes itself now. The old one could not - it was a line that took
 * whatever width it was handed - so a caller that boxed it to its own
 * content got a rating with no ratio in it. This has nothing in it that
 * needs the room.
 */
export function RatingBar({
  likes, dislikes, iLike, iDislike, disabled, why, onLike, onDislike,
}: {
  likes: number
  dislikes: number
  iLike: boolean
  iDislike: boolean
  disabled?: boolean
  /** Why the thumbs cannot be pressed, where somebody may not press them. */
  why?: string
  onLike: () => void
  onDislike: () => void
}) {
  const total = likes + dislikes
  const share = total ? Math.round((likes / total) * 100) : null

  /* One button, twice. The two differ in which way the thumb points, which
     colour it takes when it is yours, and what it is called out loud. */
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
      title={disabled ? why : undefined}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 text-base transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        on
          ? which === 'up'
            ? 'border-space-bright/60 bg-space/25 text-space-bright'
            : 'border-danger/60 bg-danger/20 text-danger'
          : cn(
              'border-on-art/15 bg-on-art/10 text-on-art/75',
              !disabled && 'hover:border-on-art/30 hover:bg-on-art/20 hover:text-on-art',
            ),
      )}
    >
      <Glyph icon={which === 'up' ? faThumbsUp : faThumbsDown} on={on} />
    </button>
  )

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3 rounded-xl border-2 border-b-4 border-on-art/20 bg-black/45 px-3 py-2 backdrop-blur-sm">
        {/* The verdict. The thumb here is the label, not a control - it
            says what the number is a share of, so it is never pressable
            and never takes a colour from your own vote. */}
        <Glyph
          icon={faThumbsUp}
          on
          className="shrink-0 text-2xl leading-none text-on-art/85"
        />

        <div className="min-w-0 flex-1 leading-none">
          <p className="font-display text-2xl font-extrabold tabular-nums text-on-art">
            {share === null ? '-' : `${share}%`}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-on-art/60">
            {total === 1 ? '1 vote' : `${formatCount(total)} votes`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {thumb('up', iLike, onLike)}
          {thumb('down', iDislike, onDislike)}
        </div>
      </div>

      {/* Said out loud rather than left as two grey thumbs: a control that
          does nothing and does not say why is the page sulking. */}
      {disabled && why && (
        <p className="mt-1 text-center text-[11px] text-on-art/60">{why}</p>
      )}
    </div>
  )
}
