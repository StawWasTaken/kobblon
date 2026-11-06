import { useMemo, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faRotateRight, faUserGroup, faServer } from '@fortawesome/free-solid-svg-icons'
import { Select } from '@/components/ui/Select'
import { Tickbox } from '@/components/ui/Tickbox'
import { ServerList } from '@/components/worlds/ServerList'
import { cn } from '@/lib/cn'
import type { PlayerThere, RunningServer } from '@/lib/api'

/**
 * The Servers tab: the rooms your friends are in, then the rest.
 *
 * Staw asked for four things here - friends in their own section, a sort,
 * a way to hide the rooms nobody can get into, and a refresh on each
 * section. The grid itself is still `ServerList`, which draws rooms and
 * knows nothing about any of this; the deciding happens here, so an
 * application that wants the plain grid can still have it.
 *
 * Sorting and hiding are done on what is already in hand rather than by
 * asking again. The list is a photograph of about ninety seconds ago
 * either way, and re-reading it to put the same rooms in a different
 * order would make the page flicker for nothing.
 */

type Sort = 'busiest' | 'quietest' | 'room'

const SORTS = [
  { value: 'busiest', label: 'Most people' },
  { value: 'quietest', label: 'Fewest people' },
  { value: 'room', label: 'Most room left' },
]

/** The round arrow over each section, with the spin while it is reading. */
function Refresh({ onPress, busy }: { onPress: () => void; busy?: boolean }) {
  return (
    <button
      onClick={onPress}
      disabled={busy}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-ink-line bg-ink-raised px-2.5 py-1.5',
        'text-xs font-bold text-white/70 transition-colors hover:bg-ink-hover hover:text-white',
        'disabled:opacity-50',
      )}
    >
      Refresh
      <Glyph icon={faRotateRight} spin={busy} />
    </button>
  )
}

function Heading({ icon, title, count, right }: {
  icon: typeof faServer
  title: string
  count?: number
  right?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
        <Glyph icon={icon} className="text-sm text-brand-bright" />
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-ink-raised px-2 py-0.5 text-xs font-bold text-muted">
            {count}
          </span>
        )}
      </h3>
      <span className="h-px flex-1 bg-ink-line" />
      {right}
    </div>
  )
}

export function ServersTab({
  servers, friends, name, signedIn, busy, onRefresh, onJoin, onShare, highlight,
}: {
  servers: RunningServer[]
  /** Which friends are in which room, by server id. Empty when signed out. */
  friends: Record<string, PlayerThere[]>
  name: string
  signedIn: boolean
  busy?: boolean
  onRefresh: () => void
  onJoin?: (server: RunningServer) => void
  onShare?: (server: RunningServer) => void
  highlight?: string | null
}) {
  const [sort, setSort] = useState<Sort>('busiest')
  const [hideFull, setHideFull] = useState(true)

  const withMates = servers.filter((one) => (friends[one.id]?.length ?? 0) > 0)
  const rest = servers.filter((one) => !(friends[one.id]?.length ?? 0))

  const ordered = useMemo(() => {
    const full = (one: RunningServer) => one.how_many >= one.capacity
    const kept = hideFull ? rest.filter((one) => !full(one)) : rest
    return kept.slice().sort((a, b) => {
      /* The room somebody was sent to stays at the front whatever the
         sort says: they followed a link to that one. */
      const sent = (one: RunningServer) => (one.id === highlight ? 0 : 1)
      if (sent(a) !== sent(b)) return sent(a) - sent(b)
      /* A room nobody can get into is never the first choice, however the
         rest are being ordered. */
      if (full(a) !== full(b)) return full(a) ? 1 : -1
      if (sort === 'quietest') return a.how_many - b.how_many
      if (sort === 'room') {
        return (b.capacity - b.how_many) - (a.capacity - a.how_many)
      }
      return b.how_many - a.how_many
    })
  }, [rest, sort, hideFull, highlight])

  const hidden = rest.length - ordered.length

  return (
    <div className="space-y-8">
      {/* Only drawn for somebody who has friends to be anywhere. Signed
          out it is not an empty section, it is not a section. */}
      {signedIn && (
        <section>
          <Heading
            icon={faUserGroup}
            title="Servers your friends are in"
            count={withMates.length}
            right={<Refresh onPress={onRefresh} busy={busy} />}
          />
          <ServerList
            servers={withMates}
            friends={friends}
            name={name}
            onJoin={onJoin}
            onShare={onShare}
            highlight={highlight}
            empty={{
              title: 'None of your friends are in here',
              body: `When somebody you know is playing ${name}, their server shows up here first.`,
            }}
          />
        </section>
      )}

      <section>
        <Heading
          icon={faServer}
          title={signedIn ? 'Other servers' : 'Servers'}
          count={ordered.length}
          right={<Refresh onPress={onRefresh} busy={busy} />}
        />

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-muted">Sort by</span>
          <Select
            label="Sort by"
            value={sort}
            options={SORTS}
            onChange={(next) => setSort(next as Sort)}
            className="w-56"
          />
          <Tickbox
            on={hideFull}
            onChange={setHideFull}
            label="Hide full servers"
            /* `Tickbox` is `w-full` by default, for a column of them in a
               dialog. In a toolbar it is one control beside two others. */
            className="!w-auto"
          />
          {hideFull && hidden > 0 && (
            <p className="text-xs text-muted">
              {hidden} full {hidden === 1 ? 'server' : 'servers'} hidden
            </p>
          )}
        </div>

        <ServerList
          servers={ordered}
          friends={friends}
          name={name}
          onJoin={onJoin}
          onShare={onShare}
          highlight={highlight}
          empty={hideFull && hidden > 0
            ? {
              title: 'Every server is full',
              body: 'Untick "Hide full servers" to see them, or try again in a moment.',
            }
            : undefined}
        />
      </section>
    </div>
  )
}
