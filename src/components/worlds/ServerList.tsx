import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { faPlay, faLock } from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import type { RunningServer } from '@/lib/api'

/**
 * The people in one server, as faces.
 *
 * Staw asked to see who is actually in each one, and then sent the shape
 * he wants it in: the heads laid out in a block that fills the card,
 * square and side by side rather than a cuff of overlapping circles. A
 * crowd reads as a crowd that way, and two people read as two people.
 *
 * Whoever does not fit is a count on the end, not a row of cropped heads.
 */
function Faces({ server }: { server: RunningServer }) {
  const people = server.people ?? []
  const shown = people.slice(0, 6)
  const rest = server.how_many - shown.length

  if (!shown.length) {
    return (
      <p className="self-center text-sm text-muted">Empty, and waiting for somebody.</p>
    )
  }

  return (
    <div className="flex flex-wrap content-start gap-1.5">
      {shown.map((person) => (
        <span key={person.id} title={person.display_name ?? person.username}>
        <Avatar
          size="md"
          personId={person.id}
          src={person.avatar_url}
          changedAt={person.avatar_changed_at}
          name={person.display_name ?? person.username}
          className="rounded-lg"
        />
        </span>
      ))}
      {rest > 0 && (
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-ink-line bg-ink text-[11px] font-bold text-muted">
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
 * of the only two things that tell them apart: who is in it and how much
 * room is left. How many, then the way in, then the faces taking the rest
 * of the card - the shape Staw sent, in our paint.
 *
 * The count turns as the room fills: green while there is room, amber near
 * the top, flat when there is none. "Nearly full" is worth seeing before
 * pressing Join rather than after.
 */
function ServerCard({ server, onJoin }: {
  server: RunningServer
  onJoin?: (server: RunningServer) => void
}) {
  const full = server.how_many >= server.capacity
  const nearly = !full && server.capacity > 0 && server.how_many / server.capacity >= 0.8
  /* An empty room's count is not live news, so it is not painted as if it
     were: green here means somebody is in there. */
  const quiet = server.how_many === 0

  return (
    <article
      className={cn(
        'flex gap-4 rounded-2xl border border-ink-line bg-ink-card p-3.5 transition-colors',
        !full && 'hover:border-brand/60',
      )}
    >
      <div className="flex w-[7.5rem] shrink-0 flex-col gap-2.5">
        <p
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-extrabold tabular-nums',
            full || quiet ? 'text-muted' : nearly ? 'text-amber-300' : 'text-space-bright',
          )}
        >
          <Icon name="playing" className="h-3.5 w-3.5" />
          {server.how_many} / {server.capacity}
        </p>

        <Button
          className="w-full"
          variant={full ? 'subtle' : 'yes'}
          disabled={full}
          onClick={() => onJoin?.(server)}
        >
          <Glyph icon={full ? faLock : faPlay} />
          {full ? 'Full' : 'Join'}
        </Button>
      </div>

      <Faces server={server} />
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
  servers, name, onJoin,
}: {
  servers: RunningServer[]
  name: string
  onJoin?: (server: RunningServer) => void
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

  /* The ones with room first, and the busiest of those at the front: a
     server nobody can get into is not a choice, and an empty one is the
     least interesting room in the building. */
  const sorted = servers.slice().sort((a, b) => {
    const shut = (one: RunningServer) => (one.how_many >= one.capacity ? 1 : 0)
    return shut(a) - shut(b) || b.how_many - a.how_many
  })

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {sorted.map((server) => (
        <ServerCard key={server.id} server={server} onJoin={onJoin} />
      ))}
    </div>
  )
}
