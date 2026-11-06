import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faCalendarDay, faHandshake, faStore, faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { Skeleton } from '@/components/ui/States'
import { SidePanel as Panel } from '@/components/ui/SidePanel'
import { Tooltip } from '@/components/ui/Tooltip'
import { Emblem } from '@/components/community/Emblem'
import { eventWhen } from '@/components/community/EventCard'
import { AssetTile } from '@/components/create/AssetTile'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { presenceNow, usePresenceVersion } from '@/hooks/usePresenceStore'
import { communityLink, eventLink, profileLink } from '@/lib/links'
import { formatCount } from '@/lib/format'
import type {
  Community, CommunityEvent, CommunityMember, CommunityRelation, MarketAsset,
} from '@/types/db'
import { cn } from '@/lib/cn'

/*
 * Everything about a Community that is a standing fact rather than news.
 *
 * The page's middle is what is happening in there; this is what is true of
 * it - who is in it, what is next, what it sells, who it stands with. Each
 * panel shows enough to be worth reading and is a door to all of it, so
 * nothing that used to be a tab has been lost: it has stopped being the
 * only way to find out the Community has members.
 *
 * It takes its lists as props and reads no page state, so the Workspace can
 * mount it beside a Community it already has.
 */

/**
 * Who is in here, the ones who are actually here first.
 *
 * A member list ordered by the day somebody joined tells you about the past.
 * Ordered by who is online it tells you whether there is anybody to talk to,
 * which is the question somebody looking at a Community is asking.
 */
function WhoIsIn({ roster }: { roster: CommunityMember[] }) {
  usePresenceVersion()

  const sorted = roster.slice().sort((a, b) => {
    const live = (one: CommunityMember) => (presenceNow(one) === 'offline' ? 1 : 0)
    return live(a) - live(b)
  })

  return (
    <div className="grid grid-cols-4 gap-2">
      {sorted.slice(0, 8).map((person) => (
        <Tooltip key={person.id} label={person.display_name} side="top">
          <Link to={profileLink(person)} className="block">
            <PersonAvatar person={person} size="lg" square ring="ring-ink-card" className="w-full" />
          </Link>
        </Tooltip>
      ))}
    </div>
  )
}

/** One event, small: when it is, what it is, and how many have said yes. */
function EventRow({ event }: { event: CommunityEvent }) {
  return (
    <Link
      to={eventLink(event)}
      className="-mx-2 flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-ink-hover"
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-line bg-ink-raised text-xs text-brand-bright">
        <Glyph icon={faCalendarDay} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{event.title}</span>
        <span className="block truncate text-xs text-muted">{eventWhen(event.starts_at)}</span>
        {event.attending_count > 0 && (
          <span className="block text-[11px] text-white/40">
            {formatCount(event.attending_count)} going
          </span>
        )}
      </span>
    </Link>
  )
}

/** Who the Community stands with, as the emblems people recognise. */
function Allies({ relations }: { relations: CommunityRelation[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {relations.slice(0, 6).map((other) => (
        <Tooltip key={other.id} label={other.name} side="top">
          <Link to={communityLink(other)} className="block">
            <Emblem src={other.icon_url} name={other.name} rounded="rounded-xl" className="h-11 w-11 text-sm" />
          </Link>
        </Tooltip>
      ))}
    </div>
  )
}


export function CommunitySide({
  group, roster, rosterLoading, coming, store, allies, enemies, foot, className,
}: {
  group: Community
  roster: CommunityMember[] | null
  rosterLoading?: boolean
  /** Events still to happen, soonest first. */
  coming: CommunityEvent[]
  store: MarketAsset[] | null
  allies: CommunityRelation[] | null
  enemies: CommunityRelation[] | null
  /*
   * Whatever the page wants under the panels - the website puts an advert
   * there. It is a prop rather than an import because this file is mounted
   * outside the website too, and the advert asks who is signed in: the bare
   * page caught it throwing "useAuth must be used inside <AuthProvider>",
   * which in the Workspace is a panel going blank and no bug report.
   */
  foot?: React.ReactNode
  className?: string
}) {
  return (
    <aside className={cn('space-y-4', className)}>
      <Panel
        icon={faUserGroup}
        title="In here"
        to="?view=members"
        all={`All ${formatCount(group.member_count)} members`}
      >
        {rosterLoading && <Skeleton className="h-24 rounded-xl" />}
        {!rosterLoading && !!roster?.length && <WhoIsIn roster={roster} />}
        {!rosterLoading && !roster?.length && (
          <p className="text-xs text-muted">Nobody has joined yet.</p>
        )}
      </Panel>

      {!!coming.length && (
        <Panel icon={faCalendarDay} title="Coming up" to="?view=events" all="All events">
          <div className="space-y-1">
            {coming.slice(0, 3).map((event) => <EventRow key={event.id} event={event} />)}
          </div>
        </Panel>
      )}

      {!!store?.length && (
        <Panel icon={faStore} title={`Made by ${group.name}`} to="?view=shop" all="Their whole shop">
          <div className="grid grid-cols-2 gap-2">
            {store.slice(0, 2).map((item) => <AssetTile key={item.id} item={item} />)}
          </div>
        </Panel>
      )}

      {(!!allies?.length || !!enemies?.length) && (
        <Panel icon={faHandshake} title="Stands with" to="?view=allies" all="Allies and enemies">
          {allies?.length
            ? <Allies relations={allies} />
            : (
              <p className="text-xs text-muted">
                No allies, and {enemies?.length} declared {enemies?.length === 1 ? 'enemy' : 'enemies'}.
              </p>
            )}
        </Panel>
      )}

      {foot}
    </aside>
  )
}
