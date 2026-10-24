import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faComment, faEye, faRightToBracket, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/States'
import { BOARD_COLOUR } from '@/components/forum/Shell'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ForumRelated } from '@/types/db'

/* -------------------------------------------------------- the rail */

/**
 * How far down the thread you are, as a line beside it.
 *
 * Staw: "i want a bar to go down too on the right". Discourse's timeline:
 * the date the thread opened at the top, where you are in the middle, the
 * age of the last post at the bottom, and a line that fills as you read.
 *
 * It measures the article itself rather than the window, which is the part
 * worth saying. Measuring the window counts the bar, the composer and the
 * footer as part of the thread, so the line is already a third full before
 * the first word and never reaches the end - which is a progress bar that
 * lies in both directions. This asks the element where the posts actually
 * are.
 *
 * Hidden under `xl`, because a rail beside a column of prose on a laptop
 * is a rail taking the prose's width.
 */
export function ReadingRail({
  of, started, last, count,
}: {
  /** The element the thread is in. */
  of: React.RefObject<HTMLElement | null>
  started: string
  last: string
  /** How many posts, so the rail can say which one you are at. */
  count: number
}) {
  const [through, setThrough] = useState(0)

  useEffect(() => {
    const node = of.current
    if (!node) return

    const measure = () => {
      const box = node.getBoundingClientRect()
      /*
       * Where the middle of the window is, against the thread's own
       * height. The middle rather than the top: with the top, a thread
       * shorter than the window never moves at all, and the number is
       * about what you are looking at rather than where the page begins.
       */
      const middle = window.innerHeight / 2
      const into = middle - box.top
      const runs = Math.max(1, box.height)
      setThrough(Math.min(1, Math.max(0, into / runs)))
    }

    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [of])

  const at = Math.min(count, Math.max(1, Math.round(through * count) || 1))

  return (
    <aside className="hidden w-32 shrink-0 xl:block">
      <div className="sticky top-24">
        <p className="text-[11px] font-bold text-white/30">{timeAgo(started)}</p>

        <div className="relative my-3 flex h-56 gap-3">
          <span className="relative w-0.5 shrink-0 rounded-full bg-white/10">
            <span
              className="absolute inset-x-0 top-0 rounded-full bg-brand-bright transition-[height] duration-150"
              style={{ height: `${Math.round(through * 100)}%` }}
            />
            {/* Where you are, as a mark that rides the line. */}
            <span
              className="absolute -left-[3px] h-2 w-2 rounded-full bg-brand-bright ring-4 ring-ink transition-[top] duration-150"
              style={{ top: `calc(${Math.round(through * 100)}% - 4px)` }}
            />
          </span>

          <span
            className="absolute left-5 text-xs font-extrabold tabular-nums text-white/70 transition-[top] duration-150"
            style={{ top: `calc(${Math.round(through * 100)}% - 10px)` }}
          >
            {at} <span className="font-bold text-white/30">/ {count}</span>
          </span>
        </div>

        <p className="text-[11px] font-bold text-white/30">{timeAgo(last)}</p>
      </div>
    </aside>
  )
}

/* ------------------------------------------------- the signed-out note */

/**
 * The card at the foot of a thread for somebody who is not signed in.
 *
 * Staw asked for "a hello looks like youre enjoying the conversation
 * thing", and showed Discourse's, which is about reading position,
 * notifications and likes - so this one says what *Kobblon* gives you
 * rather than translating theirs. Every line of it is a thing the forum
 * actually does: `forum_seen` keeps where you got to, `forum_reply` makes
 * a notification, `forum_like` is the Helpful mark. Nothing here is
 * promised that is not built.
 *
 * It does not block anything, and it has a way out that is not signing in.
 * A wall across a public thread would undo the one decision this forum was
 * built on - that it is readable by anybody.
 */
export function SignedOutNote({ back }: { back: string }) {
  const [gone, setGone] = useState(false)
  if (gone) return null

  const where = `/login?next=${encodeURIComponent(back)}`

  return (
    <aside className="mt-8 rounded-2xl border border-brand-bright/30 bg-brand/[0.12] p-5">
      <p className="font-display text-base font-extrabold">
        Enjoying this one? There is more of it with an account.
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
        Signed in, the forum keeps your place in a thread so you come back to where you
        stopped, tells you when somebody answers you, and lets you mark the replies that
        actually helped. And you can write one yourself.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button to={where} size="sm" variant="yes" icon={faRightToBracket}>Sign in</Button>
        <Button to="/signup" size="sm" variant="subtle">Make an account</Button>
        <button
          type="button"
          onClick={() => setGone(true)}
          className="text-sm font-bold text-white/40 transition-colors hover:text-white"
        >
          Maybe later
        </button>
      </div>
    </aside>
  )
}

/* ----------------------------------------------------- related topics */

/**
 * What else to read, under the thread.
 *
 * Ranked by the words two titles share, which the database does. A topic
 * sharing nothing is not shown at all, so an unusual title gets a short
 * list or none - which is why this returns nothing rather than a heading
 * over six strangers.
 */
export function RelatedTopics({
  topics, loading,
}: {
  topics: ForumRelated[]
  loading: boolean
}) {
  if (!loading && !topics.length) return null

  return (
    <section className="mt-10 border-t border-white/[0.07] pt-6">
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
        <Glyph icon={faLayerGroup} className="text-xs text-brand-bright" />
        Related topics
      </p>

      <ul className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-ink-card/40">
        {loading
          ? [0, 1, 2].map((i) => (
            <li key={i} className="p-4"><Skeleton className="h-5 rounded-lg" /></li>
          ))
          : topics.map((one) => (
            <li key={one.id}>
              <Link
                to={`/forum/t/${one.id}`}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
              >
                <span className={cn(
                  'h-2 w-2 shrink-0 rounded-sm',
                  BOARD_COLOUR[one.category] ?? 'bg-white/30',
                )} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white/85 transition-colors group-hover:text-brand-bright">
                    {one.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-bold text-white/30">
                    {one.category_name} · {timeAgo(one.last_post_at)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-[11px] font-bold tabular-nums text-white/35">
                  <span className="inline-flex items-center gap-1">
                    <Glyph icon={faComment} className="text-[10px]" />
                    {formatCount(one.reply_count)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Glyph icon={faEye} className="text-[10px]" />
                    {formatCount(one.view_count)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
      </ul>
    </section>
  )
}

/* --------------------------------------------------------------- the OP */

/** Who opened the thread, said once beside their name on every post. */
export function OpTag() {
  return (
    <span
      title="Opened this topic"
      className="rounded-md border border-white/15 bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/55"
    >
      OP
    </span>
  )
}
