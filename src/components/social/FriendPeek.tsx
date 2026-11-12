import { useId, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { faUser, faComment, faSpinner, faPlay } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { StatusDot, presenceWords } from '@/components/ui/StatusDot'
import { useLivePresence, useWhereabout, useWhereabouts } from '@/hooks/usePresenceStore'
import { play } from '@/lib/app'
import type { Whereabouts } from '@/lib/api'
import { worldLink } from '@/lib/links'
import { useChatDock } from '@/components/chat/ChatDock'
import { useToast } from '@/components/ui/Toast'
import { startConversation } from '@/lib/api'
import { profileLink } from '@/lib/links'
import { cn } from '@/lib/cn'

type Friend = {
  id: string
  username: string
  display_name: string
  content_id?: number | null
  is_online?: boolean
  in_space_id?: string | null
  activity?: string | null
  last_seen_at?: string | null
}

/*
 * Which card is up, for the whole page at once.
 *
 * Staw: "i dont want to see this on two like accounts, like in the
 * friendlists when u hover one guy it appears then you hover another guy it
 * disappears and then it appears for the next guy". Each card deciding for
 * itself is exactly that - the one being left takes its grace period to go
 * while the one being entered is already there, so for a moment there are
 * two, and then a gap. One value for the page means moving along a row
 * hands the card from face to face with nothing in between: the new one
 * opening is what closes the old one, in the same tick.
 */
let up: string | null = null
const watching = new Set<() => void>()

function raise(key: string | null) {
  if (up === key) return
  up = key
  watching.forEach((tell) => tell())
}

function watch(tell: () => void) {
  watching.add(tell)
  return () => { watching.delete(tell) }
}

/**
 * Where they are: the World's own picture, its name, and how full that copy
 * is, as one tile.
 *
 * Staw: "i want a better design for 'friend is playing' thing, but keep the
 * same uniformized design as the ones we have for those not playing". So
 * the card is the same card - same width, same head, same two doors along
 * the bottom - and this is a block that appears in the middle of it when
 * there is something to show. A separate layout for somebody who happens to
 * be in a World would be two hover cards, which is the thing that was
 * wrong with three different person cards.
 */
function WorldHere({ where }: { where: Whereabouts }) {
  const full = where.how_many >= where.capacity
  const share = where.capacity > 0
    ? Math.min(100, Math.round((where.how_many / where.capacity) * 100))
    : 0

  const inside = (
    <>
      {/* No cover is drawn as the mark rather than as a hole: an empty box
          the size of a thumbnail reads as a picture that failed. */}
      <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-lg border-2 border-white/15 bg-ink-raised">
        {where.world_cover ? (
          <img src={where.world_cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-white/30">
            <Glyph icon={faPlay} className="text-[9px]" />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-extrabold leading-tight text-white">
          {where.world_name}
        </span>
        <span className="mt-0.5 block text-[10px] font-semibold tabular-nums text-white/50">
          {where.how_many} of {where.capacity} in there
        </span>
        <span className="mt-1 block h-0.5 overflow-hidden rounded-full bg-black/50">
          <span
            className={cn('block h-full rounded-full', full ? 'bg-danger' : 'bg-space-bright')}
            style={{ width: `${Math.max(share, 6)}%` }}
          />
        </span>
      </span>
    </>
  )

  const look = 'mt-2 flex items-center gap-2 rounded-lg border-2 border-space/40 bg-space/10 p-1.5'

  return where.world_content_id
    ? (
      <Link
        to={worldLink({ content_id: where.world_content_id, name: where.world_name })}
        className={cn(look, 'transition-colors hover:border-space/70 hover:bg-space/20')}
      >
        {inside}
      </Link>
    )
    : <span className={look}>{inside}</span>
}

/**
 * The little card behind a friend's face.
 *
 * Staw: "when hovering a profile from your friends in your friendlist, you
 * can see this card (with an arrow pointer ofc) to see the profile of that
 * friend or open chat with them". Two doors and nothing else - what the
 * screenshots show - with the person's presence across the top so the
 * choice between them is an informed one: there is no point starting a
 * chat without knowing whether anybody is there.
 *
 * It is a `div` rather than a menu because what is inside it are a link and
 * a button, which the keyboard already knows how to walk. The arrow is one
 * rotated square carrying two of the card's own borders, and it lives
 * inside the animated wrapper: `animate-pop-in` puts a transform there, and
 * a transform makes that element the containing block for anything
 * absolutely positioned under it, so an arrow pinned to the outer box lands
 * behind the card and never draws at all.
 */
export function FriendPeek({ friend, children, className }: {
  friend: Friend
  /** The face this card belongs to. */
  children: React.ReactNode
  className?: string
}) {
  const key = useId()
  const open = useSyncExternalStore(watch, () => up === key, () => false)
  const [opening, setOpening] = useState(false)
  const away = useRef<number | null>(null)
  const presence = useLivePresence(friend)
  const { openConversation } = useChatDock()
  const say = useToast()

  /*
   * Asked only while the card is up, and about this one person.
   *
   * Staw asked for a hover card that names the World somebody is in and
   * offers to follow them into it. Which World that is cannot come from the
   * row behind the face - a row says `in_space_id` at best, and the face
   * may have been fetched ten minutes ago. So the card asks the roster
   * when it opens, which is one round trip on a deliberate action rather
   * than one per face on a list of sixty.
   */
  useWhereabouts(open ? [friend] : [])
  const where = useWhereabout(friend.id)

  const show = () => {
    if (away.current) window.clearTimeout(away.current)
    raise(key)
  }

  /*
   * A short wait before it goes, so crossing the gap between the face and
   * the card does not take the card away mid-reach. Entering another face
   * does not wait: that one raises itself, which drops this one at once.
   */
  const hide = () => {
    if (away.current) window.clearTimeout(away.current)
    away.current = window.setTimeout(() => { if (up === key) raise(null) }, 140)
  }

  /*
   * Following somebody into the copy of the World they are actually in.
   *
   * The server id travels as `room`, and it is a hint: whether this account
   * may be in that room is decided by `join_world_server` over HTTPS, which
   * is where it has always been decided. A full room, a closed one or a
   * private one refuses there, not here.
   */
  const join = () => {
    if (!where) return
    raise(null)
    void play(where.world_id, () => {
      say('Kobblon is not installed on this machine. The download page has it.', 'info')
    }, where.server_id)
  }

  const chat = async () => {
    setOpening(true)
    try {
      openConversation(await startConversation(friend.id))
      raise(null)
    } catch (error) {
      say(error instanceof Error ? error.message : 'Could not open that chat.', 'error')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {open && (
        <div className="absolute left-1/2 top-full z-30 w-52 -translate-x-1/2 pt-2">
          <div className="relative origin-top animate-pop-in">
            {/*
              * The pointer, drawn after the card rather than before it.
              * A square on its corner carrying two of the card's borders -
              * and painted last, so its fill covers the card's own top
              * border where the two meet. Underneath the card it sat
              * behind that 1px line, which read as a nub floating above a
              * closed box rather than as a corner of it.
              */}
            <span className="absolute -top-[6px] left-1/2 z-10 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] border-l border-t border-ink-line bg-ink-card" />

            <div className="relative overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-ink-card shadow-pop">
              <div className="border-b border-ink-line px-3 py-2">
                <p className="truncate text-[13px] font-bold leading-tight text-white">
                  {friend.display_name}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                  <StatusDot presence={presence} size="sm" />
                  {/* "In a World" over the World's own name says the same thing
                      twice; the name below is the half worth reading. */}
                  {where ? 'is playing' : presenceWords[presence]}
                </p>

                {/* The World by name, because "In a World" is not
                    something anybody can decide to follow somebody into. A
                    World with no content id has no address, so it is named
                    rather than linked: a link that goes nowhere is worse
                    than a name. */}
                {where && (
                  <WorldHere where={where} />
                )}
              </div>

              <div className="p-1">
                {where && (
                  <button
                    type="button"
                    onClick={join}
                    disabled={where.how_many >= where.capacity}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-bold text-space-bright transition-colors hover:bg-ink-hover disabled:text-white/35 disabled:hover:bg-transparent"
                  >
                    <Glyph icon={faPlay} className="w-3.5 text-[11px]" />
                    {where.how_many >= where.capacity ? 'That copy is full' : 'Join them'}
                  </button>
                )}

                <Link
                  to={profileLink(friend)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-white/75 transition-colors hover:bg-ink-hover hover:text-white"
                >
                  <Glyph icon={faUser} className="w-3.5 text-[11px] text-muted" />
                  Profile
                </Link>

                <button
                  type="button"
                  onClick={() => void chat()}
                  disabled={opening}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-semibold text-white/75 transition-colors hover:bg-ink-hover hover:text-white disabled:opacity-60"
                >
                  <Glyph
                    icon={opening ? faSpinner : faComment}
                    className={cn('w-3.5 text-[11px] text-muted', opening && 'animate-spin')}
                  />
                  Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
