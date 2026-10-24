import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { unreadMail } from '@/lib/api'
import { cn } from '@/lib/cn'
import { outNav, sideNav, topNav } from './nav'
import { profileLink } from '@/lib/links'
import { Button } from '@/components/ui/Button'
import { PersonAvatar } from '@/components/ui/PersonAvatar'

/** Pending friend requests waiting on an answer from this person. */
export function useFriendRequestCount() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!profile) return
    let active = true

    const load = async () => {
      const { count: n } = await supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('addressee_id', profile.id)
        .eq('status', 'pending')
      if (active) setCount(n ?? 0)
    }
    load()

    const channel = supabase
      .channel(`friendships:${profile.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${profile.id}` },
        load)
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [profile])

  return count
}

/** Unread post from Kobblon, which is counted apart from the bell. */
export function useMailCount() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!profile) return
    let active = true

    const load = async () => {
      const waiting = await unreadMail().catch(() => 0)
      if (active) setCount(waiting)
    }
    load()

    const channel = supabase
      .channel(`sidebar-mail:${profile.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'mail', filter: `user_id=eq.${profile.id}` },
        load)
      .subscribe()

    window.addEventListener('kobblon:mail', load)

    return () => {
      active = false
      window.removeEventListener('kobblon:mail', load)
      supabase.removeChannel(channel)
    }
  }, [profile])

  return count
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile } = useAuth()
  const requests = useFriendRequestCount()
  const post = useMailCount()

  return (
    <div className="flex h-full flex-col border-r border-onbrand/10 bg-chrome">
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-3 pt-4 kob-scroll" aria-label="Main">
        {/*
          * Without an account, the rows that need one are not drawn. What
          * is left is what a visitor can actually open, and the foot of
          * the rail offers the account instead of pretending they have
          * one.
          */}
        {sideNav.filter((item) => profile || !item.needsAccount).map((item) => {
          // Profile only makes sense once we know whose it is.
          const to = item.to === '/profile'
            ? (profile ? profileLink(profile) : '/login')
            : item.to
          const badge = item.badge === 'friends' ? requests
            : item.badge === 'mail' ? post
            : 0

          return (
            <NavLink
              key={item.to}
              to={to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-bold transition-colors',
                  isActive
                    ? 'bg-pick text-pick-on'
                    : 'text-onbrand/75 hover:bg-onbrand/10 hover:text-onbrand',
                )
              }
            >
              <Glyph icon={item.icon} name={item.ours} className="w-5 text-[15px]" />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-onbrand px-1.5 text-[11px] font-extrabold text-brand-deep">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </NavLink>
          )
        })}

        {/*
          * The sections bar lives across the top and is hidden on a phone,
          * so without this the drawer is half a menu there: Communities and
          * the Catalog had no way in at all on a phone that was not the
          * search field. It is a second group rather than more rows, because
          * the rail is yours and these are the platform's, and running them
          * together is how the two menus stopped meaning anything distinct.
          */}
        <p className="px-3.5 pb-1 pt-4 font-display text-[10px] font-extrabold uppercase tracking-[0.2em] text-onbrand/40 lg:hidden">
          Browse
        </p>
        <div className="space-y-1.5 lg:hidden">
          {topNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-bold transition-colors',
                  isActive
                    ? 'bg-pick text-pick-on'
                    : 'text-onbrand/75 hover:bg-onbrand/10 hover:text-onbrand',
                )
              }
            >
              <Glyph icon={item.icon} name={item.ours} className="w-5 text-[15px]" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
        </div>

        <p className="px-3.5 pb-1 pt-5 font-display text-[10px] font-extrabold uppercase tracking-[0.2em] text-onbrand/40">
          At Kobblon
        </p>
        <div className="space-y-0.5">
          {outNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3.5 rounded-xl px-3.5 py-2 text-[13px] font-bold transition-colors',
                  isActive
                    ? 'bg-onbrand/15 text-onbrand'
                    : 'text-onbrand/55 hover:bg-onbrand/10 hover:text-onbrand',
                )
              }
            >
              <Glyph icon={item.icon} className="w-5 text-[13px]" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {!profile && (
        /*
          * The way in, at the foot of the rail where the person's own card
          * sits once there is one. A visitor used to get a rail of five
          * rows that each threw them at this screen; now it is offered
          * once, as itself.
          */
        <div className="border-t border-onbrand/10 p-3">
          <Button to="/signup" variant="yes" className="w-full" onClick={onNavigate}>
            Make an account
          </Button>
          <Button to="/login" variant="ghost" className="mt-2 w-full" onClick={onNavigate}>
            Log in
          </Button>
        </div>
      )}

      {profile && (
        <NavLink
          to={profileLink(profile)}
          onClick={onNavigate}
          className="flex items-center gap-3 border-t border-onbrand/10 p-3 transition-colors hover:bg-onbrand/10"
        >
          <span className="relative">
            <PersonAvatar person={profile} size="sm" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-onbrand">{profile.display_name}</span>
            <span className="block truncate text-xs text-onbrand/50">@{profile.username}</span>
          </span>
        </NavLink>
      )}
    </div>
  )
}

export function AppSidebar() {
  return (
    <aside
      className="fixed bottom-0 left-0 top-14 z-40 hidden w-56 lg:block"
      aria-label="Sidebar"
    >
      <SidebarContent />
    </aside>
  )
}
