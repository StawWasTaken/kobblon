import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { faPlay, faLock, faShareNodes } from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import type { RunningServer } from '@/lib/api'

/**
 * The people in one server, as faces.
 *
 * Staw sent the shape he wants twice and the second one is this: round
 * heads in a block at the top of the card, and whoever does not fit as a
 * count in a circle of its own rather than a row of cropped faces. A
 * crowd reads as a crowd, two people read as two people.
 */
function Faces({ server }: { server: RunningServer }) {
  const people = server.people ?? []
  const shown = people.slice(0, 5)
  const rest = server.how_many - shown.length

  if (!shown.length) {
    return (
      <p className="flex h-9 items-center text-sm text-muted">
        Empty, and waiting for somebody.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((person) => (
        <span key={person.id} title={person.display_name ?? person.username}>
          <Avatar
            size="md"
            personId={person.id}
            src={person.avatar_url}
            changedAt={person.avatar_changed_at}
            name={person.display_name ?? person.username}
          />
        </span>
      ))}
      {rest > 0 && (
        <span className="grid h-9 w-9 place-items-center rounded-full border border-ink-line bg-ink text-[11px] font-bold text-muted">
          +{rest}
        </span>
      )}
    </div>
  )
}

/**
 * One room of a World, and the way into it.
 *
 * A server has no name and never will have one, so the card is built out
 * of the only things that tell them apart: who is in it, how much room is
 * left, and its own number. Faces at the top, then the count in words,
 * then the bar, then the way in - the shape Staw sent, in our paint.
 *
 * The count turns as the room fills: green while there is room, amber near
 * the top, flat when there is none. "Nearly full" is worth seeing before
 * pressing Join rather than after.
 */
function ServerCard({ server, onJoin, onShare, lit }: {
  server: RunningServer
  onJoin?: (server: RunningServer) => void
  onShare?: (server: RunningServer) => void
  lit?: boolean
}) {
  const full = server.how_many >= server.capacity
  const nearly = !full && server.capacity > 0 && server.how_many / server.capacity >= 0.8
  /* An empty room's count is not live news, so it is not painted as if it
     were: green here means somebody is in there. */
  const quiet = server.how_many === 0
  const share = server.capacity > 0
    ? Math.min(100, (server.how_many / server.capacity) * 100)
    : 0

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-2xl border bg-ink-card p-4 transition-colors',
        lit ? 'border-brand' : 'border-ink-line',
        !full && !lit && 'hover:border-brand/60',
      )}
    >
      <Faces server={server} />

      <div>
        <p
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-extrabold tabular-nums',
            full || quiet ? 'text-muted' : nearly ? 'text-amber-300' : 'text-space-bright',
          )}
        >
          <Icon name="playing" className="h-3.5 w-3.5" />
          {server.how_many} of {server.capacity} people max
        </p>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300',
              full ? 'bg-muted' : nearly ? 'bg-amber-300' : 'bg-space',
            )}
            style={{ width: `${share}%` }}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1"
          variant={full ? 'subtle' : 'yes'}
          disabled={full}
          onClick={() => onJoin?.(server)}
        >
          <Glyph icon={full ? faLock : faPlay} />
          {full ? 'Full' : 'Join'}
        </Button>

        {/* Only drawn where somebody can actually do something with a link:
            a button that copies nothing is worse than no button. */}
        {onShare && (
          <Button className="flex-1" variant="subtle" onClick={() => onShare(server)}>
            <Glyph icon={faShareNodes} />
            Share
          </Button>
        )}
      </div>

      {/*
        * Which room this is. It is the only thing that tells two identical
        * servers apart, and the thing somebody quotes when asking a friend
        * which one to come to.
        */}
      <p className="font-mono text-[11px] text-muted" title={server.id}>
        ID: {server.id.slice(0, 4)}-{server.id.slice(4, 8)}
      </p>
    </article>
  )
}

/**
 * The servers running a World right now.
 *
 * Empty is the ordinary case for a quiet World and says so plainly. It is
 * not a failure and is not drawn as one.
 */
export function ServerList({
  servers, name, onJoin, onShare, highlight,
}: {
  servers: RunningServer[]
  name: string
  onJoin?: (server: RunningServer) => void
  onShare?: (server: RunningServer) => void
  /** A room somebody arrived here to find, from a shared link. */
  highlight?: string | null
}) {
  if (!servers.length) {
    return (
      <Card>
        <EmptyState
          mood="noResults"
          title="No servers running"
          body={`Where people are playing ${name} right now. Nobody is in it at the moment.`}
        />
      </Card>
    )
  }

  /* The one somebody was sent to first, then the ones with room, busiest
     of those at the front: a server nobody can get into is not a choice,
     and an empty one is the least interesting room in the building. */
  const sorted = servers.slice().sort((a, b) => {
    const sent = (one: RunningServer) => (one.id === highlight ? 0 : 1)
    const shut = (one: RunningServer) => (one.how_many >= one.capacity ? 1 : 0)
    return sent(a) - sent(b) || shut(a) - shut(b) || b.how_many - a.how_many
  })

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((server) => (
        <ServerCard
          key={server.id}
          server={server}
          onJoin={onJoin}
          onShare={onShare}
          lit={server.id === highlight}
        />
      ))}
    </div>
  )
}
