import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { unreadMail } from '@/lib/api'
import { cn } from '@/lib/cn'
import { sideNav } from './nav'
import { profileLink } from '@/lib/links'
import { PersonAvatar } from '@/components/ui/PersonAvatar'

/** Pending friend requests waiting on an answer from this person. */
function useFriendRequestCount() {
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
function useMailCount() {
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
        {sideNav.map((item) => {
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
      </nav>

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
