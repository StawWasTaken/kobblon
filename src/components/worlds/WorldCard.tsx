import { Picture } from '@/components/brand/Picture'
import { Link } from 'react-router-dom'
import { worldLink } from '@/lib/links'
import { WorldStats } from '@/components/worlds/WorldStats'
import { cn } from '@/lib/cn'
import { worldEmblem } from '@/lib/worldart'
import type { World } from '@/types/db'

/**
 * A World, the one way a World is drawn: the square emblem, the name under
 * it, and the numbers under that.
 *
 * Staw, on the panel this replaces: "most liked, just published and being
 * played doesnt use a correct way to display worlds. this one isnt valid".
 * What was there was a bordered card with the picture let into the top of
 * it and two clamped lines of description under the name - the shape every
 * platform's browse grid has, and the shape a shelf of them does not read
 * as. Beside `WorldTile` on the same page it was plainly a second way of
 * drawing the same thing, which round 339 says there is not.
 *
 * So there is one drawing now and this is it, at whatever width it is given:
 * a grid cell, or the fixed width `WorldTile` hands it on a shelf. No card
 * around it, no description, no genre tag - the emblem is the thing being
 * looked at, and a border drawn round the whole card fights the border on
 * the emblem.
 */
export function WorldCard({
  world, creator = true, className,
}: {
  world: World
  /** "By somebody" under the name. Off on a shelf, where it is noise. */
  creator?: boolean
  className?: string
}) {
  /*
   * Only ever on your own Worlds: `worlds_read` lets nobody else see an
   * unpublished row, so this cannot appear on somebody else's profile.
   * Drawn because without it the Creator Hub and your own profile show
   * drafts beside published Worlds with nothing saying which is which.
   */
  const draft = world.is_published === false

  return (
    <article className={cn('group min-w-0', className)}>
      <Link
        to={worldLink(world)}
        className="relative block aspect-square overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-media transition-colors group-hover:border-brand/70"
      >
        <Picture
          src={worldEmblem(world)}
          alt={world.name}
          className="h-full w-full"
          pictureClassName="transition-transform duration-300 group-hover:scale-[1.04]"
        />
        {draft && (
          <span className="absolute left-1.5 top-1.5 rounded-lg bg-ink/85 px-1.5 py-0.5 text-mini font-extrabold uppercase tracking-wide text-white/80">
            Draft
          </span>
        )}
      </Link>

      <Link
        to={worldLink(world)}
        className="mt-1.5 block line-clamp-2 text-sm font-bold leading-tight hover:text-link"
      >
        {world.name}
      </Link>

      {creator && (
        <p className="truncate text-xs text-muted">By {world.creator_name ?? 'Kobblon'}</p>
      )}

      <WorldStats world={world} className="mt-0.5" />
    </article>
  )
}
