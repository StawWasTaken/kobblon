import { Picture } from '@/components/brand/Picture'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faTag } from '@fortawesome/free-solid-svg-icons'
import { worldLink } from '@/lib/links'
import { WorldStats } from '@/components/worlds/WorldStats'
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
  const genre = genres?.find((one) => one.id === world.genre)

  return (
    <article
      className={cn(
        'group flex min-w-0 flex-col overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card transition-colors hover:border-brand/70',
        className,
      )}
    >
      <Link to={worldLink(world)} className="relative block aspect-[16/10] overflow-hidden bg-media">
        <Picture
          src={world.cover_url}
          alt={world.name}
          className="h-full w-full"
          pictureClassName="transition-transform duration-300 group-hover:scale-[1.03]"
        />
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

        {/* Not on a phone. Two of these cards fit across a phone, which is
            the only way a shelf of Worlds is not one card per screen - and
            at that width two clamped lines of description is what turns a
            card back into a block. The name, who made it and the numbers
            are what somebody is choosing between. */}
        {world.description && (
          <p className="hidden line-clamp-2 text-xs leading-relaxed text-white/50 sm:block">
            {world.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-mini font-bold text-muted">
          <WorldStats world={world} />
          {/* Not on a phone: two cards across leaves room for one line of
              numbers, and with the genre on it the line wrapped on one card
              and not the other, so a tidy grid came out ragged. */}
          {genre && (
            <span className="hidden sm:inline-flex items-center gap-1 truncate">
              <Glyph icon={faTag} />
              {genre.label}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
