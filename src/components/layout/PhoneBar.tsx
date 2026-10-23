import { NavLink } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faComment } from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { useChatDock } from '@/components/chat/ChatDock'
import { avatarOf } from '@/lib/avatars'
import { mobileNav } from './nav'
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

/*
 * The row along the bottom of a phone.
 *
 * Staw sent Polytoria's and then Roblox's, so it is worth naming what both
 * of them actually do rather than copying the look of either:
 *
 * - **Flush slots, icon over a small word.** No fill behind the one you are
 *   on. Ours had a solid `bg-pick` block behind the active icon, which on a
 *   dark bar reads as a button somebody left pressed.
 * - **One slot is your own character, not a drawing.** That is the trick:
 *   the bar gets a middle, and the one slot that is about you looks like
 *   you. It is also the only slot that changes when you change something.
 * - **One slot is the chat.** Staw: "replace the friends thing by the
 *   messages thing (chat docks on the pc website)". It is the dock, opened
 *   from here, so the round floating button is gone - it had been sitting
 *   over the bottom-right corner of every page.
 * - **The one you are on is said quietly**, by weight and colour, with a
 *   short bar over the slot rather than under the word.
 */

/** One slot, so the four routes and the chat are drawn by the same code. */
function Slot({ on, label, children, onClick, to, end }: {
  on: boolean
  label: string
  children: ReactNode
  onClick?: () => void
  to?: string
  end?: boolean
}) {
  const inside = (
    <>
      {/* Over the slot, not under the word: under it, it sat on the edge of
          the screen and was half cut off by the home indicator. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 top-[2px] mx-auto h-0.5 w-8 rounded-full transition-colors',
          on ? 'bg-brand-bright' : 'bg-transparent',
        )}
      />
      <span className="relative grid h-8 place-items-center text-base">{children}</span>
      {label}
    </>
  )

  const look = cn(
    'relative flex w-full flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-bold transition-colors',
    on ? 'text-white' : 'text-white/45',
  )

  return to
    ? <NavLink to={to} end={end} className={look}>{inside}</NavLink>
    : <button type="button" onClick={onClick} className={look}>{inside}</button>
}

export function PhoneBar() {
  const { profile } = useAuth()
  const { openChat, chatOpen, chatUnread } = useChatDock()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-line bg-ink-raised/95 backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      <ul className="flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {mobileNav.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-bold transition-colors',
                  isActive ? 'text-white' : 'text-white/45',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-x-0 top-[2px] mx-auto h-0.5 w-8 rounded-full transition-colors',
                      isActive ? 'bg-brand-bright' : 'bg-transparent',
                    )}
                  />

                  <span className="relative grid h-8 place-items-center text-base">
                    {item.face && profile ? (
                      <Avatar
                        src={avatarOf(profile)}
                        personId={profile.id}
                        name={profile.display_name}
                        /* `sm` and not a size override: `cn` joins and does
                           not merge, so an `h-7` here beside the component's
                           own `h-6` is decided by whichever rule the
                           stylesheet happens to put last. */
                        size="sm"
                        className={cn(
                          'ring-2 transition-colors',
                          isActive ? 'ring-brand-bright' : 'ring-ink-line',
                        )}
                      />
                    ) : (
                      <Glyph
                        icon={item.icon}
                        name={item.ours}
                        className={isActive ? 'text-brand-bright' : undefined}
                      />
                    )}
                  </span>

                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}

        {/* The chat is not a route - it is the dock - so it is a button, and
            it is the one slot on the bar that carries a number. */}
        <li className="flex-1">
          <Slot on={chatOpen} label="Chat" onClick={openChat}>
            <Glyph
              icon={faComment}
              name="chatbubble"
              className={chatOpen ? 'text-brand-bright' : undefined}
            />
            {chatUnread > 0 && (
              <span className="absolute -right-2 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-danger px-1 text-[10px] font-extrabold text-white">
                {chatUnread > 9 ? '9+' : chatUnread}
              </span>
            )}
          </Slot>
        </li>
      </ul>
    </nav>
  )
}
