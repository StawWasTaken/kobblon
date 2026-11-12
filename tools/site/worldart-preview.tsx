/*
 * What a World with no emblem and no cover looks like now.
 *
 * Every one of these used to be a different kind of nothing: a torn square
 * here, a grey cube glyph there, an empty tile on the chart. This mounts the
 * four shapes side by side with the pictures deliberately missing, so the
 * default emblem and the default thumbnail can be looked at together.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { WorldCard } from '@/components/worlds/WorldCard'
import { WorldTile, WorldFeature } from '@/components/worlds/Shelf'
import type { World } from '@/types/db'
import '@/index.css'

const broken = {
  id: '2', content_id: 8, slug: 'gun-game', name: 'Gun Game',
  creator_name: 'Staw', description: 'A World whose picture will not load.',
  emblem_url: 'https://example.invalid/gone.png',
  cover_url: 'https://example.invalid/gone.png',
  visit_count: 12, like_count: 1, dislike_count: 0,
} as unknown as World

const bare = {
  id: '1', content_id: 7, slug: 'first-ground', name: 'First Ground',
  creator_name: 'Staw', description: 'A World nobody has decorated yet.',
  emblem_url: null, cover_url: null, visit_count: 1240, like_count: 9, dislike_count: 1,
} as unknown as World

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink p-8 text-white">
      <div className="flex flex-wrap items-start gap-8">
        <WorldCard world={bare} className="w-72" />
        <WorldTile world={bare} />
        <WorldFeature world={bare} />
        <WorldCard world={broken} className="w-72" />
        <WorldTile world={broken} />
      </div>
    </div>
  </MemoryRouter>,
)
