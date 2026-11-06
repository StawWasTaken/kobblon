/*
 * The Servers tab with nothing around it: friends in their own section,
 * the sort, the full-server tickbox and the two refresh buttons. Drawn
 * twice - with a friend in a room and with none - because the two
 * sections have to read as the same kind of thing either way.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ServersTab } from '@/components/worlds/ServersTab'
import '@/index.css'

const faces = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({
  id: `p${from + i}`, username: `player${from + i}`,
  display_name: `Player ${from + i}`, avatar_url: null, avatar_changed_at: null,
}))

const servers = [
  { id: 'a11d4f3a9c', capacity: 35, how_many: 24, people: faces(7) },
  { id: 'b72c01ee45', capacity: 12, how_many: 12, people: faces(5, 20) },
  { id: 'c9930a1b77', capacity: 12, how_many: 2, people: faces(2, 40) },
  { id: 'd4410bc802', capacity: 12, how_many: 0, people: [] },
  { id: 'e8820ff311', capacity: 35, how_many: 18, people: faces(6, 60) },
] as never[]

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-16">
        <ServersTab
          servers={servers}
          friends={{ a11d4f3a9c: faces(2, 100) } as never}
          name="First Ground"
          signedIn
          onRefresh={() => {}}
          onJoin={() => {}}
          onShare={() => {}}
        />

        <ServersTab
          servers={[servers[2]] as never[]}
          friends={{}}
          name="First Ground"
          signedIn
          onRefresh={() => {}}
          onJoin={() => {}}
          onShare={() => {}}
        />
      </div>
    </div>
  </MemoryRouter>,
)
