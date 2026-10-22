import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { faUser, faComment } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { PresenceLabel, presenceOf } from '@/components/ui/StatusDot'
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

/**
 * The little card behind a face in the friends list.
 *
 * Staw: "when hovering a profile from your friends in your friendlist, you
 * can see this card (with an arrow pointer ofc) to see the profile of that
 * friend or open chat with them". So two doors and nothing else - what the
 * screenshots show - with the person's presence across the top so the
 * choice between them is an informed one: there is no point starting a
 * chat without knowing whether anybody is there.
 *
 * It sits on hover and on focus, and it is a `div` rather than a menu
 * because what is inside it are two links, which the keyboard already
 * knows how to walk. The arrow is one rotated square under the card's own
 * border, which is the only way to get a pointer that keeps the edge.
 */
export function FriendPeek({ friend, children, className }: {
  friend: Friend
  /** The face this card belongs to. */
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState(false)
  const away = useRef<number | null>(null)
  const { openConversation } = useChatDock()
  const say = useToast()

  /*
   * A short wait before it closes, so crossing the gap between the face
   * and the card does not take the card away mid-reach.
   */
  const show = () => {
    if (away.current) window.clearTimeout(away.current)
    setOpen(true)
  }
  const hide = () => {
    if (away.current) window.clearTimeout(away.current)
    away.current = window.setTimeout(() => setOpen(false), 120)
  }

  const chat = async () => {
    setOpening(true)
    try {
      openConversation(await startConversation(friend.id))
      setOpen(false)
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
        <div className="absolute left-1/2 top-full z-30 w-48 -translate-x-1/2 pt-2">
          {/* The pointer: a square turned on its corner, with the two
              sides that show carrying the card's border. */}
          <span className="absolute left-1/2 top-[3px] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-ink-line bg-ink-card" />

          <div className="overflow-hidden rounded-xl border border-ink-line bg-ink-card shadow-xl">
            <div className="truncate border-b border-ink-line px-3 py-2">
              <p className="truncate text-sm font-bold text-white">{friend.display_name}</p>
              <PresenceLabel presence={presenceOf(friend)} />
            </div>

            <Link
              to={profileLink(friend)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-ink-hover hover:text-white"
            >
              <Glyph icon={faUser} className="w-4 text-xs" />
              View profile
            </Link>

            <button
              type="button"
              onClick={() => void chat()}
              disabled={opening}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-semibold text-white/80 hover:bg-ink-hover hover:text-white disabled:opacity-60"
            >
              <Glyph icon={faComment} className="w-4 text-xs" />
              <span className="truncate">Chat with {friend.display_name}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
