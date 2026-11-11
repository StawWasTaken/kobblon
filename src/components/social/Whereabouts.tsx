import { Link } from 'react-router-dom'
import { faPlay, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useWhereabout, useWhereabouts } from '@/hooks/usePresenceStore'
import { play } from '@/lib/app'
import { worldLink } from '@/lib/links'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * What somebody is doing, said on their own page.
 *
 * Staw asked for an activity line on a profile that names the World
 * somebody is in. It cannot come from the profile row: a row carries
 * `in_space_id` at best and is as old as the page, so a profile built on it
 * would name a World somebody left before you opened the tab. This asks the
 * roster, for this one person, and keeps asking while the page is up.
 *
 * Nothing is drawn when they are not in a World. An activity line that says
 * "not doing anything" is a line that is wrong the moment it is true of
 * nobody, and it is on every profile on the site.
 *
 * It is a panel rather than a line now, and it sits under the buttons on
 * the right rather than under the handle. Staw: "for the 'Playing [world]'
 * to be instead of under the handle, under the buttons on the right and to
 * have a big update/upgrade polished one". Under the handle it was a strip
 * wedged between a name and three count pills, competing with both; beside
 * the buttons it is the other thing you can *do* on somebody's page, which
 * is where Join belongs.
 */
export function ActivityLine({ person, isMe, className }: {
  person: { id: string; display_name: string } | null | undefined
  /** Your own page: no point offering to follow yourself into a World. */
  isMe?: boolean
  className?: string
}) {
  const say = useToast()
  useWhereabouts(person ? [person] : [])
  const where = useWhereabout(person?.id)

  if (!where) return null

  const full = where.how_many >= where.capacity
  const share = where.capacity > 0
    ? Math.min(100, Math.round((where.how_many / where.capacity) * 100))
    : 0

  /*
   * The server id travels as `room`. It is a hint and never a permission:
   * a room id is a thing anybody can type, and whether this account may be
   * in that room is decided by `join_world_server` over HTTPS, which is
   * where it has always been decided. A full room, a closed one or a
   * private one refuses there.
   */
  const join = () => {
    void play(where.world_id, () => {
      say('Kobblon is not installed on this machine. The download page has it.', 'info')
    }, where.server_id)
  }

  const address = where.world_content_id
    ? worldLink({ content_id: where.world_content_id, name: where.world_name })
    : null

  /*
   * The picture, which is what makes this worth the room it takes.
   *
   * A World with no cover is drawn as the house mark rather than as a hole:
   * an empty box the size of a thumbnail reads as a picture that failed to
   * load, which is a bug report nobody can act on.
   */
  const picture = (
    <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-b-4 border-white/15 bg-ink-raised">
      {where.world_cover ? (
        <img src={where.world_cover} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center text-white/30">
          <Glyph icon={faPlay} className="text-sm" />
        </span>
      )}
    </span>
  )

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border-2 border-b-4 border-space/45 bg-gradient-to-br from-space/20 to-space/5 shadow-lg shadow-space/10',
        className,
      )}
    >
      {/* The eyebrow, so the panel says what kind of thing it is before it
          says which World. The ring says it is happening now rather than
          that it happened. */}
      <p className="flex items-center gap-2 border-b border-space/30 bg-space/15 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-space-bright">
        <span className="relative grid h-2 w-2 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-space-bright/60" />
          <span className="relative h-2 w-2 rounded-full bg-space-bright" />
        </span>
        Playing now
      </p>

      <div className="flex items-center gap-3 p-3">
        {address ? <Link to={address} className="shrink-0">{picture}</Link> : picture}

        <div className="min-w-0 flex-1">
          {address ? (
            <Link
              to={address}
              className="block truncate font-display text-base font-extrabold leading-tight text-white hover:underline"
            >
              {where.world_name}
            </Link>
          ) : (
            <p className="truncate font-display text-base font-extrabold leading-tight text-white">
              {where.world_name}
            </p>
          )}

          <p className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-white/60">
            <Glyph icon={faUserGroup} className="shrink-0 text-[10px]" />
            <span className="tabular-nums">
              {formatCount(where.how_many)} of {formatCount(where.capacity)}
            </span>
            in there
          </p>

          {/* How full that copy is, drawn rather than only counted, so a
              room about to refuse you looks like one before you press. */}
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-black/40">
            <span
              className={cn('block h-full rounded-full', full ? 'bg-danger' : 'bg-space-bright')}
              style={{ width: `${Math.max(share, 4)}%` }}
            />
          </span>
        </div>

        {!isMe && (
          <Button
            size="sm"
            variant={full ? 'subtle' : 'yes'}
            icon={full ? undefined : faPlay}
            disabled={full}
            onClick={join}
            className="shrink-0"
          >
            {full ? 'Full' : 'Join them'}
          </Button>
        )}
      </div>
    </div>
  )
}
