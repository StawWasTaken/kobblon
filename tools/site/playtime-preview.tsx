/* The hours block, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Playtime } from '@/components/profile/Playtime'
import '@/index.css'

const worlds = [
  { world_id: '1', content_id: 12, name: 'Rooftop Run', slug: 'rooftop-run', cover_url: null, creator_username: 'maker', seconds: 61 * 3600 + 900, last_at: '' },
  { world_id: '2', content_id: 13, name: 'The Long Dark Hallway', slug: 'hall', cover_url: null, creator_username: 'maker', seconds: 22 * 3600, last_at: '' },
  { world_id: '3', content_id: 14, name: 'Brix Factory', slug: 'brix', cover_url: null, creator_username: 'maker', seconds: 4 * 3600 + 1800, last_at: '' },
  { world_id: '4', content_id: 15, name: 'Sunday Lobby', slug: 'lobby', cover_url: null, creator_username: 'maker', seconds: 40 * 60, last_at: '' },
]

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-dvh bg-ink p-8">
      <div className="mx-auto max-w-sm">
        <Playtime worlds={worlds} total={88 * 3600 + 900} score={340} />
      </div>
    </div>
  </MemoryRouter>,
)
