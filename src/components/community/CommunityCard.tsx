import { Link } from 'react-router-dom'
import { formatCount } from '@/lib/format'
import type { Community, MemberCommunity } from '@/types/db'
import { communityLink } from '@/lib/links'
import { Verified } from '@/components/brand/Verified'
import { Emblem } from '@/components/community/Emblem'

/*
 * One Community in a grid: emblem, name, how many are in it.
 *
 * It takes either shape the site has - a row from the directory, or a row
 * from `member_communities` - because the card is the same card and Home
 * had quietly grown its own copy of it without the tick.
 */
export function CommunityCard({ community }: { community: Community | MemberCommunity }) {
  const { name, icon_url: icon } = community
  return (
    <Link
      to={communityLink(community)}
      className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-card p-3 transition-colors hover:border-brand/60"
    >
      <Emblem src={icon} name={name} className="h-12 w-12 text-base" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-bold">{name}</span>
          {community.is_verified && (
            <Verified className="text-xs" />
          )}
        </span>
        <span className="block text-xs text-muted">{formatCount(community.member_count)} members</span>
      </span>
    </Link>
  )
}
