import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Glyph } from '@/components/brand/Glyph'
import { faComment, faEye, faThumbsUp } from '@fortawesome/free-solid-svg-icons'
import { Verified, Staff, isStaff, isVerified } from '@/components/brand/Verified'
import { StatusPill, Flags } from '@/components/forum/Pieces'
import { formatCount } from '@/lib/format'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ForumTopic } from '@/types/db'

/**
 * One line of a board.
 *
 * Built as a grid rather than as a card: a board is a list somebody scans
 * for the one thread they want, and twenty cards with padding is four
 * screens of scrolling to read twenty titles. The numbers sit in their own
 * column at the end and line up down the page, which is the thing that
 * makes a column of them readable at all - `tabular-nums`, so 1,204 does
 * not dance beside 998.
 *
 * The whole row is the link. A row where only the title is clickable is a
 * row people click and nothing happens.
 */
export function TopicRow({
  topic, showCategory,
}: {
  topic: ForumTopic
  /** On a mixed list - the front page - where it came from is worth saying. */
  showCategory?: boolean
}) {
  const author = {
    is_verified: topic.author_is_verified,
    is_admin: topic.author_is_admin,
    is_moderator: topic.author_is_moderator,
  }

  return (
    <li>
      <Link
        to={`/forum/t/${topic.id}`}
        className={cn(
          'group grid grid-cols-[auto_1fr] items-start gap-4 border-t border-white/[0.07] px-2 py-4 transition-colors',
          'hover:bg-white/[0.03] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-5 sm:px-4',
        )}
      >
        <Avatar
          src={topic.author_avatar}
          name={topic.author_name}
          personId={topic.author_id}
          size="md"
          className="shrink-0"
        />

        <span className="min-w-0">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 truncate font-display text-[15px] font-extrabold text-white transition-colors group-hover:text-brand-bright sm:text-base">
              {topic.title}
            </span>
            <Flags pinned={topic.is_pinned} locked={topic.is_locked} />
            <StatusPill status={topic.status} />
          </span>

          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/40">
            <span className="inline-flex items-center gap-1 font-bold text-white/55">
              {topic.author_name}
              {isStaff(author)
                ? <Staff className="text-[0.9em]" />
                : isVerified(author) && <Verified className="text-[0.9em]" />}
            </span>
            <span aria-hidden="true">·</span>
            <span>{timeAgo(topic.last_post_at)}</span>
            {showCategory && (
              <>
                <span aria-hidden="true">·</span>
                <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 font-bold text-white/55">
                  {topic.category_name}
                </span>
              </>
            )}
          </span>
        </span>

        <span className="col-span-2 flex items-center gap-4 text-xs font-bold tabular-nums text-white/45 sm:col-span-1 sm:gap-6">
          <Count icon={faComment} n={topic.reply_count} what="replies" />
          <Count icon={faEye} n={topic.view_count} what="views" />
          <Count icon={faThumbsUp} n={topic.like_count} what="found it helpful" />
        </span>
      </Link>
    </li>
  )
}

function Count({ icon, n, what }: { icon: typeof faComment; n: number; what: string }) {
  return (
    <span className="inline-flex w-14 items-center gap-1.5" title={`${n} ${what}`}>
      <Glyph icon={icon} className="text-[11px] text-white/25" />
      {formatCount(n)}
    </span>
  )
}
