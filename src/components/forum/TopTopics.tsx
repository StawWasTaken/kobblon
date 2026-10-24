import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowRight, faComment, faThumbsUp } from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Kmark } from '@/components/brand/Kmark'
import { useAsync } from '@/hooks/useAsync'
import { forumTopics } from '@/lib/api'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * What the forum is talking about, on a page that is not the forum.
 *
 * The same block on the landing page, on the signed-in Home and on What is
 * Kobblon. One component rather than three arrangements of the same rows:
 * the forum is one room and it should look like one room wherever it is
 * quoted from, and three of these is three places for "interesting" to
 * quietly become "newest".
 *
 * `interesting` rather than `new`: a front page showing the five most
 * recent posts shows whatever was posted in the last hour, which on a
 * week-old platform is often nothing worth clicking. The forum's own
 * ordering already weighs replies and age together, so this asks for that.
 *
 * It renders nothing at all when the forum has nothing - no empty card
 * saying there is no conversation, which is a thing to have on a board and
 * not a thing to put on the front page.
 */
export function TopTopics({
  limit = 5,
  heading = 'From the forum',
  head = true,
  className,
}: {
  limit?: number
  heading?: string
  /**
   * Off where the page has already said what this is - a band on the
   * landing page carries its own title, and two headings one above the
   * other reads as a mistake rather than as emphasis.
   */
  head?: boolean
  className?: string
}) {
  const topics = useAsync(() => forumTopics({ sort: 'interesting', limit }), [limit])
  const rows = topics.data ?? []

  // Loading and failure both draw nothing. This is a side dish on every
  // page it appears on, and a red box saying the forum did not answer is
  // not what somebody came to the front page for.
  if (!rows.length) return null

  return (
    <section className={cn('rounded-2xl border border-white/10 bg-ink-card/40 p-5 sm:p-6', className)}>
      {head && (
      <div className="flex items-center gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand-bright">
          <Kmark className="h-3.5 w-auto" />
        </span>
        <h2 className="font-display text-lg font-extrabold tracking-tight">{heading}</h2>
        <Link
          to="/forum"
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-extrabold text-white/45 transition-colors hover:text-brand-bright"
        >
          All topics
          <Glyph icon={faArrowRight} className="text-[10px]" />
        </Link>
      </div>
      )}

      <ul className={cn(head && 'mt-4')}>
        {rows.map((topic) => (
          <li key={topic.id}>
            <Link
              to={`/forum/t/${topic.id}`}
              className="group flex items-center gap-3 border-t border-white/[0.07] py-3 transition-colors hover:bg-white/[0.03]"
            >
              <Avatar
                src={topic.author_avatar}
                name={topic.author_name}
                personId={topic.author_id}
                size="sm"
                className="shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm font-extrabold text-white transition-colors group-hover:text-brand-bright">
                  {topic.title}
                </span>
                <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-white/35">
                  <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 font-bold text-white/55">
                    {topic.category_name}
                  </span>
                  <span>{timeAgo(topic.last_post_at)}</span>
                </span>
              </span>

              {/* The two numbers that say whether a topic is worth opening.
                  Hidden on a narrow screen, where the title is the whole of
                  the room there is. */}
              <span className="hidden shrink-0 items-center gap-4 text-xs font-bold tabular-nums text-white/40 sm:flex">
                <span className="inline-flex items-center gap-1.5">
                  <Glyph icon={faComment} className="text-[11px] text-white/25" />
                  {formatCount(topic.reply_count)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Glyph icon={faThumbsUp} className="text-[11px] text-white/25" />
                  {formatCount(topic.like_count)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
