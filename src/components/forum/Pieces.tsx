import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { NameMarks } from '@/components/brand/Verified'
import { Glyph } from '@/components/brand/Glyph'
import { faCheck, faThumbsUp, faLock, faThumbtack, faPlay } from '@fortawesome/free-solid-svg-icons'
import { forumImageUrl, isForumClip } from '@/lib/api'
import { Lightbox } from '@/components/forum/Lightbox'
import { timeAgo } from '@/lib/format'
import { Markup } from '@/components/forum/Markup'
import { OpTag } from '@/components/forum/Reading'
import { PosterPeek } from '@/components/forum/Peek'
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
 * on the forum writes it through here - and here asks `NameMarks`, which
 * asks the database. It used to draw one mark or the other, never both,
 * which is half of what Staw was seeing: staff wore the k and lost the
 * tick they had also earned.
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
      to={`/forum/u/${person.author_username}`}
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 font-display font-extrabold text-white transition-colors hover:text-brand-bright',
        large ? 'text-base' : 'text-sm',
        className,
      )}
    >
      <span className="truncate">{person.author_name || person.author_username}</span>
      <NameMarks id={person.author_id} person={asPerson} className="text-[0.85em]" />
    </Link>
  )
}

/**
 * Who they are to Kobblon, said in a word, where it is worth saying.
 *
 * Staw: "sometimes it says ADMIN sometimes it says STAFF on the tags, just
 * pick one". He was reading the same person twice: a post said ADMIN,
 * because this drew `is_admin` and `is_moderator` as two different words,
 * and the hover card said STAFF, because that reads the automatic forum tag
 * whose label is Staff. One word now, and it is Staff - that is the word
 * the rest of Kobblon uses for these people: the badge is the staff k, the
 * section behind it is /staff, and `wears_staff_badge` is what decides who
 * carries the mark. Admin against Moderator is how the keys are divided
 * inside the house, which is nobody's business out here.
 */
export function Role({ person }: { person: ForumAuthor }) {
  if (!person.author_is_admin && !person.author_is_moderator) return null
  const word = 'Staff'

  return (
    <span className="rounded-md border border-brand-bright/40 bg-brand/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-bright">
      {word}
    </span>
  )
}

/**
 * The word somebody chose for themselves, beside their name.
 *
 * Staw: "i want the tag that we set in the forum profile to be visible next
 * to your name in posts too". Quieter than `Role`, on purpose - Staff is
 * what Kobblon says you are, and this is what you say you are, and the two
 * should not read as the same kind of statement.
 */
export function TagChip({ person }: { person: ForumAuthor }) {
  // The database refuses an automatic tag when somebody picks one, so this
  // should never be Staff - but a row written before that rule would draw
  // the word twice in a row, and one chip saying it is the point.
  if (!person.author_tag || person.author_tag === 'Staff') return null

  return (
    <span className="rounded-md border border-white/12 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/45">
      {person.author_tag}
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

/**
 * The same words, for the buttons that put them on.
 *
 * Exported from here rather than written again on the topic page, because
 * the button and the pill it produces have to say the same thing and
 * "Been looked at" was already spelled out twice in two ways.
 */
export const STATUS_WORDS: Record<Exclude<ForumStatus, 'open'>, string> =
  Object.fromEntries(
    (Object.entries(MARKS) as [Exclude<ForumStatus, 'open'>, { word: string }][])
      .map(([key, mark]) => [key, mark.word]),
  ) as Record<Exclude<ForumStatus, 'open'>, string>

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
/**
 * What somebody wrote.
 *
 * It used to be paragraphs of plain text. It is `Markup` now, because the
 * composer grew a toolbar and a toolbar whose marks nothing renders is the
 * fake functionality this project does not ship. `Markup` still renders no
 * HTML - there is no path from a post to markup at all - so this is a
 * larger vocabulary and not a larger hole.
 */
export function PostBody({ body, className }: { body: string; className?: string }) {
  return <Markup body={body} className={className} />
}

/**
 * What somebody attached. Up to four, which the server enforces.
 *
 * Each one is a button into `Lightbox` rather than a link to the file.
 * Staw asked for the bigger view and asked for the new tab to go, and those
 * are the same change: a thumbnail that is an `<a href>` is a new tab by
 * middle click whatever the click handler does.
 *
 * A clip is drawn as its own first frame with a play mark over it, rather
 * than as a player per attachment: four players in a post are four things
 * loading, four sets of controls, and four ways to start a noise nobody
 * asked for. `preload="metadata"` is what makes the frame appear without
 * fetching forty megabytes to show a still.
 */
export function Attachments({ images }: { images: string[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!images?.length) return null

  return (
    <>
      <div className={cn(
        'mt-4 grid gap-2',
        images.length === 1 ? 'max-w-xl' : 'sm:grid-cols-2',
      )}>
        {images.map((path, i) => {
          const url = forumImageUrl(path)
          const clip = isForumClip(path)

          return (
            <button
              key={path}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={clip ? 'Play this clip' : 'See this picture bigger'}
              className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-media"
            >
              {clip ? (
                <>
                  <video
                    src={url}
                    preload="metadata"
                    muted
                    playsInline
                    controlsList="nodownload"
                    disablePictureInPicture
                    className="pointer-events-none max-h-[28rem] w-full object-contain"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-ink/25 transition-colors group-hover:bg-ink/10">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-ink/70 text-white backdrop-blur-sm">
                      <Glyph icon={faPlay} className="ml-0.5 text-lg" />
                    </span>
                  </span>
                </>
              ) : (
                <img
                  src={url}
                  alt="Attached to this post"
                  loading="lazy"
                  draggable={false}
                  className="max-h-[28rem] w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                />
              )}
            </button>
          )
        })}
      </div>

      <Lightbox paths={images} at={open} onMove={setOpen} onClose={() => setOpen(null)} />
    </>
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

/**
 * Avatar, name, role and when. The line every post opens with.
 *
 * `op` marks the person who opened the thread, on their own replies as
 * well as on the first post. Staw asked for it and it is worth more on a
 * forum than it looks: half of reading a long thread is working out which
 * replies are the person with the problem and which are people answering
 * it.
 *
 * The name goes to their forum profile rather than their Kobblon one -
 * this is the forum, and the forum profile has the button across to the
 * other.
 */
export function Byline({
  person, when, edited, large, op,
}: {
  person: ForumAuthor
  when: string
  edited?: string | null
  large?: boolean
  op?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PosterPeek username={person.author_username} className="shrink-0">
        <Link to={`/forum/u/${person.author_username}`} className="shrink-0">
          <Avatar
            src={person.author_avatar}
            name={person.author_name}
            personId={person.author_id}
            size={large ? 'md' : 'sm'}
          />
        </Link>
      </PosterPeek>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <PosterPeek username={person.author_username}>
            <Name person={person} large={large} />
          </PosterPeek>
          {op && <OpTag />}
          <Role person={person} />
          <TagChip person={person} />
        </div>
        <p className="mt-0.5 text-xs text-white/35">
          {timeAgo(when)}
          {edited && <span className="text-white/30"> (edited)</span>}
        </p>
      </div>
    </div>
  )
}
