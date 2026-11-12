import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { faThumbsUp } from '@fortawesome/free-solid-svg-icons'
import { usePlaying } from '@/hooks/usePlaying'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The two numbers under a World, wherever one is drawn.
 *
 * Staw: "instead of showing the ratio like-dislike and visits, it must be
 * ratio like-dislike And actual players (actual number of people playing
 * actually in all servers)". He is right about which two: visits is how
 * many people have ever opened it, which only ever goes up and says
 * nothing about tonight, and the thing somebody picking a World wants to
 * know is whether there is anybody in there.
 *
 * So: how well people rated it, and how many are in it now. The live count
 * is asked for by `usePlaying`, which collects every card on the page into
 * one question.
 *
 * **Zero is printed.** Staw: "even when theres zero ppl then put 0" - a
 * card with no number beside the mark reads as "we do not know", and the
 * whole point of the number is that somebody deciding what to open can
 * tell a busy World from a quiet one. Zero is grey; green is kept for a
 * World that actually has somebody in it. Only a count nobody has been
 * told yet draws nothing.
 */
export function WorldStats({ world, size = 'sm', className }: {
  world: {
    id: string
    like_count?: number | null
    dislike_count?: number | null
  }
  /** `sm` under a card, `md` where the row is the page's own furniture. */
  size?: 'sm' | 'md'
  className?: string
}) {
  const up = world.like_count ?? 0
  const down = world.dislike_count ?? 0
  const score = up + down ? Math.round((up / (up + down)) * 100) : null
  const playing = usePlaying(world.id)

  if (score === null && playing === null) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-3 font-bold text-muted',
        size === 'sm' ? 'text-mini' : 'text-xs',
        className,
      )}
    >
      {score !== null && (
        <span className="inline-flex items-center gap-1">
          <Glyph icon={faThumbsUp} className={size === 'sm' ? 'text-tiny' : undefined} />
          {score}%
        </span>
      )}

      {playing !== null && (
        /* Green, because it is the one number on the card that is true only
           while somebody is looking at it - and only while somebody is. */
        <span className={cn('inline-flex items-center gap-1', playing > 0 && 'text-space-bright')}>
          <Icon name="playing" className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          {formatCount(playing)}
        </span>
      )}
    </span>
  )
}
