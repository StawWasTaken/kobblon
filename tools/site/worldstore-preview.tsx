/* The store-page proposal, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { WorldStorePage } from '@/components/worlds/WorldStorePage'
import { DEFAULT_WORLD_THUMBNAIL } from '@/lib/worldart'
import '@/index.css'

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-dvh bg-ink">
      <WorldStorePage
        name="Rooftop Run"
        creator="berryhop"
        description="Six blocks, one roof, and nothing underneath. Race four other people across the skyline before the sirens catch up. Shortcuts are everywhere and most of them are a mistake."
        tags={['Obby', 'Race', 'Multiplayer', '2-8 players']}
        shots={[DEFAULT_WORLD_THUMBNAIL, DEFAULT_WORLD_THUMBNAIL, DEFAULT_WORLD_THUMBNAIL, DEFAULT_WORLD_THUMBNAIL]}
        playing={284}
        visits={91204}
        favourites={3120}
        updated={ago(30)}
        updatedNote={"Added the water tower route and fixed the ledge on block four that ate people.\nSirens are 20% slower on the first lap."}
        friends={[{ name: 'Malicia' }, { name: 'JohnDoe' }, { name: 'maker' }]}
        worldId="00000000-0000-0000-0000-000000000000"
        mine={false}
        likes={412}
        dislikes={64}
        badges={[
          { id: '1', content_id: 101, world_id: 'w', name: 'First Steps', description: 'Finish the first roof.', icon_url: null, is_enabled: true, awarded_count: 8120 },
          { id: '2', content_id: 102, world_id: 'w', name: 'Clean Run', description: 'A lap without falling.', icon_url: null, is_enabled: true, awarded_count: 940 },
          { id: '3', content_id: 103, world_id: 'w', name: 'No Falls', description: 'Three laps, no falls.', icon_url: null, is_enabled: true, awarded_count: 61 },
        ]}
        passes={[
          { id: '1', content_id: 201, world_id: 'w', name: 'Skyline Skin', description: 'The blue one.', icon_url: null, price: 150, is_for_sale: true },
          { id: '2', content_id: 202, world_id: 'w', name: 'Double Jump', description: 'One more jump, mid-air.', icon_url: null, price: 400, is_for_sale: true },
        ]}
        servers={[
          { id: 's1', capacity: 8, how_many: 7, people: [] },
          { id: 's2', capacity: 8, how_many: 4, people: [] },
          { id: 's3', capacity: 8, how_many: 1, people: [] },
        ]}
        inServers={{ s1: [{ id: 'malicia', username: 'malicia', display_name: 'Malicia', avatar_url: null, avatar_changed_at: null }, { id: 'johndoe', username: 'johndoe', display_name: 'JohnDoe', avatar_url: null, avatar_changed_at: null }] }}
      />
    </div>
  </MemoryRouter>,
)
