import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AppSidebar, SidebarContent } from './AppSidebar'
import { AppTopbar } from './AppTopbar'
import { ChatDock } from '@/components/chat/ChatDock'
import { FriendRequestWatcher } from '@/components/social/FriendRequestToast'
import { mobileNav } from './nav'
import { cn } from '@/lib/cn'
import { AdsProvider } from '@/components/ads/AdBanner'
import { usePresence, useMyActivity, useMySpace } from '@/hooks/usePresence'
import { usePresenceChannel } from '@/hooks/usePresenceStore'
import { useAuth } from '@/hooks/useAuth'

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()
  const { session, profile } = useAuth()

  // The dots on everybody's picture are only worth anything if the page
  // keeps saying that its person is here: once a minute into the row, for
  // anybody who looks later, and continuously into the channel, for anybody
  // looking now.
  usePresence(!!session)

  const doing = useMyActivity()
  const inSpace = useMySpace()
  usePresenceChannel(profile?.id, doing, inSpace)

  useEffect(() => { setNavOpen(false) }, [location.pathname])


  return (
    <ChatDock>
      <div className="min-h-dvh bg-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
        >
          Skip to content
        </a>

        <AppTopbar onOpenNav={() => setNavOpen(true)} />
        <AppSidebar />

        {navOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/70" onClick={() => setNavOpen(false)} aria-hidden="true" />
            <div className="absolute inset-y-0 left-0 w-60 animate-pop-in shadow-pop">
              <SidebarContent onNavigate={() => setNavOpen(false)} />
            </div>
          </div>
        )}

        <main id="main" className="pb-20 pt-14 lg:pb-0 lg:pl-56">
          {/* Pages put their own ad slots where they want them; this only
              makes sure two slots on one page do not land on one ad. */}
          <AdsProvider>
            <Outlet />
          </AdsProvider>
        </main>

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
                      'flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-colors',
                      isActive ? 'text-white' : 'text-white/50',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'grid h-7 w-12 place-items-center rounded-lg text-base transition-colors',
                          isActive && 'bg-brand text-white',
                        )}
                      >
                        <FontAwesomeIcon icon={item.icon} />
                      </span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* A friend request that arrives while you are doing something else. */}
      <FriendRequestWatcher />
    </ChatDock>
  )
}

/**
 * The column a page lives in. `width` rather than a class, because cn only
 * joins strings: passing max-w-5xl alongside the default left both in the
 * markup and the wider one won, which is how a page ended up wider than its
 * own header.
 */
export const PAGE_WIDTH = {
  wide: 'max-w-[86rem]',
  narrow: 'max-w-[68rem]',
} as const

export function Page({
  children,
  className,
  width = 'wide',
  style,
}: {
  children: React.ReactNode
  className?: string
  width?: keyof typeof PAGE_WIDTH
  /** For a page that carries somebody's own colour. */
  style?: React.CSSProperties
}) {
  return (
    <div
      className={cn('mx-auto w-full px-4 py-6 sm:px-6', PAGE_WIDTH[width], className)}
      style={style}
    >
      {children}
    </div>
  )
}
