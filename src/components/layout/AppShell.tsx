import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Locked } from '@/components/social/Locked'
import { AppSidebar, SidebarContent } from './AppSidebar'
import { AppTopbar } from './AppTopbar'
import { PhoneBar } from './PhoneBar'
import { NoticeBar } from './NoticeBar'
import { SiteFooter } from './SiteFooter'
import { ChatDock } from '@/components/chat/ChatDock'
import { FriendRequestWatcher } from '@/components/social/FriendRequestToast'
import { GuestNudge } from '@/components/auth/GuestNudge'
import { SetPasswordCard } from '@/components/auth/SetPasswordCard'
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

  const letThrough = ['/standing', '/support', '/guidelines', '/policies', '/terms', '/privacy']
  const locked = !!profile?.is_suspended
    && !letThrough.some((one) => location.pathname.startsWith(one))


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
        {/*
          * Part of the bar rather than the top of the page: fixed directly
          * under it, so it stays there while the page moves. Everything
          * below starts under whatever height it is actually using, which
          * `NoticeBar` measures and writes into `--notice-height`.
          */}
        <NoticeBar />
        <AppSidebar />

        {navOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/70" onClick={() => setNavOpen(false)} aria-hidden="true" />
            <div className="absolute inset-y-0 left-0 w-60 animate-pop-in shadow-pop">
              <SidebarContent onNavigate={() => setNavOpen(false)} />
            </div>
          </div>
        )}

        <main
          id="main"
          /*
           * `pb-28` and not `pb-20`. The bar is 72px and the chat button
           * floats 80px up from the bottom, so at pb-20 the last row of a
           * page ended underneath that button - on People it was sitting on
           * somebody's Profile link.
           */
          className="pb-28 lg:pb-0 lg:pl-56"
          style={{ paddingTop: 'calc(3.5rem + var(--notice-height, 0px))' }}
        >
          {/* Pages put their own ad slots where they want them; this only
              makes sure two slots on one page do not land on one ad. */}
          <AdsProvider>
            {/*
              * A shut-out account sees the one screen that explains it,
              * wherever it was going. Decided from the row the profile
              * already carries, so nothing is asked on a load where nobody
              * is suspended - and the pages it does let through are the
              * ones a suspension must not close: the record and the appeal
              * on it, support, and the rules themselves.
              */}
            {locked ? <Locked /> : <Outlet />}
          </AdsProvider>

          {/*
            * Inside `main` rather than under it, so it sits inside the rail's
            * offset and the phone bar's clearance without knowing either
            * number. A foot that has to be told the sidebar is 14rem wide is
            * a foot that goes wrong the next time the sidebar changes.
            */}
          <SiteFooter compact className="mt-12" />
        </main>

        <PhoneBar />
      </div>

      {/* A friend request that arrives while you are doing something else. */}
      <FriendRequestWatcher />
      <GuestNudge />
      <SetPasswordCard />
    </ChatDock>
  )
}

/**
 * The column a page lives in. `width` rather than a class, because cn only
 * joins strings: passing max-w-5xl alongside the default left both in the
 * markup and the wider one won, which is how a page ended up wider than its
 * own header.
 *
 * **`narrow` is the default, and it is the site's width.** Staw drew the
 * edges of a profile on a screenshot and asked for that same column on
 * every page somebody is signed in to, which is what it already was on
 * roughly half of them: the other half ran to 86rem and nothing lined up
 * between the two. A page is read, not surveyed, and 68rem is about as wide
 * as a line of text stays readable at.
 *
 * `wide` is still here for a page that genuinely tiles - a grid that would
 * show two columns instead of four - and it has to be asked for.
 */
export const PAGE_WIDTH = {
  wide: 'max-w-[86rem]',
  narrow: 'max-w-[68rem]',
} as const

export function Page({
  children,
  className,
  width = 'narrow',
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
