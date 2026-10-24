import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Verified } from '@/components/brand/Verified'
import { Skeleton } from '@/components/ui/States'
import { communityLink } from '@/lib/links'
import { formatCount } from '@/lib/format'
import type { Community } from '@/types/db'

/**
 * Communities as cards rather than as a row of badges.
 *
 * The badge row it replaces stepped every other emblem down by eight
 * pixels, which looked like a decision and read as a misalignment, and it
 * gave a Community nothing but its emblem and a number - no way to tell a
 * build team from a fan club without opening it. A card has room for the
 * emblem, the name, whether it is verified and how many people are in it,
 * and four of them line up with the four of everything else on this page.
 */
export function CommunityWall({
  communities, loading,
}: {
  communities: Community[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-3xl" />)}
      </div>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {communities.map((group) => (
        <li key={group.id}>
          <Link
            to={communityLink(group)}
            className="group flex h-full flex-col rounded-3xl border border-white/10 bg-ink-card/60 p-6 transition-[border-color,transform] hover:-translate-y-1 hover:border-brand-bright/50"
          >
            <span className="block h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-media">
              {group.icon_url ? (
                <img
                  src={group.icon_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="grid h-full w-full place-items-center font-display text-xl font-extrabold text-white/60">
                  {group.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </span>

            <span className="mt-5 flex items-center gap-1.5">
              <span className="min-w-0 truncate font-display text-lg font-extrabold">
                {group.name}
              </span>
              {group.is_verified && <Verified className="shrink-0 text-[10px]" />}
            </span>

            <span className="mt-auto flex items-center gap-2 pt-4 text-xs font-bold text-white/40">
              {formatCount(group.member_count)} members
              <Glyph
                icon={faArrowRight}
                className="ml-auto text-sm text-link transition-transform group-hover:translate-x-1"
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
