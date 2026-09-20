import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faThumbsUp, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import { worldLink } from '@/lib/links'
import { formatCount } from '@/lib/format'
import { Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import type { World } from '@/types/db'

/**
 * A World on the front page is a poster, not a tile in a grid: the emblem
 * fills the frame, the name sits on top of it, and the numbers under it are
 * the real ones. The first one is given the room it deserves and the rest
 * stand beside it, stepped down the page rather than lined up in a row.
 */
function Poster({ world, tall }: { world: World; tall?: boolean }) {
  return (
    <Link
      to={worldLink(world)}
      className={cn(
        'group relative block overflow-hidden rounded-[1.75rem] border border-white/10 bg-media',
        'transition-transform duration-300 hover:-translate-y-1.5',
        tall ? 'aspect-[4/3] sm:aspect-[4/5]' : 'aspect-[16/10]',
      )}
    >
      {world.cover_url ? (
        <img
          src={world.cover_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
        />
      ) : (
        <span className="grid h-full w-full place-items-center">
          <FontAwesomeIcon icon={worldIcon} className="text-5xl text-white/15" />
        </span>
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent" />

      <span className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <span className={cn('block font-display font-extrabold leading-tight', tall ? 'text-3xl' : 'text-xl')}>
          {world.name}
        </span>

        <span className="mt-1 block text-sm text-white/65">
          by {world.creator_name ?? 'Kobblon'}
        </span>

        <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-white/55">
          <span className="inline-flex items-center gap-1.5">
            <FontAwesomeIcon icon={faEye} />
            {formatCount(world.visit_count)}
          </span>
          {world.like_count > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <FontAwesomeIcon icon={faThumbsUp} />
              {formatCount(world.like_count)}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-space-bright opacity-0 transition-opacity group-hover:opacity-100">
            Play
            <FontAwesomeIcon icon={faArrowRight} />
          </span>
        </span>
      </span>
    </Link>
  )
}

export function WorldStage({ worlds, loading }: { worlds: World[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Skeleton className="aspect-[5/6] rounded-[1.75rem]" />
        <div className="grid gap-6">
          <Skeleton className="aspect-[16/10] rounded-[1.75rem]" />
          <Skeleton className="aspect-[16/10] rounded-[1.75rem]" />
        </div>
      </div>
    )
  }

  /*
   * How it is laid out depends on how much there is. One World on its own
   * gets a wide frame rather than a tower; two sit side by side; three or
   * more get the stage, with the first given the room and the rest stepped
   * down beside it.
   */
  if (worlds.length === 1) {
    return (
      <div className="mx-auto max-w-3xl">
        <Poster world={worlds[0]} />
      </div>
    )
  }

  if (worlds.length === 2) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
        {worlds.map((world) => <Poster key={world.id} world={world} />)}
      </div>
    )
  }

  const [lead, ...rest] = worlds

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
      <Poster world={lead} tall />

      <div className="grid content-center gap-6 lg:gap-8 lg:pt-10">
        {rest.slice(0, 2).map((world) => <Poster key={world.id} world={world} />)}
      </div>
    </div>
  )
}
