/* Every page this harness can reach, inside the real chrome, at any width.
 *
 * `?page=<name>` picks one. The difference from `pages-preview` is that this
 * one mounts `AppShell` around it, so the topbar, the sidebar, the bottom
 * bar on a phone and the chat dock are all there - which is where half of
 * what breaks on a phone actually lives.
 *
 * Fixtures, and a signed-in fixture through the config's alias, because the
 * signed-out shape of a page is the one shape that cannot be compared with
 * what Staw sees.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { setSupabaseClient } from '@/lib/supabase'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/hooks/useTheme'
import { AppearanceProvider } from '@/hooks/useAppearance'
import { AppShell } from '@/components/layout/AppShell'
import { answers, rowsFor } from './phone-fixtures'
import Home from '@/pages/Home'
import Discover from '@/pages/Discover'
import People from '@/pages/People'
import Communities from '@/pages/Communities'
import Catalog from '@/pages/Catalog'
import Settings from '@/pages/Settings'
import Friends from '@/pages/Friends'
import Library from '@/pages/Library'
import Quests from '@/pages/Quests'
import Brix from '@/pages/Brix'
import Inbox from '@/pages/Inbox'
import Standing from '@/pages/Standing'
import Support from '@/pages/Support'
import MyAvatar from '@/pages/MyAvatar'
import Admin from '@/pages/Admin'
import CreateHub, { CreateOverview, CreateWorlds, CreateInventory } from '@/pages/CreateHub'
import '@/index.css'

/*
 * A table read, answering whatever the chain finally asks for. Every builder
 * returns itself so any order of `.eq().order().limit()` lands somewhere,
 * and awaiting the builder is what hands the rows over.
 */
const table = (rows: unknown[]) => {
  const result = { data: rows, error: null }
  const chain: Record<string, unknown> = {
    then: (done: (value: unknown) => unknown) => Promise.resolve(result).then(done),
  }
  for (const key of [
    'select', 'eq', 'neq', 'or', 'ilike', 'in', 'is', 'not', 'gt', 'gte', 'lt',
    'lte', 'order', 'limit', 'range', 'contains', 'filter', 'overlaps',
  ]) chain[key] = () => chain
  chain.maybeSingle = async () => ({ data: rows[0] ?? null, error: null })
  chain.single = async () => ({ data: rows[0] ?? null, error: null })
  return chain
}

setSupabaseClient({
  rpc: async (name: string) => ({ data: answers[name] ?? null, error: null }),
  from: (name: string) => table(rowsFor[name] ?? []),
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  /* `on` returns the channel itself, because the real one chains as many
     times as the caller likes and a stub two deep throws on the third. */
  channel: () => {
    const live: Record<string, unknown> = {
      subscribe: () => live,
      track: async () => {},
      untrack: async () => {},
      unsubscribe: async () => {},
      send: async () => {},
    }
    live.on = () => live
    return live
  },
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    updateUser: async () => ({ data: null, error: null }),
  },
} as never)

/** Each page, and the address it has to be at for its router bits to work. */
export const PAGES: Record<string, { at: string; show: () => React.JSX.Element }> = {
  home: { at: '/home', show: Home },
  discover: { at: '/discover', show: Discover },
  people: { at: '/people', show: People },
  communities: { at: '/communities', show: Communities },
  catalog: { at: '/catalog', show: Catalog },
  avatar: { at: '/avatar', show: MyAvatar },
  settings: { at: '/settings', show: Settings },
  friends: { at: '/friends', show: Friends },
  library: { at: '/library', show: Library },
  quests: { at: '/quests', show: Quests },
  brix: { at: '/brix', show: Brix },
  inbox: { at: '/inbox', show: Inbox },
  standing: { at: '/standing', show: Standing },
  support: { at: '/support', show: Support },
  staff: { at: '/staff', show: Admin },
}

const which = new URLSearchParams(location.search).get('page') ?? 'home'
const panel = new URLSearchParams(location.search).get('panel')
const one = PAGES[which] ?? PAGES.home
const Shown = one.show

/* The Create hub is a layout with children, so it is mounted as one. */
const creating = which.startsWith('create')

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <AppearanceProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[panel ? `${one.at}/${panel}` : one.at]}>
          <Routes>
            <Route element={<AppShell />}>
              {creating ? (
                <Route path="/create" element={<CreateHub />}>
                  <Route index element={<CreateOverview />} />
                  <Route path="worlds" element={<CreateWorlds />} />
                  <Route path="inventory" element={<CreateInventory />} />
                </Route>
              ) : (
                <Route path="*" element={<Shown />} />
              )}
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AppearanceProvider>
  </ThemeProvider>,
)
