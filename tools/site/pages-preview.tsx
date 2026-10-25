/* The five redesigned pages, each mounted on its own with made-up rows.
 *
 * `?page=catalog|communities|discover|people|settings`. The client is swapped
 * for one that answers with fixtures, because an empty page proves it does
 * not throw and nothing at all about how it looks with things in it - which
 * is the mistake that shipped an Economy panel with no padding.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { setSupabaseClient } from '@/lib/supabase'
import { TextSizeProvider } from '@/hooks/useTextSize'
import { ToastProvider } from '@/components/ui/Toast'
import { me } from './pages-auth-stub'
import Catalog from '@/pages/Catalog'
import Communities from '@/pages/Communities'
import Discover from '@/pages/Discover'
import People from '@/pages/People'
import Settings from '@/pages/Settings'
import Inbox from '@/pages/Inbox'
import '@/index.css'

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

const NAMES = [
  'Pixel', 'Marbles', 'Tunnel Rat', 'Cloudline', 'Bricksmith', 'Nova',
  'Halfpipe', 'Greyhound', 'Sunset Club', 'Ironworks', 'Little Robot', 'Quarry',
]

const people = NAMES.map((name, i) => ({
  id: i === 0 ? me.id : `p${i}`,
  content_id: 1000 + i,
  username: name.toLowerCase().replace(/[^a-z]/g, ''),
  display_name: i === 0 ? me.display_name : name,
  avatar_url: null,
  bio: i % 3 === 0
    ? 'Building a racing World. Looking for people who can model cars.'
    : i % 3 === 1 ? 'Here for the hats.' : null,
  pixels: 100 * i,
  is_online: i % 3 !== 2,
  is_guest: false,
  is_verified: i < 3,
  has_staff_badge: i === 0,
  is_admin: i === 0,
  is_moderator: false,
  is_superadmin: i === 0,
  created_at: ago(i * 11),
  last_seen_at: i % 3 === 2 ? ago(2) : new Date().toISOString(),
  in_space_id: i === 4 ? 'w1' : null,
  activity: i === 5 ? 'building' : null,
  colour: null,
}))

const communities = [
  'Staw Fanclub', 'The Build Team', 'Hat Traders', 'Racers United',
  'Pixel Artists', 'Quiet Corner', 'Obby Masters', 'First Ground',
].map((name, i) => ({
  id: `c${i}`,
  content_id: 1300 + i,
  slug: name.toLowerCase().replace(/[^a-z]+/g, '-'),
  name,
  description: i % 3 === 0
    ? 'Everything about building on Kobblon: parts, scripts, and the people who know how they work. Ask anything.'
    : i % 3 === 1 ? 'A small one.' : '',
  icon_url: null,
  banner_url: null,
  member_count: 2400 - i * 280,
  is_public: true,
  is_verified: i < 2,
  created_at: ago(i * 9),
  owner_id: 'p1',
}))

const worlds = [
  'Brick Rally', 'Tower of Patience', 'Sunset Drive', 'The Quarry',
  'Little Robot Factory', 'Hide in the Hedges', 'Marble Run', 'Skate Park',
  'Deep Mine', 'Paint the Town', 'Cloud Hopper', 'Last One Standing',
].map((name, i) => ({
  id: `w${i}`,
  content_id: 2000 + i,
  name,
  description: 'A World somebody made.',
  thumbnail_url: null,
  cover_url: null,
  genre: i % 2 ? 'racing' : 'obby',
  visits: 48_000 - i * 3_100,
  likes: 900 - i * 60,
  playing_now: i < 4 ? 40 - i * 8 : 0,
  is_published: true,
  created_at: ago(i * 3),
  owner_id: 'p1',
  owner_username: 'pixel',
  owner_display_name: 'Pixel',
  owner_avatar_url: null,
  owner_is_verified: i < 3,
}))

const items = [
  'Midnight Crown', 'Pumpkin Head', 'Builder Jacket', 'Running Shoes',
  'Thin Glasses', 'Short Hair', 'Wide Smile', 'Steel Arm',
  'Racer Helmet', 'Paint Splatter Tee', 'Work Trousers', 'Winter Scarf',
  'Gold Chain', 'Flat Cap', 'Round Face',
].map((name, i) => ({
  id: `i${i}`,
  content_id: 40 + i,
  name,
  kind: ['shirt', 'trousers', 'hair', 'face', 'accessory'][i % 5],
  price: i === 2 ? 0 : 60 + i * 35,
  image_url: null,
  preview_url: null,
  owned: i === 1,
  taken_count: 400 - i * 18,
  sells_until: i === 0 ? new Date(Date.now() + 3 * 86_400_000).toISOString() : null,
  owner_id: 'p1',
  owner_username: i % 2 ? 'kobblon' : 'pixel',
  owner_display_name: i % 2 ? 'Kobblon' : 'Pixel',
  owner_is_verified: true,
  created_at: ago(i),
}))

/** What each read answers with. Anything unnamed answers with nothing. */
const answers: Record<string, unknown> = {
  world_genre_list: [
    { id: 'obby', label: 'Obstacle courses', position: 1 },
    { id: 'racing', label: 'Racing', position: 2 },
    { id: 'roleplay', label: 'Roleplay', position: 3 },
    { id: 'tycoon', label: 'Tycoons', position: 4 },
    { id: 'shooter', label: 'Shooters', position: 5 },
    { id: 'puzzle', label: 'Puzzles', position: 6 },
  ],
  world_list: worlds,
  member_communities: communities.slice(0, 3).map((one) => ({
    id: one.id, slug: one.slug, name: one.name, icon_url: null,
    member_count: one.member_count, content_id: one.content_id,
    role: 'member', is_primary: false,
  })),
  people_list: people.slice(1, 5).map((one) => ({ ...one, friendship_id: 'f1' })),
  avatar_shelf: items,
  outfit_shelf: [],
  sale_now: {
    percent_off: 20,
    ends_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    note: null,
  },
  recommended_avatar_items: items.slice(0, 12),
  username_history: [{ username: 'staw', changed_at: ago(90) }],
  standing_of: { headline: 'Nothing on record. Carry on.', level: 'clear' },
  pixel_transactions: [],
  pick_ad: null,
  my_appearances: [{ appearance: 'default' }],
}

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
    'lte', 'order', 'limit', 'range', 'contains', 'filter',
  ]) chain[key] = () => chain
  chain.maybeSingle = async () => ({ data: rows[0] ?? null, error: null })
  chain.single = async () => ({ data: rows[0] ?? null, error: null })
  return chain
}

/*
 * Post, for looking at the inbox with. Six letters because the list is
 * supposed to be scrolled and the kinds are supposed to be told apart at a
 * glance, and neither of those can be judged against one row.
 */
const mail = [
  { id: 6, kind: 'moderation', subject: 'A decision about something you posted',
    body: 'We took down the topic "read this" because it was advertising another site. '
      + 'Nothing else has happened to your account, and you can appeal this from your standing page.',
    link: '/standing', is_read: false, created_at: ago(0.02) },
  { id: 5, kind: 'security', subject: 'A new sign-in from a machine we have not seen',
    body: 'Somebody signed in to your account from Windows, in France. If that was you there '
      + 'is nothing to do. If it was not, change your password now.',
    link: '/settings', is_read: false, created_at: ago(0.3) },
  { id: 4, kind: 'support', subject: 'Re: my hat did not arrive',
    body: 'It had been bought twice in the same second and one of the two was refunded. '
      + 'The hat is on your account now and the Brix are back.',
    link: null, is_read: true, created_at: ago(1.2) },
  { id: 3, kind: 'money', subject: 'Your creator payout went through',
    body: 'Twelve thousand four hundred Brix from what people spent in your Worlds last month.',
    link: '/brix', is_read: true, created_at: ago(3) },
  { id: 2, kind: 'announcement', subject: 'Kobblon is three weeks old',
    body: 'Thank you for being here this early. The Workspace is out, Communities have '
      + 'funds, and the forum is open.',
    link: null, is_read: true, created_at: ago(8) },
  { id: 1, kind: 'policy', subject: 'The Terms have changed',
    body: 'Several Accounts are allowed now, and the wording about them has changed to say so.',
    link: '/policies/terms', is_read: true, created_at: ago(21) },
]

const rowsFor: Record<string, unknown[]> = {
  mail,
  profiles: people,
  communities,
  worlds,
  avatar_items: items,
  friendships: [],
  pixel_transactions: [],
}

setSupabaseClient({
  rpc: async (name: string) => ({ data: answers[name] ?? null, error: null }),
  from: (name: string) => table(rowsFor[name] ?? []),
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  auth: {
    getUser: async () => ({ data: { user: { id: me.id } }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    updateUser: async () => ({ data: null, error: null }),
  },
} as never)

const PAGES: Record<string, () => React.JSX.Element> = {
  catalog: Catalog,
  communities: Communities,
  discover: Discover,
  people: People,
  settings: Settings,
  inbox: Inbox,
}

const which = new URLSearchParams(location.search).get('page') ?? 'communities'
const Shown = PAGES[which] ?? Communities

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <TextSizeProvider>
    <ToastProvider>
      <div className="min-h-screen bg-ink text-white">
        <Shown />
      </div>
    </ToastProvider>
    </TextSizeProvider>
  </MemoryRouter>,
)
