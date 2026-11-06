/*
 * The three places a World somebody is in gets said: the panel on a
 * profile, the hover card behind a face, and the line under a name in a
 * friends list. Seeded into the presence store rather than fetched, so this
 * page draws with no database behind it.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { ActivityLine } from '@/components/social/Whereabouts'
import { PersonFace, PersonCard } from '@/components/social/PersonCard'
import { learnWhereabouts } from '@/hooks/usePresenceStore'
import '@/index.css'

const person = (n: number) => ({
  id: `p${n}`, username: `player${n}`, display_name: `Player ${n}`,
  avatar_url: null, avatar_changed_at: null, is_online: true,
})

const staw = { id: 'p1', username: 'stawrer', display_name: 'staw', avatar_url: null, avatar_changed_at: null, is_online: true }

learnWhereabouts(['p1', 'p2', 'p3'], [
  {
    user_id: 'p1', world_id: 'w1', world_name: 'First Ground', world_content_id: 1234,
    world_cover: null, server_id: 's1', how_many: 1, capacity: 50, since: new Date().toISOString(),
  },
  {
    user_id: 'p2', world_id: 'w2', world_name: 'Rate My Avatar 2', world_content_id: 99,
    world_cover: null, server_id: 's2', how_many: 35, capacity: 35, since: new Date().toISOString(),
  },
])

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen bg-ink p-8 text-white">
        <div className="mx-auto max-w-4xl space-y-10">
          <section className="space-y-3">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-muted">On a profile, under the buttons</h2>
            <div className="flex justify-end">
              <ActivityLine person={staw} className="w-full sm:w-80" />
            </div>
            <div className="flex justify-end">
              <ActivityLine person={person(2)} className="w-full sm:w-80" />
            </div>
            <div className="flex justify-end">
              <ActivityLine person={staw} isMe className="w-full sm:w-80" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-muted">Faces, with and without a World</h2>
            <div className="grid grid-cols-4 gap-2">
              {[staw, person(2), person(3), person(4)].map((who) => (
                <PersonFace key={who.id} person={who} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-muted">Cards</h2>
            <ul className="grid grid-cols-2 gap-3">
              <PersonCard person={staw} friend />
              <PersonCard person={person(4)} friend />
            </ul>
          </section>
        </div>
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
