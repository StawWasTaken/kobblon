/*
 * One account, as staff see it: what everybody sees, and what only staff do.
 *
 * Staw: "see every user and click on it to see public details (that everyone
 * see) and more details like their country and what time they logged in and
 * when did they leave".
 *
 * The two halves are kept apart on the page on purpose. The left is their
 * profile - the same facts anybody opening it would find. The right is the
 * record, which exists because moderating without it is guessing, and which
 * says what it is: a browser's own clock setting, not a location.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faClock, faGlobe, faDesktop, faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/States'
import { NameMarks } from '@/components/brand/Verified'
import { CurrencyMark } from '@/components/brand/Currency'
import { useAsync } from '@/hooks/useAsync'
import { sessionsOf, type StaffPerson, type StaffRank } from '@/lib/api'
import { BehaviourPanel } from '@/components/staff/BehaviourPanel'
import { avatarOf } from '@/lib/avatars'
import { countryName, placeOfZone } from '@/lib/places'
import { formatCount, timeAgo } from '@/lib/format'

const when = (at: string) => new Date(at).toLocaleString(undefined, {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

export function PersonSheet({ person, rank = 'moderator' }: {
  person: StaffPerson
  rank?: StaffRank
}) {
  const sessions = useAsync(async () => sessionsOf(person.id, 30), [person.id])

  /*
   * Where they look like they are, from the zones their sessions reported.
   * The most recent one wins: a console showing six countries because
   * somebody travelled is a console nobody can read.
   */
  const latest = (sessions.data ?? []).find((one) => one.zone)
  const place = placeOfZone(latest?.zone)

  return (
    <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ------------------------------------------- what everybody sees */}
      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar
            src={avatarOf(person)}
            personId={person.id}
            name={person.display_name ?? person.username}
            size="lg"
            className="rounded-2xl"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-display text-lg font-extrabold">
              <span className="truncate">{person.display_name ?? person.username}</span>
              <NameMarks person={person} className="text-xs" />
            </p>
            <p className="truncate text-sm text-muted">
              @{person.username} · #{person.content_id}
            </p>
          </div>
          <Link
            to={`/u/${person.username}`}
            className="ml-auto shrink-0 text-xs font-bold text-link hover:underline"
          >
            Their profile <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-[10px]" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {person.is_admin && <Badge tone="brand">Kobblon</Badge>}
          {person.is_moderator && <Badge tone="brand">Moderator</Badge>}
          {person.is_verified && <Badge tone="space">Verified</Badge>}
          {person.has_staff_badge && <Badge>Staff badge</Badge>}
          {person.is_guest && <Badge tone="neutral">Guest</Badge>}
          {person.is_suspended && <Badge tone="danger">Suspended</Badge>}
        </div>

        <dl className="divide-y divide-ink-line border-t border-ink-line text-sm">
          <div className="flex justify-between py-2">
            <dt className="text-muted">Brix</dt>
            <dd className="font-bold"><CurrencyMark className="mr-1" />{formatCount(person.pixels)}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-muted">Here since</dt>
            <dd>{new Date(person.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </Card>

      {/* ------------------------------------------- what only staff see */}
      <Card className="space-y-3">
        <p className="flex items-center gap-2 font-display text-xs uppercase tracking-wider text-muted">
          <FontAwesomeIcon icon={faClock} />
          Comings and goings
        </p>

        <p className="flex items-start gap-2 rounded-xl border border-ink-line bg-ink-raised p-2.5 text-xs leading-relaxed text-muted">
          <FontAwesomeIcon icon={faGlobe} className="mt-0.5 shrink-0" />
          <span>
            {place
              ? <>Looks like <span className="font-bold text-white">{place.countryName}</span>, from the time zone their browser reports.</>
              : <>No zone reported yet.</>}
            {' '}This is a setting on their own machine. It is a hint, not proof,
            and Kobblon asks no service where anybody is.
          </span>
        </p>

        {sessions.loading ? <Skeleton className="h-28" /> : !sessions.data?.length ? (
          <p className="text-sm text-muted">Nothing recorded yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {sessions.data.slice(0, 12).map((one) => (
              <li
                key={one.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-ink-line bg-ink-raised px-3 py-2"
              >
                <span className="font-bold">{when(one.started_at)}</span>
                <span className="text-muted">
                  {one.ended_at
                    ? <>left {when(one.ended_at)}</>
                    : <>last seen {timeAgo(one.last_seen_at)}</>}
                </span>
                {one.country && (
                  <span className="text-muted">{countryName(one.country)}</span>
                )}
                {one.agent && (
                  <span className="ml-auto flex items-center gap-1.5 truncate text-[11px] text-muted">
                    <FontAwesomeIcon icon={faDesktop} />
                    <span className="max-w-[14rem] truncate">{one.agent}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>

    {/*
     * The third thing a moderator needs and the sheet did not have: how this
     * account has behaved, and everything that has ever been decided about
     * it. Deciding anything without that is guessing.
     */}
    <BehaviourPanel personId={person.id} username={person.username} rank={rank} />
    </div>
  )
}
