/*
 * The new Discover, without a database.
 *
 * Discover itself cannot be looked at from this session - no database means
 * every route comes back as the maintenance page - so the page's own parts
 * are mounted here with made-up Worlds in them: the sticky bar, the two wide
 * lines, the square shelves and the grid, in the order the page puts them.
 * It is the layout that is being checked, not the queries.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { faFire, faSeedling, faHeart, faChartSimple } from '@fortawesome/free-solid-svg-icons'
import { Toolbar } from '@/components/ui/Toolbar'
import { Tabs } from '@/components/ui/Tabs'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Shelf, WorldTile, WorldFeature } from '@/components/worlds/Shelf'
import { WorldCard } from '@/components/worlds/WorldCard'
import type { World } from '@/types/db'
import '@/index.css'

const NAMES = [
  'First Ground', 'Gun Game', 'Tower of Hell', 'Brick Rally', 'Deep Mine',
  'Sky Parkour', 'Night Market', 'Red Sand', 'The Long Hall', 'Clock Tower',
  'Paper Boats', 'Snowline', 'Iron Quarry', 'Lantern Street', 'Blue Hour',
  'Last Train', 'Garden Floor', 'Rooftops',
]

const worlds: World[] = NAMES.map((name, i) => ({
  id: String(i), content_id: i + 1, slug: name.toLowerCase().replace(/\W+/g, '-'),
  name, creator_name: 'Staw', description: 'A World that somebody built in the Workspace.',
  emblem_url: null, cover_url: null,
  visit_count: 12000 - i * 431, like_count: 900 - i * 37, dislike_count: i,
} as unknown as World))

function Preview() {
  const [view, setView] = useState('charts')
  return (
    <div className="min-h-screen bg-ink px-6 text-white">
      <Toolbar className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Tabs
          label="What to see"
          value={view}
          onChange={setView}
          options={[
            { value: 'charts', label: 'Charts', icon: faChartSimple },
            { value: 'trending', label: 'Being played', icon: faFire },
            { value: 'new', label: 'Just published', icon: faSeedling },
            { value: 'popular', label: 'Most liked', icon: faHeart },
          ]}
          className="max-w-full overflow-x-auto kob-scroll"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select label="What kind of World" value="all" onChange={() => {}} className="w-40" align="right"
            options={[{ value: 'all', label: 'Every kind' }, { value: 'obby', label: 'Obby' }]} />
          <Select label="What you are playing on" value="any" onChange={() => {}} className="w-40" align="right"
            options={[{ value: 'any', label: 'Any device' }, { value: 'computer', label: 'Computer' }]} />
          <Select label="Where you would be playing" value="anywhere" onChange={() => {}} className="w-44" align="right"
            disabled options={[{ value: 'anywhere', label: 'No servers yet' }]} />
          <Button size="sm" variant="ghost">Clear</Button>
        </div>
      </Toolbar>

      {view === 'charts' ? (
        <div className="pt-5">
          <Shelf title="Featured" note="Top picks on Kobblon">
            {worlds.slice(0, 5).map((w) => <WorldFeature key={w.id} world={w} />)}
          </Shelf>
          <Shelf title="Being played" note="Busiest on Kobblon right now" more={{ onClick: () => {} }}>
            {worlds.map((w) => <WorldTile key={w.id} world={w} />)}
          </Shelf>
          <Shelf title="Just published" note="Straight out of the Workspace" more={{ onClick: () => {} }}>
            {worlds.slice().reverse().map((w) => <WorldTile key={w.id} world={w} />)}
          </Shelf>
          <Shelf title="Standout Worlds" note="Well liked, and given the room">
            {worlds.slice(5, 11).map((w) => <WorldFeature key={w.id} world={w} />)}
          </Shelf>
          <Shelf title="Most liked" note="What people came back and said" more={{ onClick: () => {} }}>
            {worlds.map((w) => <WorldTile key={w.id} world={w} />)}
          </Shelf>
          <Shelf title="Obby" note="Worlds of this kind, busiest first" more={{ onClick: () => {} }}>
            {worlds.slice(2).map((w) => <WorldTile key={w.id} world={w} />)}
          </Shelf>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pt-5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {worlds.map((w) => <WorldCard key={w.id} world={w} />)}
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Preview /></MemoryRouter>,
)
