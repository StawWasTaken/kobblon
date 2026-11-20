/* The World page's window: the real gallery and the real panel, bare. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { WorldGallery } from '@/components/worlds/WorldStage'
import { WorldPanel } from '@/components/worlds/WorldPanel'
import { DEFAULT_WORLD_THUMBNAIL } from '@/lib/worldart'
import '@/index.css'

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const who = (name: string) => ({
  id: name, username: name.toLowerCase(), display_name: name,
  avatar_url: null, avatar_changed_at: null,
})

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-dvh bg-ink p-6">
      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <WorldGallery
          name="Rooftop Run"
          shots={[1, 2, 3, 4].map((i) => ({
            id: String(i), kind: 'image' as const, url: DEFAULT_WORLD_THUMBNAIL,
          }))}
        />
        <WorldPanel
          description={'Six blocks, one roof, and nothing underneath. Race four other people across the skyline before the sirens catch up. Shortcuts are everywhere and most of them are a mistake.'}
          likes={412}
          dislikes={64}
          opinion={null}
          canRate
          onLike={() => {}}
          onDislike={() => {}}
          onPlay={() => {}}
          favourited={false}
          onFavourite={() => {}}
          notify={false}
          onNotify={() => {}}
          signedIn
          mine={false}
          editTo="/create/worlds/1"
          onWorkspace={() => {}}
          onCopyLink={() => {}}
          onReport={() => {}}
          playingNow={284}
          visits={91204}
          favourites={3120}
          updatedAt={ago(30)}
          publishedAt={ago(900)}
          friendsHere={[who('Malicia'), who('JohnDoe'), who('maker')]}
        />
      </div>
    </div>
  </MemoryRouter>,
)
