import { Link } from 'react-router-dom'
import { faEye, faPlay, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Avatar } from '@/components/ui/Avatar'
import { formatCount, timeAgo } from '@/lib/format'
import { clipLink, profileLink, worldLink } from '@/lib/links'
import { cn } from '@/lib/cn'
import type { Clip } from '@/lib/api'

/** mm:ss, because a clip is never long enough for anything else. */
function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/*
 * A clip, as a card.
 *
 * The still frame, how long it runs, who kept it and which World it came
 * out of - which is the part that does the work, because a clip somebody
 * sends you is an advert for a World with no advert in it.
 *
 * It takes a row and a poster address rather than fetching either, so it
 * mounts anywhere, the applications included.
 */
export function ClipCard({ clip, poster, className }: {
  clip: Clip
  /** The still, already resolved to an address. */
  poster?: string | null
  className?: string
}) {
  return (
    <article className={cn('group min-w-0', className)}>
      <Link
        to={clipLink(clip)}
        className="relative block aspect-video overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised transition-colors hover:border-brand/60"
      >
        {poster ? (
          <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-white/15">
            <Glyph icon={faPlay} className="text-2xl" />
          </span>
        )}

        {/* The one thing a still frame cannot say. */}
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-tiny font-extrabold tabular-nums text-white">
          {clock(clip.seconds)}
        </span>

        {clip.privacy === 'friends' && (
          <span
            title="Friends only"
            className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-black/70 text-white/90"
          >
            <Glyph icon={faUserGroup} className="text-tiny" />
          </span>
        )}
      </Link>

      <div className="mt-2 flex items-start gap-2">
        <Link to={profileLink({ username: clip.owner_username })} className="shrink-0">
          <Avatar
            src={clip.owner_avatar_url ?? undefined}
            personId={clip.owner_id}
            name={clip.owner_display_name ?? clip.owner_username}
            size="sm"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={clipLink(clip)} className="block truncate text-sm font-bold hover:text-link">
            {clip.title || 'Clip'}
          </Link>
          <p className="truncate text-xs text-muted">
            {clip.world_name && clip.world_content_id ? (
              <Link
                to={worldLink({
                  content_id: clip.world_content_id,
                  slug: clip.world_slug,
                  name: clip.world_name,
                })}
                className="font-bold text-white/60 hover:text-link"
              >
                {clip.world_name}
              </Link>
            ) : (
              <span className="text-white/40">A World that is gone</span>
            )}
            {' · '}
            {timeAgo(clip.created_at)}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
          <Glyph icon={faEye} className="text-tiny" />
          {formatCount(clip.view_count)}
        </span>
      </div>
    </article>
  )
}

/** A row of them, the shape every shelf on this site uses. */
export function ClipShelf({ clips, posterOf, className }: {
  clips: Clip[]
  posterOf: (clip: Clip) => string | null
  className?: string
}) {
  if (!clips.length) return null
  return (
    <div className={cn(
      'grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
      className,
    )}>
      {clips.map((one) => (
        <ClipCard key={one.id} clip={one} poster={posterOf(one)} />
      ))}
    </div>
  )
}
