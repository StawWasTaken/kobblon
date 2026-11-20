/* The clip card and the shelf it sits on, with nothing around them. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ClipShelf } from '@/components/clips/ClipCard'
import { DEFAULT_WORLD_THUMBNAIL } from '@/lib/worldart'
import type { Clip } from '@/lib/api'
import '@/index.css'

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

const one = (over: Partial<Clip>): Clip => ({
  id: String(Math.random()), content_id: 41, title: 'Nine goes at the water tower',
  path: '', poster_path: 'x', seconds: 28, privacy: 'everyone', view_count: 1204,
  created_at: ago(5), owner_id: 'a', owner_username: 'berryhop',
  owner_display_name: 'berryhop', owner_avatar_url: null,
  world_id: 'w', world_name: 'Rooftop Run', world_slug: 'rooftop-run', world_content_id: 12,
  ...over,
})

const clips: Clip[] = [
  one({}),
  one({ title: 'This should not have worked', seconds: 9, view_count: 88, created_at: ago(30) }),
  one({ title: 'Only for mates', privacy: 'friends', seconds: 44, view_count: 12, created_at: ago(50) }),
  one({ title: null, poster_path: null, seconds: 60, view_count: 3, world_name: null, world_content_id: null }),
]

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-dvh bg-ink p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-4 font-display text-xl font-extrabold">Clips</h1>
        <ClipShelf clips={clips} posterOf={(c) => (c.poster_path ? DEFAULT_WORLD_THUMBNAIL : null)} />
      </div>
    </div>
  </MemoryRouter>,
)
