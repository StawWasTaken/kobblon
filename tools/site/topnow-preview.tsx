/*
 * The top of Home, with the lead rectangle capped at the width of the one
 * on Discover. Mounted on its own because Home needs a database and this
 * only needs four Worlds.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { TopNow } from '@/components/home/TopNow'
import type { World } from '@/types/db'
import '@/index.css'

const worlds: World[] = ['First Ground', 'Gun Game', 'Tower of Hell', 'Brick Rally', 'Deep Mine']
  .map((name, i) => ({
    id: String(i), content_id: i + 1, slug: String(i), name, creator_name: 'Staw',
    emblem_url: null, cover_url: null,
    visit_count: 9000 - i * 500, like_count: 400 - i * 20, dislike_count: i,
  } as unknown as World))

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink p-6 text-white">
      <TopNow worlds={worlds} />
    </div>
  </MemoryRouter>,
)
