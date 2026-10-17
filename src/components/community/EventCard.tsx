import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faCalendarDay, faUserGroup, faBan } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import { eventLink } from '@/lib/links'
import type { CommunityEvent } from '@/types/db'

/** When something starts, written the way a person would say it. */
export function eventWhen(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  const time = date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today at ${time}`
  return `${date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })} at ${time}`
}

export function EventCard({
  event, onJoin, className, past = false,
}: {
  event: CommunityEvent
  onJoin?: (going: boolean) => void
  className?: string
  /** Drawn in a list of things that have already happened, so it is quieter. */
  past?: boolean
}) {
  /*
   * Over according to the database, falling back to this machine's clock
   * for anything that reaches this card from somewhere that does not say -
   * the editor builds one out of a draft, and a draft has no answer yet.
   * The database's is the one to prefer: it is the clock the event was set
   * by, and the reader's may be minutes or a day out.
   */
  const over = event.is_over ?? new Date(event.ends_at ?? event.starts_at) < new Date()

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-ink-line bg-ink-card',
        past && 'opacity-75 transition-opacity hover:opacity-100',
        className,
      )}
    >
      <Link to={eventLink(event)} className="relative block aspect-[2/1] overflow-hidden bg-media">
        {event.cover_url ? (
          <img
            src={event.cover_url}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full select-none object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-3xl text-white/20">
            <Glyph icon={faCalendarDay} />
          </span>
        )}

        {(event.is_cancelled || over) && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-ink/85 px-2 py-1 text-[11px] font-bold backdrop-blur">
            <Glyph icon={faBan} className="text-[10px]" />
            {event.is_cancelled ? 'Cancelled' : 'Finished'}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <Link to={eventLink(event)} className="font-display text-sm font-extrabold hover:text-link">
          {event.title}
        </Link>
        {event.subtitle && <p className="mt-0.5 truncate text-xs text-muted">{event.subtitle}</p>}

        <p className="mt-1.5 text-xs font-semibold">{eventWhen(event.starts_at)}</p>

        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
          <Glyph icon={faUserGroup} />
          {formatCount(event.attending_count)} going
        </p>

        {onJoin && !event.is_cancelled && !over && (
          <Button
            className="mt-2.5"
            size="sm"
            block
            variant={event.i_am_going ? 'subtle' : 'primary'}
            onClick={() => onJoin(!event.i_am_going)}
          >
            {event.i_am_going ? 'Going' : 'Join Event'}
          </Button>
        )}
      </div>
    </article>
  )
}
