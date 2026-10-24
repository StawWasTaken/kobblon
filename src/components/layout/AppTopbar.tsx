import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faBars, faBell, faEnvelope } from '@fortawesome/free-solid-svg-icons'
import { Wordmark } from '@/components/brand/Wordmark'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { NotificationsPanel } from '@/components/social/NotificationsPanel'
import { SearchBar } from './SearchBar'
import { UserMenu } from './UserMenu'
import { CurrencyBalance } from './CurrencyBalance'
import { topNav } from './nav'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { unreadMail } from '@/lib/api'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'
import { avatarOf } from '@/lib/avatars'
import { profileLink } from '@/lib/links'
import { Tooltip } from '@/components/ui/Tooltip'

export function AppTopbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { profile } = useAuth()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [post, setPost] = useState(0)

  useEffect(() => {
    if (!profile) return
    let active = true

    const count = async () => {
      const { count: n } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)
      if (active) setUnread(n ?? 0)
    }
    count()

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        count)
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [profile])

  /*
   * Post from Kobblon is counted separately from the bell on purpose. A
   * moderation decision is not an activity notification and must not queue
   * behind one.
   */
  useEffect(() => {
    if (!profile) return
    let active = true

    const count = async () => {
      const waiting = await unreadMail().catch(() => 0)
      if (active) setPost(waiting)
    }
    count()

    const channel = supabase
      .channel(`mail:${profile.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'mail', filter: `user_id=eq.${profile.id}` },
        count)
      .subscribe()

    window.addEventListener('kobblon:mail', count)

    return () => {
      active = false
      window.removeEventListener('kobblon:mail', count)
      supabase.removeChannel(channel)
    }
  }, [profile])

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14">
      {/* the brand sunburst runs the full width of the bar, sidebar included -
          in the dark, and only for the blue appearance; it is blue artwork */}
      <div className="absolute inset-0 -z-10 bg-chrome">
        <img
          src={asset('/brand/topbar.png')}
          alt=""
          aria-hidden="true"
          className="kob-sunburst h-full w-full object-cover object-center opacity-90"
        />
      </div>

      <div className="flex h-14 items-center gap-3 border-b-2 border-brand-ink/40 px-3 sm:gap-4 sm:px-4">
        {/*
          * The burger, then the mark.
          *
          * It sat at the right-hand end for a while, which read fine and
          * was wrong twice over: it was the furthest thing on the bar from
          * the thumb that opens it, and a tap at the very edge of a phone
          * screen is a tap the browser may take for a back gesture - which
          * is how pressing it ended up on a page saying nothing is here.
          * Staw: "i want u to put it left to the kobblon logomark".
          *
          * Forty pixels square rather than thirty-six. It is the one
          * control on the bar that a phone has to hit first time.
          *
          * And held off the edge rather than pulled into it. `-ml-1` put
          * its left side eight pixels from the screen, which is inside the
          * strip iOS reads as a back swipe: a tap there that slides a
          * couple of pixels is not a tap at all, it is the browser going
          * back, and back from here is whatever was before it - which is
          * how pressing the thing lands on the 404. Starting at twenty
          * pixels leaves the gesture its strip and the button its taps.
          */}
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          aria-haspopup="menu"
          className="ml-2 grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-lg text-onbrand/85 transition-colors hover:bg-onbrand/15 active:bg-onbrand/25 lg:hidden"
        >
          <Glyph icon={faBars} className="text-lg" />
        </button>

        <Wordmark to="/home" className="h-7 shrink-0" />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Sections">
          {topNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-1.5 text-sm font-bold transition-colors',
                  isActive ? 'bg-onbrand/20 text-onbrand' : 'text-onbrand/75 hover:bg-onbrand/10 hover:text-onbrand',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/*
         * `w-full` was the bug Staw photographed: the field asked for the
         * whole bar, the group of buttons to its right is `shrink-0`, and
         * the overflow went off the right-hand side - so the placeholder
         * read "Searc" and the clear button was past the edge of the
         * screen.
         *
         * `min-w-0 flex-1` asks for the room that is left instead, which is
         * the same thing on a laptop and the difference between a field and
         * a stump on a phone. The floor stops it collapsing to the two
         * glyphs it carries inside it.
         */}
        <SearchBar className="ml-auto min-w-0 flex-1 basis-32 max-w-xs sm:max-w-sm lg:ml-4 lg:max-w-md" />

        <div className="ml-auto flex shrink-0 items-center gap-1 pl-1">
          {profile ? (
            <>
              {!profile.is_guest && <CurrencyBalance amount={profile.pixels} />}

              <Tooltip label="Your profile" side="bottom">
                <Link
                  to={profileLink(profile)}
                  className="hidden items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-onbrand/15 sm:flex"
                >
                <Avatar src={avatarOf(profile)} personId={profile.id} name={profile.display_name} size="xs" />
                  <span className="max-w-24 truncate text-sm font-bold text-onbrand">
                    {profile.display_name}
                  </span>
                </Link>
              </Tooltip>

              <Tooltip label={post ? `${post} unread from Kobblon` : 'Your inbox'} side="bottom">
                <Link
                  to="/inbox"
                  aria-label={post ? `Inbox, ${post} unread` : 'Inbox'}
                  className="relative grid h-9 w-9 place-items-center rounded-lg text-onbrand/85 transition-colors hover:bg-onbrand/15"
                >
                  <Glyph icon={faEnvelope} />
                  {post > 0 && (
                    <span className="absolute right-0.5 top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-space px-1 text-[10px] font-bold text-onbrand">
                      {post > 9 ? '9+' : post}
                    </span>
                  )}
                </Link>
              </Tooltip>

              <Tooltip label={unread ? `${unread} unread` : 'Notifications'} side="bottom">
                <button
                onClick={() => setNotificationsOpen((v) => !v)}
                aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
                aria-expanded={notificationsOpen}
                className="relative grid h-9 w-9 place-items-center rounded-lg text-onbrand/85 transition-colors hover:bg-onbrand/15"
              >
                <Glyph icon={faBell} />
                {unread > 0 && (
                  <span className="absolute right-0.5 top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-space px-1 text-[10px] font-bold text-onbrand">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
                </button>
              </Tooltip>
            </>
          ) : (
            <Button size="sm" to="/signup">Sign Up</Button>
          )}

          {profile?.is_guest && (
            <Button size="sm" to="/signup" className="hidden sm:inline-flex">Make an account</Button>
          )}

          <UserMenu />
        </div>
      </div>

      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onReadAll={() => setUnread(0)}
      />
    </header>
  )
}
