import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faThumbsUp, faThumbsDown } from '@fortawesome/free-solid-svg-icons'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Likes and dislikes either side of the ratio they add up to. With no votes
 * the bar sits empty rather than reading as all bad.
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

  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <button
        onClick={onLike}
        disabled={disabled}
        aria-pressed={iLike}
        aria-label="Like this World"
        className={cn(
          'flex shrink-0 flex-col items-center gap-1 text-[11px] font-bold transition-colors disabled:opacity-40',
          iLike ? 'text-space-bright' : 'text-white/60 hover:text-white',
        )}
      >
        <FontAwesomeIcon icon={faThumbsUp} className="text-base" />
        {formatCount(likes)}
      </button>

      <div className="min-w-0 flex-1 pt-2.5">
        <div
          className={cn(
            'h-1.5 overflow-hidden rounded-full',
            total ? 'bg-danger/70' : 'bg-white/10',
          )}
          role="img"
          aria-label={total ? `${Math.round(share)} percent liked` : 'No ratings yet'}
        >
          <div
            className="h-full rounded-full bg-space transition-[width] duration-300"
            style={{ width: `${share}%` }}
          />
        </div>
      </div>

      <button
        onClick={onDislike}
        disabled={disabled}
        aria-pressed={iDislike}
        aria-label="Dislike this World"
        className={cn(
          'flex shrink-0 flex-col items-center gap-1 text-[11px] font-bold transition-colors disabled:opacity-40',
          iDislike ? 'text-danger' : 'text-white/60 hover:text-white',
        )}
      >
        <FontAwesomeIcon icon={faThumbsDown} className="text-base" />
        {formatCount(dislikes)}
      </button>
    </div>
  )
}
