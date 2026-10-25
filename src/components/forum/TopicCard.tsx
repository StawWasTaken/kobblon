import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faComment, faPlay, faThumbsUp } from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { useAsync } from '@/hooks/useAsync'
import { forumImageUrl, forumTopics, isForumClip } from '@/lib/api'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ForumTopic } from '@/types/db'

/**
 * A topic as a card, for the pages that quote the forum.
 *
 * `TopTopics` draws the same five topics as a list of rows, and a list of
 * rows is right where it sits inside a column of other rows - the landing
 * page's band. It was wrong on the two pages Staw pointed at: "the 'From
 * the forum' stuff in the logged in homepage doesnt match at all the
 * design of the homepage, and same thing for the one in the what is
 * kobblon page ... for the what is kobblon page i was more expecting to
 * see post cards rather than this".
 *
 * He is right about both, and they are the same mistake twice: Home is
 * shelves of tiles that slide, and What is Kobblon is bands of big cards
 * with pictures in them. A bordered list of five thin rows is a settings
 * panel, and it looked like one on both.
 *
 * So one card, in two looks, rather than two components that drift:
 *
 *   `tile`   a shelf tile, the width of the Worlds beside it on Home.
 *   `glass`  the At Kobblon look - a tall card, lifted on hover, the way
 *            `GlassCard` behaves in the bands above it.
 */
export function TopicCard({ topic, look = 'tile', className, urlOf = forumImageUrl }: {
  topic: ForumTopic
  look?: 'tile' | 'glass'
  className?: string
  /* How an attachment's path becomes a URL. The pages never pass this;
     `Lightbox` takes the same escape hatch for the same reason, which is
     that the bare preview under `tools/site/` has no bucket to ask and
     would otherwise show nothing but empty rectangles. */
  urlOf?: (path: string) => string
}) {
  const glass = look === 'glass'
  /*
   * The picture on the card is whatever was attached to the post, and
   * nothing is drawn when nothing was.
   *
   * Staw, on the newsroom that was in the backlog: "for the thumbnails
   * it'll just be the media attached (if theres any) so we dont need to
   * actually build a newsroom". Which is the whole argument - a separate
   * newsroom means somebody writing the piece twice and choosing a
   * picture twice, and an announcement already has both.
   */
  const cover = topic.images?.[0]
  const clip = cover ? isForumClip(cover) : false
  /* The first lines of the post. A card with a title and nothing under it
     is a link wearing a card; what makes somebody open a thread is the
     first sentence of it. */
  const gist = topic.body.replace(/\s+/g, ' ').trim()

  return (
    <Link
      to={`/forum/t/${topic.id}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border p-4 transition-[border-color,transform,background-color]',
        glass
          ? 'rounded-3xl border-white/10 bg-white/[0.04] p-6 hover:-translate-y-1 hover:border-brand-bright/50'
          : 'w-64 shrink-0 border-ink-line bg-ink-card hover:border-white/25 sm:w-72',
        className,
      )}
    >
      {cover && (
        <span className={cn(
          'relative -mx-4 -mt-4 mb-4 block overflow-hidden bg-media',
          glass ? '-mx-6 -mt-6 mb-5 rounded-t-3xl' : 'rounded-t-2xl',
        )}>
          {clip ? (
            <>
              <video
                src={urlOf(cover)}
                preload="metadata"
                muted
                playsInline
                className="pointer-events-none aspect-[16/9] w-full object-cover"
              />
              <span className="absolute inset-0 grid place-items-center bg-ink/25">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ink/70 text-white backdrop-blur-sm">
                  <Glyph icon={faPlay} className="ml-0.5" />
                </span>
              </span>
            </>
          ) : (
            <img
              src={urlOf(cover)}
              alt=""
              aria-hidden="true"
              loading="lazy"
              draggable={false}
              className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}
        </span>
      )}

      <span className="flex items-center gap-2">
        <span className={cn(
          'rounded-md px-1.5 py-0.5 text-[11px] font-extrabold',
          glass ? 'bg-brand/20 text-brand-bright' : 'bg-white/[0.07] text-white/60',
        )}>
          {topic.category_name}
        </span>
        <span className="text-[11px] font-bold text-white/35">{timeAgo(topic.last_post_at)}</span>
      </span>

      <span
        className={cn(
          'mt-3 line-clamp-2 font-display font-extrabold leading-snug text-white transition-colors group-hover:text-brand-bright',
          glass ? 'text-xl' : 'text-[15px]',
        )}
      >
        {topic.title}
      </span>

      {gist && (
        <span className={cn(
          'mt-2 text-sm leading-relaxed text-white/50',
          glass ? 'line-clamp-4' : 'line-clamp-3',
        )}>
          {gist}
        </span>
      )}

      {/* Pushed to the bottom, so a shelf of these lines up along its
          foot however long the titles are. */}
      <span className="mt-auto flex items-center gap-2 pt-4">
        <Avatar
          src={topic.author_avatar}
          name={topic.author_name}
          personId={topic.author_id}
          size="xs"
          className="shrink-0"
        />
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-white/55">
          {topic.author_name}
        </span>
        <span className="flex shrink-0 items-center gap-3 text-xs font-bold tabular-nums text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <Glyph icon={faComment} className="text-[11px] text-white/25" />
            {formatCount(topic.reply_count)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Glyph icon={faThumbsUp} className="text-[11px] text-white/25" />
            {formatCount(topic.like_count)}
          </span>
        </span>
      </span>
    </Link>
  )
}

/**
 * The topics those cards are made of.
 *
 * One asking place for all three pages that quote the forum, for the
 * reason `TopTopics` gives: three of these is three places for
 * "interesting" to quietly become "newest".
 */
export function useTopTopics(limit = 5) {
  const topics = useAsync(() => forumTopics({ sort: 'interesting', limit }), [limit])
  return topics.data ?? []
}

/**
 * Kobblon's news, which is a board on the forum and not a second product.
 *
 * Staw: "for the forums & the about page, no newsroom, use the forums'
 * announcement channel". The Announcements board is staff-only, it is
 * where the people doing the thing say what they are doing, and it
 * already has a writer, a reader, moderation, likes and replies. A
 * newsroom would have been all of that again with nobody to write in it.
 *
 * Newest first, not "interesting": an announcement is news, and the
 * second-most interesting piece of news from March is not news.
 */
export function useAnnouncements(limit = 3) {
  const topics = useAsync(
    () => forumTopics({ category: 'announcements', sort: 'new', limit }),
    [limit],
  )
  return topics.data ?? []
}
