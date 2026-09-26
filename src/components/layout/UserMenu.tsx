import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGear, faShieldHalved, faRightFromBracket, faScroll, faRightLeft, faUserPlus,
  faUserShield,
  faHeadset,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { SwitchAccounts } from './SwitchAccounts'
import { useAuth } from '@/hooks/useAuth'

type Item = { to?: string; label: string; icon: IconDefinition; onSelect?: () => void }

export function UserMenu() {
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
        className="grid h-9 w-9 place-items-center rounded-lg text-white/85 transition-colors hover:bg-white/15"
      >
        <FontAwesomeIcon icon={faGear} />
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
                <FontAwesomeIcon icon={item.icon} className="w-4" />
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                role="menuitem"
                onClick={() => { setOpen(false); item.onSelect?.() }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-white/80 transition-colors hover:bg-ink-hover hover:text-white"
              >
                <FontAwesomeIcon icon={item.icon} className="w-4" />
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
