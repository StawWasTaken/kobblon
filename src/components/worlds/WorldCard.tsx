import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faThumbsUp, faTag } from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import { worldLink } from '@/lib/links'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { World, WorldGenre } from '@/types/db'

/**
 * A World the way a shelf of them shows one: the emblem, big, with the name
 * under it, who built it, and how many have been.
 *
 * The emblem does the work, so it is given the room. A World with none is
 * not a broken card: it is its mark on its own colours, which is still
 * something to look at.
 */
export function WorldCard({
  world, genres, className,
}: { world: World; genres?: WorldGenre[]; className?: string }) {
  const up = world.like_count ?? 0
  const down = world.dislike_count ?? 0
  const score = up + down ? Math.round((up / (up + down)) * 100) : null
  const genre = genres?.find((one) => one.id === world.genre)

  return (
    <article
      className={cn(
        'group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-ink-line bg-ink-card transition-colors hover:border-brand/70',
        className,
      )}
    >
      <Link to={worldLink(world)} className="relative block aspect-[16/10] overflow-hidden bg-media">
        {world.cover_url ? (
          <img
            src={world.cover_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <FontAwesomeIcon icon={worldIcon} className="text-3xl text-white/20" />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <Link
          to={worldLink(world)}
          className="truncate font-display text-base font-extrabold text-link hover:underline"
        >
          {world.name}
        </Link>

        <p className="truncate text-xs text-muted">
          By {world.creator_name ?? 'Kobblon'}
        </p>

        {world.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-white/50">{world.description}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] font-bold text-muted">
          <span className="inline-flex items-center gap-1">
            <FontAwesomeIcon icon={faEye} />
            {formatCount(world.visit_count ?? 0)}
          </span>
          {score !== null && (
            <span className="inline-flex items-center gap-1">
              <FontAwesomeIcon icon={faThumbsUp} />
              {score}%
            </span>
          )}
          {genre && (
            <span className="inline-flex items-center gap-1 truncate">
              <FontAwesomeIcon icon={faTag} />
              {genre.label}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
