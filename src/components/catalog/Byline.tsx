import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faUsers } from '@fortawesome/free-solid-svg-icons'
import { Verified, isVerified } from '@/components/brand/Verified'
import { communityLink, profileLink } from '@/lib/links'
import { cn } from '@/lib/cn'
import type { AvatarItem } from '@/types/db'

/**
 * Who an item is by.
 *
 * A Community's item is by the Community. Staw: "i want it to be said to be
 * 'by [community]' rather by the guy who uploaded it" - and he is right
 * beyond the label, because the person who pressed the button is an employee
 * and a shop that credits them has published its staff rota.
 *
 * The row carries both, so this decides and every place that shows a maker
 * decides the same way. A Community wears the people icon rather than the
 * tick: the tick means a verified person, and lending it to a Community
 * would say something nobody has checked.
 */
export function Byline({ item, className }: { item: AvatarItem; className?: string }) {
  const community = item.community_id && item.community_slug
  const to = community
    ? communityLink({ slug: item.community_slug as string })
    : (item.creator_username ? profileLink({ username: item.creator_username }) : null)
  const name = community
    ? (item.community_name ?? 'A Community')
    : (item.creator_display_name ?? 'Somebody')

  const inside = (
    <>
      {community && <Glyph icon={faUsers} className="shrink-0 text-[10px]" />}
      <span className="truncate">{name}</span>
      {!community && isVerified({ is_verified: item.creator_is_verified }) && (
        <Verified className="text-[10px]" />
      )}
    </>
  )

  if (!to) {
    return <span className={cn('flex items-center gap-1.5 text-muted', className)}>{inside}</span>
  }

  return (
    <Link
      to={to}
      className={cn('flex items-center gap-1.5 text-muted transition-colors hover:text-link', className)}
    >
      {inside}
    </Link>
  )
}
