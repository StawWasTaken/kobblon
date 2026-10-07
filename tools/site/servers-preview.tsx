/*
 * The server list and the "people also join" row, against stubbed answers.
 *
 * Not a second implementation: it imports the World page's own components.
 * Both of them are drawn entirely from what the database says is happening
 * right now, and this container cannot reach the database - so without this
 * page the only way to see either would be to put real people in a real
 * server and watch.
 *
 * It also mounts them with no provider and no router beyond a memory one,
 * which is the Workspace's situation. A component that needs a page around
 * it fails here rather than by taking a panel down over there.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ServerList } from '@/components/worlds/ServerList'
import { AlsoJoinedRow } from '@/components/worlds/AlsoJoinedRow'
import type { RunningServer, AlsoJoined } from '@/lib/api'
import '@/index.css'

const someone = (n: number) => ({
  id: `p${n}`,
  username: `player${n}`,
  display_name: ['Rye', 'Jem', 'Mo', 'Ast', 'Bell', 'Kit', 'Nev', 'Ola'][n % 8],
  avatar_url: null,
  avatar_changed_at: null,
})

/*
 * Three shapes that have to look right: a busy one that overflows into a
 * count, a nearly empty one, and a full one whose Join must be refused
 * rather than offered and then fail.
 */
const servers: RunningServer[] = [
  { id: 's1', capacity: 50, how_many: 9, people: Array.from({ length: 6 }, (_, i) => someone(i)) },
  { id: 's2', capacity: 50, how_many: 2, people: [someone(6), someone(7)] },
  { id: 's3', capacity: 8, how_many: 8, people: Array.from({ length: 6 }, (_, i) => someone(i + 2)) },
]

const also: AlsoJoined[] = [
  'crispy chicken', 'raspberry', 'Meatball', 'beans', 'watermelon!', 'squash',
].map((name, i) => ({
  id: `w${i}`,
  content_id: 1000 + i,
  slug: null,
  name,
  emblem_url: null,
  cover_url: null,
  creator_name: 'somebody',
  like_count: 40 + i * 3,
  dislike_count: 60 - i * 3,
  playing: [5, 0, 3, 13, 0, 8][i],
}))

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink p-8">
      <h1 className="text-xl font-bold text-ink-strong">Servers</h1>
      <ServerList servers={servers} name="First Ground" />

      <h1 className="mt-12 text-xl font-bold text-ink-strong">Nobody in it</h1>
      <ServerList servers={[]} name="First Ground" />

      <AlsoJoinedRow worlds={also} />
    </div>
  </MemoryRouter>,
)
