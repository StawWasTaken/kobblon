import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faXmark, faCalendarDay, faArrowRight, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { noticeStripes } from '@/components/layout/NoticeBar'
import { useAsync } from '@/hooks/useAsync'
import { announceStartedEvents, currentEvent, type LiveEvent } from '@/lib/api'
import { formatCount } from '@/lib/format'

/**
 * A green bar under the top bar of a community while something is on there.
 *
 * Built out of the same parts as the site notice it sits under: a flat
 * panel, white words chosen for that panel rather than for the dark behind
 * it, and the diagonal stripes laid over at low strength. Staw: "i want
 * them to be green with the topbar stripes too and to be redesigned and
 * clean". It was a translucent tint with a centred sentence, which meant
 * two bars in the same stack that had nothing to do with each other - a
 * site notice and this, the one solid and striped and the other washed out
 * over whatever was behind it.
 *
 * The stripes come from `noticeStripes` rather than a copy of the gradient,
 * so the two bars cannot drift apart later.
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
export function LiveEventBar({ communityId, showing }: {
  communityId: string
  /**
   * An event to draw instead of asking for one, which is how
   * `tools/site/event-bar-preview.html` mounts this with no session and no
   * database behind it. The page never passes it.
   */
  showing?: LiveEvent | null
}) {
  const live = useAsync(
    () => (showing === undefined ? currentEvent(communityId) : Promise.resolve(showing)),
    [communityId, showing === undefined],
  )
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (showing !== undefined) return
    void announceStartedEvents(communityId).catch(() => {})
  }, [communityId, showing])

  const event = live.data
  if (!event || closed) return null

  return (
    <div className="sticky kob-under-bar z-30 overflow-hidden bg-space text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: noticeStripes('rgba(255,255,255,0.10)') }}
      />

      <div className="relative flex items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/20">
          <Glyph icon={faCalendarDay} className="text-xs" />
        </span>

        {/* The sentence, in one line that gives way in this order: the
            count goes first, then the subtitle, and the title is the last
            thing to be cut because it is the only part that says what is
            on. */}
        <p className="min-w-0 flex-1 truncate font-semibold">
          <span className="font-extrabold uppercase tracking-wide text-white/70">
            Happening now
          </span>
          <span className="mx-2 text-white/30">|</span>
          <span className="font-bold">{event.title}</span>
          {event.subtitle && <span className="text-white/70"> &middot; {event.subtitle}</span>}
        </p>

        {event.attending_count > 0 && (
          <span className="hidden shrink-0 items-center gap-1.5 text-xs font-bold text-white/80 sm:inline-flex">
            <Glyph icon={faUserGroup} className="text-[10px]" />
            {formatCount(event.attending_count)} going
          </span>
        )}

        <Link
          to={event.content_id ? `/e/${event.content_id}` : '#'}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold text-space-deep transition-colors hover:bg-white/90"
        >
          Go
          <Glyph icon={faArrowRight} className="text-[10px]" />
        </Link>

        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label="Put this away for now"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          <Glyph icon={faXmark} className="text-xs" />
        </button>
      </div>
    </div>
  )
}
