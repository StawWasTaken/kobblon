import { useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faAngleDown, faArrowDown, faReply } from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ForumReply } from '@/types/db'

/**
 * The parts that make a flat list of replies read as a conversation.
 *
 * A thread here was a column of boxes with "Replying to Ryko" in grey type
 * on one of them. That tells you a reply answers something and not what -
 * so following an argument meant scrolling up, finding the post, and
 * scrolling back down to where you were, which on a long topic is how
 * people stop reading.
 *
 * Three pieces, all of them built on rows the page already has: nothing
 * here asks the database for anything. The replies are all in hand, so who
 * answered whom is already known.
 */

/** Jump without the page reloading, and leave the anchor in the address. */
function goTo(id: number) {
  const post = document.getElementById(`post-${id}`)
  if (!post) return
  post.scrollIntoView({ behavior: 'smooth', block: 'center' })
  // A moment of colour, so the eye lands on the right box rather than
  // somewhere near it. Removed again, or every post you ever visited stays
  // lit for the rest of the session.
  post.classList.add('ring-2', 'ring-brand-bright/60')
  window.setTimeout(() => post.classList.remove('ring-2', 'ring-brand-bright/60'), 1400)
}

/** The first few lines of a post, for a preview that must not be a wall. */
function gist(body: string, about = 220) {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > about ? `${flat.slice(0, about).trimEnd()}…` : flat
}

/**
 * "Replying to somebody", as something you can open.
 *
 * Closed it is a chip: their picture and their name, which is the whole of
 * what the grey line used to say in less room. Open it is the post itself,
 * quoted, with the way down to it - so an answer three screens below the
 * thing it answers can be read in one place.
 *
 * It sits between the byline and the body, on a line of its own: the
 * first version put it at the top right beside the three dots, which is
 * where the eye is, and the quote it opens is a paragraph wide - so it
 * unfolded straight over the name it was next to.
 */
export function ReplyingTo({ parent, name }: { parent: ForumReply | null; name: string }) {
  const [open, setOpen] = useState(false)

  if (!parent) {
    /*
     * The parent was taken down, or it is the first post and never came
     * back in the list of replies. Still worth saying who was answered -
     * it is the one thing that makes the reply make sense.
     */
    return (
      <p className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-white/35">
        <Glyph icon={faReply} className="text-[10px]" />
        {name}
      </p>
    )
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] py-1 pl-1 pr-2.5 text-xs font-bold text-white/45 transition-colors hover:bg-white/[0.09] hover:text-white"
      >
        <Glyph icon={faReply} className="ml-1 text-[10px]" />
        <Avatar
          src={parent.author_avatar}
          name={parent.author_name}
          personId={parent.author_id}
          size="xs"
          className="h-5 w-5"
        />
        <span className="truncate">{parent.author_name}</span>
        <Glyph
          icon={faAngleDown}
          className={cn('text-[10px] transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <blockquote className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-sm leading-relaxed text-white/55">{gist(parent.body)}</p>
          <button
            type="button"
            onClick={() => goTo(parent.id)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-bright transition-colors hover:text-white"
          >
            <Glyph icon={faArrowDown} className="text-[10px] rotate-180" />
            Go to that post
          </button>
        </blockquote>
      )}
    </div>
  )
}

/**
 * The other direction: who answered this.
 *
 * Without it a reply that started a long back-and-forth looks like a dead
 * end, because every answer to it is somewhere further down wearing a chip
 * that points the other way. This is a line of pictures and a count, and
 * pressing one takes you to it.
 */
export function Answered({ kids }: { kids: ForumReply[] }) {
  const [open, setOpen] = useState(false)
  if (!kids.length) return null

  return (
    <div className="mt-3 border-t border-white/[0.07] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-extrabold text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <span className="flex -space-x-1.5">
          {kids.slice(0, 4).map((one) => (
            <Avatar
              key={one.id}
              src={one.author_avatar}
              name={one.author_name}
              personId={one.author_id}
              size="xs"
              className="h-5 w-5 ring-2 ring-ink"
            />
          ))}
        </span>
        {kids.length === 1 ? '1 reply' : `${kids.length} replies`}
        <Glyph
          icon={faAngleDown}
          className={cn('text-[10px] transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul className="mt-2 space-y-1.5 border-l border-white/10 pl-4">
          {kids.map((one) => (
            <li key={one.id}>
              <button
                type="button"
                onClick={() => goTo(one.id)}
                className="group block w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span className="flex items-center gap-2 text-xs font-bold text-white/55">
                  {one.author_name}
                  <span className="font-normal text-white/25">{timeAgo(one.created_at)}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-white/35 transition-colors group-hover:text-white/60">
                  {gist(one.body, 120)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * "Eleven days later."
 *
 * A topic that was answered in March and picked up again in October reads
 * as one conversation without this, and the thing somebody is agreeing
 * with is seven months old. Only drawn for a real gap - three days - so an
 * ordinary thread does not grow a line between every post.
 */
export function Later({ from, to }: { from: string; to: string }) {
  const days = Math.floor((+new Date(to) - +new Date(from)) / 86_400_000)
  if (days < 3) return null

  const said = days >= 730 ? `${Math.floor(days / 365)} years later`
    : days >= 365 ? 'A year later'
    : days >= 60 ? `${Math.floor(days / 30)} months later`
    : days >= 30 ? 'A month later'
    : `${days} days later`

  return (
    <li aria-hidden="true" className="flex items-center gap-4 py-2">
      <span className="h-px flex-1 bg-white/[0.07]" />
      <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/25">
        {said}
      </span>
      <span className="h-px flex-1 bg-white/[0.07]" />
    </li>
  )
}
