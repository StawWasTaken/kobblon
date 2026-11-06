import { Glyph } from '@/components/brand/Glyph'
import {
  faAward, faBagShopping, faCircleInfo, faPlay, faServer, faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Button } from '@/components/ui/Button'
import { SidePanel as Panel, Fact } from '@/components/ui/SidePanel'
import { Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { Avatar } from '@/components/ui/Avatar'
import { CurrencyMark } from '@/components/brand/Currency'
import { formatCount, timeAgo } from '@/lib/format'
import type { RunningServer, WorldBadge, WorldPass } from '@/lib/api'
import { cn } from '@/lib/cn'

/*
 * Everything about a World that is a standing fact rather than the thing
 * itself.
 *
 * The World page was four tabs - About, Badges, Shop, Servers - which is
 * the shape the Community page had and the same complaint: the page opens
 * on a tab rather than on the World, and three quarters of what a World is
 * sit behind a press nobody makes. So this is the Community's side rail,
 * for a World: who is in it now, what it hands out, what it sells, and the
 * numbers. Each panel shows enough to be worth reading and is a door to all
 * of it, so nothing a tab used to hold has been lost.
 *
 * It takes its lists as props and reads no page state, so the Workspace can
 * mount it beside a World it already has. Nothing here imports anything
 * that asks who is signed in - that is what took the Community's bare page
 * down once.
 */

/**
 * One running server, small: the faces in it, how full it is, and the way in.
 *
 * The faces overlap rather than sitting in a row, so a server with two
 * people in it is the same width as one with nine.
 */
function ServerRow({ server, onJoin }: {
  server: RunningServer
  onJoin?: (server: RunningServer) => void
}) {
  const shown = server.people.slice(0, 4)
  const rest = server.how_many - shown.length
  const full = server.how_many >= server.capacity

  return (
    <div className="rounded-xl border border-ink-line bg-ink-raised p-2.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          {shown.map((person, at) => (
            <div
              key={person.id}
              className={cn('rounded-full ring-2 ring-ink-raised', at > 0 && '-ml-2.5')}
              style={{ zIndex: shown.length - at }}
              title={person.display_name ?? person.username}
            >
              <Avatar
                size="sm"
                personId={person.id}
                src={person.avatar_url}
                changedAt={person.avatar_changed_at}
                name={person.display_name ?? person.username}
              />
            </div>
          ))}
          {rest > 0 && (
            <span className="-ml-2 grid h-8 w-8 place-items-center rounded-full border border-ink-line bg-ink text-[10px] font-semibold text-muted ring-2 ring-ink-raised">
              +{rest}
            </span>
          )}
        </div>
        <span className="ml-auto text-xs font-bold tabular-nums text-white/70">
          {server.how_many}/{server.capacity}
        </span>
      </div>

      <Button
        size="sm"
        className="mt-2.5 w-full"
        variant={full ? 'subtle' : 'yes'}
        disabled={full || !onJoin}
        onClick={() => onJoin?.(server)}
      >
        <Glyph icon={full ? faUserGroup : faPlay} />
        {full ? 'Full' : 'Join'}
      </Button>
    </div>
  )
}

/** A badge or a pass, as its picture and nothing else but its name on hover. */
function Pictures({ things, fallback }: {
  things: Array<{ id: string; name: string; icon_url: string | null }>
  fallback: IconDefinition
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {things.map((one) => (
        <Tooltip key={one.id} label={one.name} side="top">
          <span className="grid aspect-square w-full place-items-center overflow-hidden rounded-full border border-ink-line bg-ink">
            {one.icon_url
              ? <img src={one.icon_url} alt="" className="h-full w-full object-cover" />
              : <Glyph icon={fallback} className="text-sm text-muted" />}
          </span>
        </Tooltip>
      ))}
    </div>
  )
}

export function WorldSide({
  servers, serversLoading, badges, passes, counts, visits, genre,
  publishedAt, updatedAt, onJoin, foot, className,
}: {
  servers: RunningServer[] | null
  serversLoading?: boolean
  badges: WorldBadge[] | null
  passes: WorldPass[] | null
  /** Held by the page, because a press moves them before the server hears about it. */
  counts: { likes: number; dislikes: number; favourites: number }
  visits: number
  genre?: string
  publishedAt?: string | null
  updatedAt?: string | null
  onJoin?: (server: RunningServer) => void
  /*
   * Whatever the page wants under the panels - the website puts an advert
   * there. A prop rather than an import because this file is mounted
   * outside the website too, and the advert asks who is signed in.
   */
  foot?: React.ReactNode
  className?: string
}) {
  const running = servers ?? []
  const forSale = (passes ?? []).filter((one) => one.is_for_sale)

  return (
    <aside className={cn('space-y-4', className)}>
      <Panel
        icon={faServer}
        title="In there now"
        to={running.length ? '?view=servers' : undefined}
        all={running.length
          ? `All ${formatCount(running.length)} ${running.length === 1 ? 'server' : 'servers'}`
          : undefined}
      >
        {serversLoading && <Skeleton className="h-24 rounded-xl" />}
        {!serversLoading && !!running.length && (
          <div className="space-y-2">
            {running.slice(0, 2).map((server) => (
              <ServerRow key={server.id} server={server} onJoin={onJoin} />
            ))}
          </div>
        )}
        {!serversLoading && !running.length && (
          /* The ordinary case for a quiet World, and not drawn as a failure. */
          <p className="text-xs text-muted">Nobody is in it right now.</p>
        )}
      </Panel>

      {!!badges?.length && (
        <Panel
          icon={faAward}
          title="Hands out"
          to="?view=badges"
          all={`All ${formatCount(badges.length)} ${badges.length === 1 ? 'badge' : 'badges'}`}
        >
          <Pictures things={badges.slice(0, 4)} fallback={faAward} />
        </Panel>
      )}

      {!!forSale.length && (
        <Panel icon={faBagShopping} title="Sells" to="?view=shop" all="Everything it sells">
          <div className="space-y-1.5">
            {forSale.slice(0, 3).map((one) => (
              <div key={one.id} className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-ink-line bg-ink">
                  {one.icon_url
                    ? <img src={one.icon_url} alt="" className="h-full w-full object-cover" />
                    : <Glyph icon={faBagShopping} className="text-xs text-muted" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold">{one.name}</span>
                <span className="shrink-0 text-xs font-bold text-muted">
                  {one.price > 0
                    ? <><CurrencyMark className="mr-0.5" />{formatCount(one.price)}</>
                    : 'Free'}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel icon={faCircleInfo} title="The numbers">
        <dl className="divide-y divide-ink-line">
          <Fact label="Visits" value={formatCount(visits)} />
          <Fact label="Favourites" value={formatCount(counts.favourites)} />
          <Fact label="Likes" value={formatCount(counts.likes)} />
          <Fact label="Genre" value={genre ?? 'Not set'} />
          <Fact label="Published" value={publishedAt ? timeAgo(publishedAt) : 'Not yet'} />
          <Fact label="Updated" value={updatedAt ? timeAgo(updatedAt) : 'Never'} />
        </dl>
      </Panel>

      {foot}
    </aside>
  )
}
