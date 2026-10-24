import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faEye, faThumbsUp, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import { worldLink } from '@/lib/links'
import { formatCount } from '@/lib/format'
import { Skeleton } from '@/components/ui/States'
import type { World } from '@/types/db'

/**
 * The Worlds on the front page, as a chart rather than as posters.
 *
 * The poster collage this replaces had two problems Staw named: three
 * covers at three different sizes is a collage, and a cover with the name
 * written over it hides the one picture the builder chose. So each World is
 * a row - the rank in the margin, the cover as a strip beside it, the name
 * in full display type on the page's own floor, and the real numbers at the
 * end. A list of rows reads top to bottom, which is what a chart of what
 * people are playing is for, and it works at phone width without becoming
 * three stacked squares.
 *
 * Nothing is written over a cover anywhere in here.
 */
function Row({ world, rank }: { world: World; rank: number }) {
  return (
    <li>
      <Link
        to={worldLink(world)}
        className="group grid grid-cols-[auto_8rem_1fr] items-center gap-5 border-t border-white/[0.07] py-5 transition-colors hover:border-brand-bright/40 sm:grid-cols-[auto_12rem_1fr_auto] sm:gap-7 sm:py-7"
      >
        <span className="font-display text-xl font-extrabold tabular-nums text-white/25 transition-colors group-hover:text-brand-bright sm:text-2xl">
          {String(rank).padStart(2, '0')}
        </span>

        <span className="block aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-media">
          {world.cover_url ? (
            <img
              src={world.cover_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
            />
          ) : (
            <span className="grid h-full w-full place-items-center">
              <Glyph icon={worldIcon} className="text-2xl text-white/15" />
            </span>
          )}
        </span>

        <span className="min-w-0">
          <span className="block truncate font-display text-xl font-extrabold leading-tight transition-colors group-hover:text-brand-bright sm:text-3xl">
            {world.name}
          </span>
          <span className="mt-1 block truncate text-sm text-white/45">
            by {world.creator_name ?? 'Kobblon'}
          </span>
        </span>

        <span className="col-span-3 flex items-center gap-5 text-xs font-bold text-white/50 sm:col-span-1 sm:justify-end sm:text-sm">
          <span className="inline-flex items-center gap-2">
            <Glyph icon={faEye} className="text-white/30" />
            {formatCount(world.visit_count)}
          </span>
          {world.like_count > 0 && (
            <span className="inline-flex items-center gap-2">
              <Glyph icon={faThumbsUp} className="text-white/30" />
              {formatCount(world.like_count)}
            </span>
          )}
          <Glyph
            icon={faArrowRight}
            className="text-link transition-transform group-hover:translate-x-1"
          />
        </span>
      </Link>
    </li>
  )
}

export function WorldChart({ worlds, loading }: { worlds: World[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-5">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    )
  }

  return (
    <ul className="border-b border-white/[0.07]">
      {worlds.map((world, at) => <Row key={world.id} world={world} rank={at + 1} />)}
    </ul>
  )
}
