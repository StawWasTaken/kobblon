import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUserGroup, faPlay } from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import type { RunningServer } from '@/lib/api'

/**
 * The people in one server, overlapping.
 *
 * Staw asked to see the faces of whoever is actually in each server, so the
 * faces are the card rather than a decoration on it. They overlap because a
 * row of them would set the card's width by how busy it is, and a server
 * with two people in it should not be half the size of one with nine.
 *
 * Whoever does not fit is a count, not a crowd of cropped heads.
 */
function Faces({ server }: { server: RunningServer }) {
  const shown = server.people.slice(0, 5)
  const rest = server.how_many - shown.length

  return (
    <div className="flex items-center">
      {shown.map((person, at) => (
        <div
          key={person.id}
          className={cn('rounded-full ring-2 ring-ink-card', at > 0 && '-ml-3')}
          style={{ zIndex: shown.length - at }}
          title={person.display_name ?? person.username}
        >
          <Avatar
            size="lg"
            personId={person.id}
            src={person.avatar_url}
            changedAt={person.avatar_changed_at}
            name={person.display_name ?? person.username}
          />
        </div>
      ))}
      {rest > 0 && (
        <div className="-ml-2.5 flex h-10 w-10 items-center justify-center rounded-full border border-ink-line bg-ink text-xs font-semibold text-ink-soft ring-2 ring-ink-card">
          +{rest}
        </div>
      )}
    </div>
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
      <Card className="mt-6">
        <EmptyState
          mood="emptyBox"
          title="No servers running"
          body={`Where people are playing ${name} right now. Nobody is in it at the moment.`}
        />
      </Card>
    )
  }

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {servers.map((server) => {
        const full = server.how_many >= server.capacity
        return (
          <article
            key={server.id}
            className="flex flex-col gap-4 rounded-2xl border border-ink-line bg-ink-card p-4"
          >
            <Faces server={server} />

            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-strong">
                {server.how_many} of {server.capacity} people
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-sunken">
                <div
                  className={cn('h-full rounded-full', full ? 'bg-ink-soft' : 'bg-space')}
                  style={{ width: `${Math.min(100, (server.how_many / server.capacity) * 100)}%` }}
                />
              </div>
            </div>

            <Button
              className="w-full"
              variant={full ? 'subtle' : 'yes'}
              disabled={full}
              onClick={() => onJoin?.(server)}
            >
              <FontAwesomeIcon icon={full ? faUserGroup : faPlay} />
              {full ? 'Full' : 'Join'}
            </Button>
          </article>
        )
      })}
    </div>
  )
}
