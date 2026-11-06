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

  const name = where.world_content_id
    ? (
      <Link
        to={worldLink({ content_id: where.world_content_id, name: where.world_name })}
        className="font-bold text-space-bright hover:underline"
      >
        {where.world_name}
      </Link>
    )
    : <span className="font-bold text-space-bright">{where.world_name}</span>

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-space/40 bg-space/10 px-3 py-2',
        className,
      )}
    >
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <span className="relative grid h-2.5 w-2.5 shrink-0 place-items-center">
          {/* The ring says it is happening now rather than that it happened. */}
          <span className="absolute inset-0 animate-ping rounded-full bg-space/60" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-space" />
        </span>
        <span className="truncate">
          Playing {name}
        </span>
      </p>

      <p className="flex items-center gap-1.5 text-xs text-white/55">
        <Glyph icon={faUserGroup} className="text-[10px]" />
        {formatCount(where.how_many)} of {formatCount(where.capacity)} in there
      </p>

      {!isMe && (
        <Button
          size="sm"
          variant={full ? 'subtle' : 'yes'}
          icon={faPlay}
          disabled={full}
          onClick={join}
          className="ml-auto"
        >
          {full ? 'Full' : 'Join them'}
        </Button>
      )}
    </div>
  )
}
