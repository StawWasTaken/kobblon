import { useId, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { faUser, faComment, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { StatusDot, presenceOf, presenceWords } from '@/components/ui/StatusDot'
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
  const presence = presenceOf(friend)
  const { openConversation } = useChatDock()
  const say = useToast()

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
        <div className="absolute left-1/2 top-full z-30 w-44 -translate-x-1/2 pt-2">
          <div className="relative origin-top animate-pop-in">
            <span className="absolute -top-[6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[3px] border-l border-t border-ink-line bg-ink-card" />

            <div className="relative overflow-hidden rounded-xl border border-ink-line bg-ink-card shadow-xl shadow-black/50">
              <div className="border-b border-ink-line px-3 py-2">
                <p className="truncate text-[13px] font-bold leading-tight text-white">
                  {friend.display_name}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                  <StatusDot presence={presence} size="sm" />
                  {presenceWords[presence]}
                </p>
              </div>

              <div className="p-1">
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
