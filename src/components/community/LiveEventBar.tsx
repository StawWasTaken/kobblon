import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faXmark, faCalendarDay, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { useAsync } from '@/hooks/useAsync'
import { announceStartedEvents, currentEvent } from '@/lib/api'
import { formatCount } from '@/lib/format'

/**
 * A green bar under the top bar of a community while something is on there.
 *
 * It stays under the top bar as the page moves, because something happening
 * now is worth keeping in sight, and what is on is said in the middle of it.
 *
 * It belongs to the community page and nowhere else: the rest of the site
 * does not need to know that a club night has started. Closing it puts it
 * away for now and not for good, because "for good" would mean somebody
 * misses the thing they wanted to be at.
 *
 * Opening the page is also what tells the people who said they were going
 * that it has begun, since there is nothing here running on a timer.
 */
export function LiveEventBar({ communityId }: { communityId: string }) {
  const live = useAsync(() => currentEvent(communityId), [communityId])
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    void announceStartedEvents(communityId).catch(() => {})
  }, [communityId])

  const event = live.data
  if (!event || closed) return null

  return (
    <div className="sticky kob-under-bar z-30 border-b border-space/40 bg-space/15 backdrop-blur">
      {/* What is on is said in the middle of the bar; the way in and the way
          out sit at the ends without pushing it off centre. */}
      <div className="relative flex items-center justify-center gap-3 px-16 py-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-space text-xs text-[#fff]">
          <Glyph icon={faCalendarDay} />
        </span>

        <p className="min-w-0 truncate text-center text-sm">
          <span className="font-bold text-space-bright">Happening now:</span>{' '}
          <span className="font-bold">{event.title}</span>
          {event.subtitle && <span className="text-muted"> · {event.subtitle}</span>}
          {event.attending_count > 0 && (
            <span className="text-muted">
              {' '}· {formatCount(event.attending_count)} going
            </span>
          )}
        </p>

        <span className="absolute right-3 flex items-center gap-2">
          <Link
            to={event.content_id ? `/e/${event.content_id}` : '#'}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-space px-3 py-1.5 text-xs font-extrabold text-[#fff] transition-colors hover:brightness-110"
          >
            Go
            <Glyph icon={faArrowRight} className="text-[10px]" />
          </Link>

          <button
            onClick={() => setClosed(true)}
            aria-label="Put this away for now"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/50 transition-colors hover:bg-ink-hover hover:text-white"
          >
            <Glyph icon={faXmark} className="text-xs" />
          </button>
        </span>
      </div>
    </div>
  )
}
