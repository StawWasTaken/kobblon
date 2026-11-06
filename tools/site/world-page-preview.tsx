/*
 * The World page's new shape, with nothing around it: the World itself down
 * the middle and the standing facts down the side, so the two can be
 * weighed against each other without a database or a Launcher.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { WorldSide } from '@/components/worlds/WorldSide'
import { Card } from '@/components/ui/Card'
import '@/index.css'

const person = (id: string, name: string) => ({
  id, username: name, display_name: name, avatar_url: null, avatar_changed_at: null,
})

const servers = [
  {
    id: 's1', capacity: 20, how_many: 7,
    people: [person('1', 'marri'), person('2', 'Staw'), person('3', 'builder'), person('4', 'quietone'), person('5', 'five'), person('6', 'six'), person('7', 'seven')],
  },
  { id: 's2', capacity: 12, how_many: 12, people: [person('8', 'eight'), person('9', 'nine')] },
  { id: 's3', capacity: 20, how_many: 2, people: [person('10', 'ten')] },
] as never[]

const badges = [
  { id: 'b1', name: 'First steps', icon_url: null, awarded_count: 1200 },
  { id: 'b2', name: 'Got to the top', icon_url: null, awarded_count: 42 },
  { id: 'b3', name: 'Never fell once', icon_url: null, awarded_count: 3 },
  { id: 'b4', name: 'Stayed an hour', icon_url: null, awarded_count: 90 },
  { id: 'b5', name: 'Found the door', icon_url: null, awarded_count: 7 },
] as never[]

const passes = [
  { id: 'p1', name: 'Double jump', icon_url: null, price: 250, is_for_sale: true },
  { id: 'p2', name: 'A very long gamepass name that gets cut', icon_url: null, price: 0, is_for_sale: true },
  { id: 'p3', name: 'Not for sale', icon_url: null, price: 10, is_for_sale: false },
] as never[]

function Demo() {
  return (
    <div className="min-h-screen bg-ink p-8 text-white">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div className="min-w-0 space-y-8">
          <Card className="py-24 text-center text-sm text-muted">The gallery</Card>
          <Card className="py-10 text-center text-sm text-muted">About</Card>
        </div>

        <WorldSide
          servers={servers}
          badges={badges}
          passes={passes}
          counts={{ likes: 4120, dislikes: 90, favourites: 880 }}
          visits={1284000}
          genre="Obby"
          publishedAt={new Date(Date.now() - 90 * 864e5).toISOString()}
          updatedAt={new Date(Date.now() - 2 * 864e5).toISOString()}
          onJoin={(server) => console.log('join', server.id)}
          className="lg:sticky lg:top-6"
        />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Demo /></MemoryRouter>,
)
