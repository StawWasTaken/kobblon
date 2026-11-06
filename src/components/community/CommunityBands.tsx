import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faCalendarDay, faHandshake, faStore, faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { Skeleton } from '@/components/ui/States'
import { Band } from '@/components/ui/Band'
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

/*
 * Everything a Community is, down the page under its own headings.
 *
 * This used to be a rail of four small panels beside the wall, which is how
 * a dashboard shows you a place: a summary of the members, a summary of the
 * shop, a summary of the allies, none of them big enough to be worth
 * looking at. A Community is not a summary of itself. So each of those is a
 * band across the page now, wide enough to actually show the people and the
 * things, with the door to the whole list on the end of its heading.
 *
 * It takes its lists as props and reads no page state. `Band`'s doors and
 * every face here want a router, and nothing wants a provider.
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
    /* Faces with their names under them, the way a member list looked when
       it was a list of people rather than a row of thumbnails. */
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
      {sorted.slice(0, 16).map((person) => (
        <Link
          key={person.id}
          to={profileLink(person)}
          className="group flex flex-col items-center gap-1.5 rounded-xl p-1 transition-colors hover:bg-ink-hover"
        >
          <PersonAvatar person={person} size="lg" square ring="ring-ink" className="aspect-square h-auto w-full" />
          <span className="w-full truncate text-center text-[11px] font-semibold text-white/70 transition-colors group-hover:text-white">
            {person.display_name ?? person.username}
          </span>
        </Link>
      ))}
    </div>
  )
}

/** One event: when it is, what it is, and how many have said yes. */
function EventRow({ event }: { event: CommunityEvent }) {
  return (
    <Link
      to={eventLink(event)}
      className="flex items-start gap-3 rounded-xl border border-ink-line bg-ink-card px-3 py-3 transition-colors hover:border-brand/60 hover:bg-ink-hover"
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
function Standing({ relations }: { relations: CommunityRelation[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {relations.slice(0, 12).map((other) => (
        <Tooltip key={other.id} label={other.name} side="top">
          <Link to={communityLink(other)} className="block">
            <Emblem
              src={other.icon_url}
              name={other.name}
              rounded="rounded-xl"
              className="h-14 w-14 text-base transition-transform hover:scale-105"
            />
          </Link>
        </Tooltip>
      ))}
    </div>
  )
}

export function CommunityBands({
  group, roster, rosterLoading, coming, store, allies, enemies,
}: {
  group: Community
  roster: CommunityMember[] | null
  rosterLoading?: boolean
  /** Events still to happen, soonest first. */
  coming: CommunityEvent[]
  store: MarketAsset[] | null
  allies: CommunityRelation[] | null
  enemies: CommunityRelation[] | null
}) {
  return (
    <>
      <Band
        id="members"
        icon={faUserGroup}
        title="In here"
        count={group.member_count}
        to="?view=members"
        all="Every member"
      >
        {rosterLoading && <Skeleton className="h-24 rounded-xl" />}
        {!rosterLoading && !!roster?.length && <WhoIsIn roster={roster} />}
        {!rosterLoading && !roster?.length && (
          <p className="text-sm text-muted">Nobody has joined yet.</p>
        )}
      </Band>

      <Band
        id="coming"
        icon={faCalendarDay}
        title="Coming up"
        count={coming.length}
        to="?view=events"
        all="All events"
        hide={!coming.length}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coming.slice(0, 6).map((event) => <EventRow key={event.id} event={event} />)}
        </div>
      </Band>

      <Band
        id="shop"
        icon={faStore}
        title={`Made by ${group.name}`}
        count={store?.length ?? 0}
        to="?view=shop"
        all="Their whole shop"
        hide={!store?.length}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(store ?? []).slice(0, 5).map((item) => <AssetTile key={item.id} item={item} />)}
        </div>
      </Band>

      <Band
        id="allies"
        icon={faHandshake}
        title="Stands with"
        to="?view=allies"
        all="Allies and enemies"
        hide={!allies?.length && !enemies?.length}
      >
        {allies?.length
          ? <Standing relations={allies} />
          : (
            <p className="text-sm text-muted">
              No allies, and {enemies?.length} declared{' '}
              {enemies?.length === 1 ? 'enemy' : 'enemies'}.
            </p>
          )}
      </Band>
    </>
  )
}
