/* Made-up rows for the preview harnesses, in one place so the two of them
 * cannot drift into two different ideas of what a World looks like.
 *
 * Nothing here is shipped: tools/ is outside the site's build.
 */
import { me } from './pages-auth-stub'

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
export const answers: Record<string, unknown> = {
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

  /* The console. Without a rank it redirects to the front page, which in a
     screenshot is indistinguishable from the console being broken. */
  my_staff_rank: 'superadmin',
  staff_overview: {
    reports_open: 7, appeals_open: 2, tickets_open: 4, screening: 11,
    people: 1284, worlds: 96, communities: 18,
    suspended: 3, closed: 1, warnings_week: 12,
  },

  my_worlds: worlds.slice(0, 5),
  quests_mine: [
    { id: 'q1', name: 'Play three Worlds', counted: 'worlds_played', goal: 3, done: 1, reward: 50, claimed: false },
    { id: 'q2', name: 'Make a friend', counted: 'friends_made', goal: 1, done: 1, reward: 100, claimed: false },
    { id: 'q3', name: 'An hour in a World', counted: 'world_time', goal: 60, done: 60, reward: 150, claimed: true },
  ],
}


export const rowsFor: Record<string, unknown[]> = {
  profiles: people,
  communities,
  worlds,
  avatar_items: items,
  friendships: [],
  pixel_transactions: [
    { id: 't1', amount: 150, kind: 'quest', note: 'An hour in a World', created_at: new Date().toISOString() },
    { id: 't2', amount: -450, kind: 'purchase', note: 'Builder Jacket', created_at: ago(1) },
    { id: 't3', amount: 50, kind: 'daily', note: 'Daily', created_at: ago(2) },
  ],
  mail: [
    {
      id: 'm1', kind: 'announcement', subject: 'Welcome to Kobblon',
      body: 'Everything you can put on an avatar is in the Catalog.',
      read_at: null, created_at: new Date().toISOString(),
    },
    {
      id: 'm2', kind: 'moderation', subject: 'A report you sent',
      body: 'Thank you. A moderator has looked at it.',
      read_at: ago(1), created_at: ago(1),
    },
  ],
  world_favourites: worlds.slice(2, 6).map((one) => ({ world_id: one.id, worlds: one })),
  conversations: [],
  messages: [],
  notifications: [],
  reports: [],
  tickets: [],
}
