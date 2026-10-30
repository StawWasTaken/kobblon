import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faGear, faShieldHalved, faRightFromBracket, faRightLeft, faUserPlus,
  faUserShield, faHeadset, faRightToBracket,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { SwitchAccounts } from './SwitchAccounts'
import { Avatar } from '@/components/ui/Avatar'
import { Pointer } from '@/components/ui/Pointer'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'

type Item = { to?: string; label: string; icon: IconDefinition; onSelect?: () => void }

/**
 * The account menu, and the two things it hangs off.
 *
 * On the signed-in pages it is the gear in the bar, which is where it has
 * always been. On an At Kobblon page it is the person's own picture, in a
 * circle, in place of the Log in and Sign up buttons.
 *
 * Staw: "i want that onto the at kobblon pages instead of the login/signup
 * pages theres your profile picture (just pfp in a circle) and when u click
 * on it theres a menu (like when u click on settings in the logged in
 * pages)". It is the same menu rather than a second one that looks like it,
 * because two of these is two places for "Log out" to stop working.
 *
 * **Four rows and a sign-out, and that is the ceiling.** Staw, with a
 * screenshot of Roblox's beside ours: "the card lists are also very
 * confusing theres a lot of stuff while roblox' is way less confusing".
 * Ours had eight. What came out went somewhere it belongs rather than
 * nowhere: My Avatar is a row on the rail and a section of the top bar,
 * and your forum profile is on the forum's own rail, beside the other two
 * links about you.
 *
 * The rule that keeps it short: **this menu is the account, not the site.**
 * It is drawn on both halves of Kobblon, so anything in it that is a page
 * of one half is a page the other half is advertising. Settings, standing,
 * writing to us, switching, leaving - those are about the account wherever
 * you are standing.
 */
export function UserMenu({ trigger = 'gear' }: { trigger?: 'gear' | 'avatar' }) {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items: Item[] = [
    // A guest is one form away from keeping everything they have done, so the
    // way to do it sits at the top rather than buried on the front page.
    ...(profile?.is_guest
      ? [{ to: '/signup', label: 'Keep this account', icon: faUserPlus }]
      : []),
    // Staff first, because somebody opening this menu as staff is usually
    // opening it to go there. Everyone else never sees the line.
    ...(profile?.is_admin
      ? [{ to: '/staff', label: 'Staff', icon: faUserShield }]
      : []),
    ...(profile
      ? [
          { to: '/settings', label: 'Settings', icon: faGear },
          { to: '/standing', label: 'Account standing', icon: faShieldHalved },
          { to: '/support', label: 'Support', icon: faHeadset },
          { label: 'Switch Accounts', icon: faRightLeft, onSelect: () => setSwitching(true) },
          { label: 'Log out', icon: faRightFromBracket, onSelect: () => signOut() },
        ]
      : [
          /*
           * Signed out this is not an account menu, so it does not list
           * account pages. Settings was in it, and Settings is behind
           * `RequireAuth` - a row that exists only to send somebody to the
           * login screen, in the one menu that is supposed to be short.
           */
          { to: '/login', label: 'Log in', icon: faRightToBracket },
          { to: '/signup', label: 'Make an account', icon: faUserPlus },
          { to: '/support', label: 'Support', icon: faHeadset },
        ]),
  ]

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          'grid place-items-center transition-colors',
          trigger === 'avatar'
            ? 'h-9 w-9 rounded-full ring-2 ring-white/15 hover:ring-brand-bright'
            : 'h-9 w-9 rounded-lg text-white/85 hover:bg-white/15',
        )}
      >
        {trigger === 'avatar' && profile ? (
          <Avatar
            src={profile.avatar_url}
            name={profile.display_name || profile.username}
            personId={profile.id}
            changedAt={profile.avatar_changed_at}
            size="sm"
          />
        ) : (
          <Glyph icon={faGear} />
        )}
      </button>

      {open && (
        <>
        {/* The menu hangs off the right edge of a button that is itself
            `h-9 w-9`, so the middle of the gear is eighteen pixels in from
            that edge whichever trigger is drawn. Measured, not guessed. */}
        <Pointer className="right-[12px] top-full z-[51]" />

        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 animate-pop-in overflow-hidden rounded-lg border border-ink-line bg-ink-card py-1 shadow-pop"
        >
          {items.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-ink-hover hover:text-white"
              >
                <Glyph icon={item.icon} className="w-4" />
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                role="menuitem"
                onClick={() => { setOpen(false); item.onSelect?.() }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-white/80 transition-colors hover:bg-ink-hover hover:text-white"
              >
                <Glyph icon={item.icon} className="w-4" />
                {item.label}
              </button>
            ),
          )}
        </div>
        </>
      )}

      <SwitchAccounts open={switching} onClose={() => setSwitching(false)} />
    </div>
  )
}
