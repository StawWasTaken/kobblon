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
        badges={[
          { id: '1', name: 'First Steps', held: true },
          { id: '2', name: 'Clean Run', held: true },
          { id: '3', name: 'No Falls' },
        ]}
        passes={[
          { id: '1', name: 'Skyline Skin', price: 150 },
          { id: '2', name: 'Double Jump', price: 400 },
        ]}
        reviews={[
          {
            id: '1', who: 'Malicia', liked: true, seconds: 61 * 3600, at: ago(20),
            body: 'The water tower route is the best thing added to this all year. Took me nine goes and I would do it again.',
          },
          {
            id: '2', who: 'JohnDoe', liked: true, seconds: 4 * 3600, at: ago(70),
            body: 'Good with friends, pointless alone. Get three people in a party first.',
          },
          {
            id: '3', who: 'stranger', liked: false, seconds: 25 * 60, at: ago(190),
            body: 'Sirens are unfair on the first lap.',
          },
        ]}
      />
    </div>
  </MemoryRouter>,
)
