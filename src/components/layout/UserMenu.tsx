import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faGear, faShieldHalved, faRightFromBracket, faScroll, faRightLeft, faUserPlus,
  faUserShield, faShirt,
  faHeadset, faComments,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { SwitchAccounts } from './SwitchAccounts'
import { Avatar } from '@/components/ui/Avatar'
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
 * because two of these is two places for "Log Out" to stop working.
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
    ...(profile && !profile.is_guest
      ? [
          { to: '/avatar', label: 'My Avatar', icon: faShirt },
          /*
           * Your forum profile, from anywhere.
           *
           * On an At Kobblon page this menu is the only thing that knows
           * who you are, and the forum's own shell only links to a profile
           * through a post - so somebody who had not posted yet had no way
           * to their own. It is the forum's address rather than the site's:
           * `/forum/u/<username>` is the page with the forum tags, the
           * forum bio and the button across to the Kobblon profile.
           */
          { to: `/forum/u/${profile.username}`, label: 'Forum profile', icon: faComments },
        ]
      : []),
    { to: '/settings', label: 'Settings', icon: faGear },
    ...(profile
      ? [
          { to: '/standing', label: 'Account standing', icon: faShieldHalved },
          { to: '/support', label: 'Support', icon: faHeadset },
          { label: 'Switch Accounts', icon: faRightLeft, onSelect: () => setSwitching(true) },
          { label: 'Log Out', icon: faRightFromBracket, onSelect: () => signOut() },
        ]
      : [{ to: '/policies', label: 'Policies', icon: faScroll }]),
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
          <Avatar src={profile.avatar_url} name={profile.display_name || profile.username} size="sm" />
        ) : (
          <Glyph icon={faGear} />
        )}
      </button>

      {open && (
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
      )}

      <SwitchAccounts open={switching} onClose={() => setSwitching(false)} />
    </div>
  )
}
