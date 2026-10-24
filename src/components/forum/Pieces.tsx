import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Verified, Staff, isStaff, isVerified } from '@/components/brand/Verified'
import { Linkify } from '@/components/ui/Linkify'
import { Glyph } from '@/components/brand/Glyph'
import { faCheck, faThumbsUp, faLock, faThumbtack } from '@fortawesome/free-solid-svg-icons'
import { forumImageUrl } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ForumAuthor, ForumStatus } from '@/types/db'

/**
 * The small parts a forum is made of, in one file because they are only
 * ever used together and each of them is a dozen lines.
 */

/* ----------------------------------------------------------------- marks */

/**
 * A name with the marks it carries.
 *
 * Staw's rule from the badges themselves: a mark is part of the display
 * name rather than an ornament beside it, so every place a name is written
 * on the forum writes it through here. Staff carry the k; a verified
 * account carries the tick; staff are verified without being told so, which
 * is `isVerified`'s own rule and not a second copy of it here.
 */
export function Name({
  person, className, large,
}: {
  person: ForumAuthor
  className?: string
  large?: boolean
}) {
  const asPerson = {
    is_verified: person.author_is_verified,
    is_admin: person.author_is_admin,
    is_moderator: person.author_is_moderator,
  }

  return (
    <Link
      to={`/u/${person.author_username}`}
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 font-display font-extrabold text-white transition-colors hover:text-brand-bright',
        large ? 'text-base' : 'text-sm',
        className,
      )}
    >
      <span className="truncate">{person.author_name}</span>
      {isStaff(asPerson) && <Staff className="text-[0.85em]" />}
      {!isStaff(asPerson) && isVerified(asPerson) && <Verified className="text-[0.85em]" />}
    </Link>
  )
}

/** Who they are to Kobblon, said in a word, where it is worth saying. */
export function Role({ person }: { person: ForumAuthor }) {
  const word = person.author_is_admin
    ? 'Admin'
    : person.author_is_moderator
      ? 'Moderator'
      : null
  if (!word) return null

  return (
    <span className="rounded-md border border-brand-bright/40 bg-brand/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-bright">
      {word}
    </span>
  )
}

/* --------------------------------------------------------------- the mark */

/*
 * What a status looks like, and the colour is the sentence: green is yes,
 * red is no, blue is Kobblon, and "looked at" is deliberately neither - it
 * is an acknowledgement and not an answer, so it stays grey.
 */
const MARKS: Record<Exclude<ForumStatus, 'open'>, { word: string; look: string }> = {
  solved: { word: 'Solved', look: 'border-space/50 bg-space/15 text-space-bright' },
  approved: { word: 'Approved', look: 'border-space/50 bg-space/15 text-space-bright' },
  declined: { word: 'Declined', look: 'border-danger/45 bg-danger/15 text-danger-bright' },
  'looked-at': { word: 'Been looked at', look: 'border-white/15 bg-white/5 text-white/60' },
}

export function StatusPill({
  status, className, by,
}: {
  status: ForumStatus
  className?: string
  /** Who marked it, for the one place there is room to say. */
  by?: string | null
}) {
  if (status === 'open') return null
  const mark = MARKS[status]

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-extrabold',
        mark.look,
        className,
      )}
    >
      {(status === 'solved' || status === 'approved') && <Glyph icon={faCheck} className="text-[10px]" />}
      {mark.word}
      {by && <span className="font-bold opacity-60">· {by}</span>}
    </span>
  )
}

/** Pinned and closed, said as quietly as they deserve. */
export function Flags({ pinned, locked }: { pinned?: boolean; locked?: boolean }) {
  if (!pinned && !locked) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-2 text-white/35">
      {pinned && <Glyph icon={faThumbtack} className="text-xs" title="Pinned" />}
      {locked && <Glyph icon={faLock} className="text-xs" title="Closed to replies" />}
    </span>
  )
}

/* ------------------------------------------------------------- the words */

/**
 * Somebody's post, rendered as text.
 *
 * Blank lines make paragraphs and links become links, and that is the whole
 * of it. No markdown, no HTML, nothing that turns what a stranger typed
 * into markup: `Linkify` exists precisely so that the one thing a post is
 * allowed to do is point at an address.
 */
export function PostBody({ body, className }: { body: string; className?: string }) {
  const paragraphs = body.split(/\n{2,}/).filter((one) => one.trim())

  return (
    <div className={cn('space-y-4 text-[15px] leading-relaxed text-white/75', className)}>
      {paragraphs.map((paragraph, at) => (
        <p key={at} className="whitespace-pre-wrap break-words">
          <Linkify>{paragraph}</Linkify>
        </p>
      ))}
    </div>
  )
}

/** The pictures somebody attached. Up to four, which the server enforces. */
export function Attachments({ images }: { images: string[] }) {
  if (!images?.length) return null

  return (
    <div className={cn(
      'mt-4 grid gap-2',
      images.length === 1 ? 'max-w-xl' : 'sm:grid-cols-2',
    )}>
      {images.map((path) => (
        <a
          key={path}
          href={forumImageUrl(path)}
          target="_blank"
          rel="noreferrer noopener"
          className="group block overflow-hidden rounded-2xl border border-white/10 bg-media"
        >
          <img
            src={forumImageUrl(path)}
            alt="Attached to this post"
            loading="lazy"
            className="max-h-[28rem] w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </a>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- the press */

/** Helpful. One mark, and it is the only thing a reply is voted on. */
export function Helpful({
  on, count, onPress, disabled,
}: {
  on: boolean
  count: number
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-pressed={on}
      title={disabled ? 'Sign in to mark this helpful' : 'This helped'}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition-colors',
        on
          ? 'bg-space/20 text-space-bright'
          : 'text-white/45 hover:bg-white/[0.07] hover:text-white',
        disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent hover:text-white/45',
      )}
    >
      <Glyph icon={faThumbsUp} className="text-sm" on={on} />
      {count > 0 ? count : 'Helpful'}
    </button>
  )
}

/** Avatar, name, role and when. The line every post opens with. */
export function Byline({
  person, when, edited, large,
}: {
  person: ForumAuthor
  when: string
  edited?: string | null
  large?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link to={`/u/${person.author_username}`} className="shrink-0">
        <Avatar
          src={person.author_avatar}
          name={person.author_name}
          personId={person.author_id}
          size={large ? 'md' : 'sm'}
        />
      </Link>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Name person={person} large={large} />
          <Role person={person} />
        </div>
        <p className="mt-0.5 text-xs text-white/35">
          {timeAgo(when)}
          {edited && <span> · edited</span>}
        </p>
      </div>
    </div>
  )
}
