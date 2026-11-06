/*
 * The top of Home - the "being played right now" board - and a shelf under
 * it, mounted with nothing around them.
 *
 * Home itself needs an account and a database, so the page it lives on
 * cannot be looked at in this container. The board can: it takes the
 * Worlds it draws as a prop, which is also what makes it safe for the
 * Workspace to mount later.
 *
 * Four cases, because the board has four shapes: the full five, a platform
 * with two published Worlds, one with exactly one, and one with none.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { TopNow } from '@/components/home/TopNow'
import { Shelf, WorldFeature } from '@/components/worlds/Shelf'
import type { World } from '@/types/db'
import '@/index.css'

const make = (n: number, over: Partial<World> = {}): World => ({
  id: `w${n}`,
  content_id: 1000 + n,
  slug: `world-${n}`,
  name: ['Kobblon Christmas Holidays', 'Tower of Trials', 'Brixworks', 'The Long Drive Home', 'Sword Duels'][n % 5],
  description: null,
  creator_name: 'Staw',
  cover_url: '/brand/landing-towers.webp',
  emblem_url: '/brand/logomark.png',
  runtime_version: 1,
  visit_count: [128_400, 41_200, 9_870, 3_140, 870][n % 5],
  like_count: [980, 410, 88, 31, 4][n % 5],
  dislike_count: [40, 25, 9, 11, 6][n % 5],
  published_at: '2026-11-01T00:00:00Z',
  ...over,
})

const five = [0, 1, 2, 3, 4].map((n) => make(n))

function Page() {
  return (
    <div className="mx-auto max-w-[86rem] space-y-12 p-6">
      {([
        ['The full board', five],
        ['Two published Worlds', five.slice(0, 2)],
        ['One, with nothing behind it', five.slice(0, 1)],
        ['A platform with none', []],
      ] as const).map(([title, worlds]) => (
        <section key={title}>
          <h2 className="mb-3 font-display text-sm font-extrabold uppercase tracking-wide text-muted">
            {title}
          </h2>
          <TopNow worlds={worlds as World[]} />
        </section>
      ))}

      <section>
        <h2 className="mb-3 font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          A shelf under it, and a shelf with nothing on it
        </h2>
        <Shelf title="New on Kobblon" more={{ to: '/discover', label: 'Discover' }}>
          {five.map((world) => <WorldFeature key={world.id} world={world} />)}
        </Shelf>
        <Shelf
          title="What people liked"
          empty={<p className="text-sm text-muted">Nobody has said yet.</p>}
        >
          {[]}
        </Shelf>
      </section>

      <section>
        <h2 className="mb-3 font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          A World with no cover and no mark, which is every World on its first day
        </h2>
        <TopNow worlds={[make(0, { cover_url: null, emblem_url: null }), make(1, { cover_url: null, emblem_url: null })]} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          Still loading
        </h2>
        <TopNow worlds={[]} loading />
      </section>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Page /></MemoryRouter>,
)
