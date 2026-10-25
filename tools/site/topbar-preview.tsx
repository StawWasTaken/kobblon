/*
 * The top bar, with the three things that open out of it.
 *
 * Staw asked for an arrow on each, and an arrow is the one thing that
 * cannot be checked by reading the code: it either points at the button it
 * came out of or it points between two of them, and which of those it is
 * depends on how wide the window is and which buttons are drawn. So this
 * mounts the real bar and the screenshots are taken with each panel open.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { setSupabaseClient } from '@/lib/supabase'
import { ToastProvider } from '@/components/ui/Toast'
import { AppTopbar } from '@/components/layout/AppTopbar'
import { me } from './pages-auth-stub'
import '@/index.css'

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

const notifications = [
  { id: 1, kind: 'friend_request', body: 'Marbles wants to be friends', link: '/friends',
    is_read: false, created_at: ago(0.01), actor_id: 'p2', actor_username: 'marbles',
    actor_display_name: 'Marbles', actor_avatar_url: null },
  { id: 2, kind: 'space_like', body: 'Nova liked Brick Rally', link: '/worlds/w0',
    is_read: false, created_at: ago(0.2), actor_id: 'p3', actor_username: 'nova',
    actor_display_name: 'Nova', actor_avatar_url: null },
  { id: 3, kind: 'system', body: 'Your World passed screening', link: null,
    is_read: true, created_at: ago(2), actor_id: null, actor_username: null,
    actor_display_name: null, actor_avatar_url: null },
]

const chain = (rows: unknown[]) => {
  const result = { data: rows, error: null }
  const builder: Record<string, unknown> = {
    then: (done: (value: unknown) => unknown) => Promise.resolve(result).then(done),
  }
  for (const key of ['select', 'eq', 'order', 'limit', 'in', 'is', 'or', 'not']) {
    builder[key] = () => builder
  }
  builder.maybeSingle = async () => ({ data: rows[0] ?? null, error: null })
  builder.single = async () => ({ data: rows[0] ?? null, error: null })
  return builder
}

setSupabaseClient({
  rpc: async (name: string) => ({
    data: name === 'unread_mail' ? 2
      : name === 'notification_list' ? notifications
      : name === 'house_account' ? null
      : null,
    error: null,
  }),
  from: (name: string) => chain(name === 'notifications' ? notifications : []),
  channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
  removeChannel: () => {},
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  auth: {
    getUser: async () => ({ data: { user: { id: me.id } }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
} as never)

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen bg-ink text-white">
        <AppTopbar onOpenNav={() => {}} />
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
