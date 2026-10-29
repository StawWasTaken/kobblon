import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { NameMarks } from '@/components/brand/Verified'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { forumProfile } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ForumPerson } from '@/types/db'

/**
 * Who is talking, without leaving the thread.
 *
 * Staw: "for the forum we can hover onto the profile whos posting and we
 * can see that too". So the name and the face on every post open this, and
 * it draws the forum profile that already exists behind
 * `/forum/u/<username>` - the same tags, the same bio, the same counts. It
 * is not a second profile with its own idea of somebody.
 *
 * What it deliberately does **not** show is a read time or a solved count,
 * which the card Staw sent over has. Neither is measured on this platform.
 * A card that invents two of its five numbers is worse than a card with
 * three, and `docs/neoclassic.md` is explicit about it: no fake
 * functionality.
 *
 * One answer per username for the life of the page. A long thread is forty
 * posts by six people, and asking the database six times is right; asking
 * it forty times because somebody ran the mouse down the page is not.
 */
const answered = new Map<string, ForumPerson | null>()

/* Where it opens from. Below the name, unless the name is low enough on the
   screen that below would be off the bottom of it - which is most of a long
   thread, so this is the common case rather than the edge one. */
type Side = 'under' | 'over'

export function PosterPeek({
  username, children, className,
}: {
  username: string
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<Side>('under')
  const [person, setPerson] = useState<ForumPerson | null | undefined>(
    answered.get(username),
  )
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const anchor = useRef<HTMLSpanElement>(null)

  /* Every timer this ever sets is cleared when it leaves, because a card
     that opens after the post it belongs to has scrolled away is a card
     pointing at somebody else. */
  useEffect(() => () => { if (hold.current) clearTimeout(hold.current) }, [])

  const show = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = setTimeout(() => {
      const box = anchor.current?.getBoundingClientRect()
      if (box) setSide(box.bottom + 340 > window.innerHeight ? 'over' : 'under')
      setOpen(true)
    }, 320)
  }

  const hide = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = setTimeout(() => setOpen(false), 160)
  }

  /*
   * Asked at the moment it opens, not when the post renders.
   *
   * `asked` is the guard rather than the username, because the username
   * cannot change but the card can be shut before the answer lands - and
   * writing a stale answer into state is the trap this project keeps
   * finding. The map is still filled either way: the answer is right, it
   * is only this card that stopped wanting it.
   */
  useEffect(() => {
    if (!open || answered.has(username)) return
    let wanted = true
    forumProfile(username)
      .then((found) => {
        answered.set(username, found)
        if (wanted) setPerson(found)
      })
      .catch(() => {
        /* Left out of the map: a card that failed once should ask again
           rather than remember the failure for the life of the page. */
        if (wanted) setPerson(null)
      })
    return () => { wanted = false }
  }, [open, username])

  useEffect(() => {
    if (open && answered.has(username)) setPerson(answered.get(username))
  }, [open, username])

  return (
    <span
      ref={anchor}
      className={cn('relative inline-flex min-w-0', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {open && (
        <span
          /* Not a tooltip: it holds links, so it is a thing you can move
             into rather than a label that follows the pointer. */
          className={cn(
            'absolute left-0 z-50 block w-[19rem] cursor-default',
            side === 'under' ? 'top-full pt-2' : 'bottom-full pb-2',
          )}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <PosterCard person={person} username={username} />
        </span>
      )}
    </span>
  )
}

/**
 * The card itself, given its answer rather than asking for one.
 *
 * Exported so `tools/site/forum-preview` can mount it with a fixture: the
 * harness has no route to the database, and a card that only ever renders
 * its "could not be read" state is a card nobody has looked at.
 */
export function PosterCard({ person, username }: { person: ForumPerson | null | undefined; username: string }) {
  return (
    <span className="block overflow-hidden rounded-2xl border border-white/12 bg-ink-raised shadow-pop">
      {person === undefined && (
        <span className="block animate-pulse p-4">
          <span className="block h-11 w-11 rounded-full bg-white/[0.07]" />
          <span className="mt-3 block h-3.5 w-28 rounded bg-white/[0.07]" />
          <span className="mt-2.5 block h-3 w-40 rounded bg-white/[0.05]" />
        </span>
      )}

      {person === null && (
        <span className="block p-4 text-sm text-white/45">
          That profile could not be read.
        </span>
      )}

      {person && (
        <>
          <span className="block p-4">
            <span className="flex items-start gap-3">
              <Avatar
                src={person.avatar_url}
                name={person.display_name}
                personId={person.user_id}
                size="md"
              />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-display text-base font-extrabold text-white">
                    {person.display_name}
                  </span>
                  {/* The row already carries the marks, so they are handed
                      over as the fallback: `NameMarks` asks the database and
                      falls back to this, which is the path a cold load takes
                      and the only path the harness can take at all. */}
                  <NameMarks
                    id={person.user_id}
                    person={{
                      is_verified: person.marks.includes('verified'),
                      has_staff_badge: person.marks.includes('staff'),
                    }}
                    className="text-[0.85em]"
                  />
                </span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-white/35">
                  @{person.username}
                </span>
              </span>
            </span>

            {person.tag_labels.length > 0 && (
              <span className="mt-3 flex flex-wrap gap-1.5">
                {person.tag_labels.map((word, at) => (
                  <span
                    key={word}
                    className={cn(
                      'rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider',
                      person.tags[at] === 'staff'
                        ? 'border-brand-bright/40 bg-brand/15 text-brand-bright'
                        : 'border-white/12 bg-white/[0.05] text-white/45',
                    )}
                  >
                    {word}
                  </span>
                ))}
              </span>
            )}

            {person.bio && (
              <span className="mt-3 line-clamp-3 block text-sm leading-relaxed text-white/55">
                {person.bio}
              </span>
            )}
          </span>

          <span className="flex items-center gap-5 border-t border-white/[0.08] bg-ink/40 px-4 py-3">
            <Count value={person.topic_count} word="Topics" />
            <Count value={person.post_count} word="Replies" />
            <span className="block">
              <span className="block font-display text-sm font-extrabold tabular-nums text-white/80">
                {new Date(person.joined_at).toLocaleDateString(undefined, {
                  month: 'short', year: 'numeric',
                })}
              </span>
              <span className="mt-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-white/30">
                Joined
              </span>
            </span>
          </span>
        </>
      )}

      <Link
        to={`/forum/u/${username}`}
        className="flex items-center justify-between gap-2 border-t border-white/[0.08] px-4 py-2.5 text-xs font-extrabold text-brand-bright transition-colors hover:bg-white/[0.04]"
      >
        See their profile
        <Glyph icon={faArrowRight} className="text-[10px]" />
      </Link>
    </span>
  )
}

function Count({ value, word }: { value: number; word: string }) {
  return (
    <span className="block">
      <span className="block font-display text-sm font-extrabold tabular-nums text-white/80">
        {formatCount(value)}
      </span>
      <span className="mt-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-white/30">
        {word}
      </span>
    </span>
  )
}
