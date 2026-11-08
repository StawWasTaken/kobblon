/*
 * The World page's new shape, with nothing around it: the stage with the
 * name and the way in sitting on the art, the ribbon of numbers under it,
 * and the bands that follow - all without a database.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faPlay, faStar, faBell, faEllipsis, faServer, faAward, faBagShopping,
  faCompass,
} from '@fortawesome/free-solid-svg-icons'
import { WorldStage } from '@/components/worlds/WorldStage'
import { Band, Ribbon, Stat } from '@/components/ui/Band'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { RatingBar } from '@/components/worlds/RatingBar'
import { ServerList } from '@/components/worlds/ServerList'
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
] as never[]

function Demo() {
  return (
    <div className="min-h-screen bg-ink p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <WorldStage shots={[]} name="First Ground">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border-2 border-on-art/25 bg-gradient-to-br from-brand to-brand-deep font-display text-3xl font-black shadow-pop">
              F
            </div>

            <div className="min-w-0 flex-1">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-space/25 px-2.5 py-1 text-xs font-bold text-space-bright">
                <span className="h-1.5 w-1.5 rounded-full bg-space-bright" />
                143 playing now
              </span>
              <h1 className="font-display text-4xl font-black leading-tight text-on-art drop-shadow-lg">
                First Ground
              </h1>
              <p className="mt-1.5 text-sm text-on-art/75">
                By <span className="font-bold text-on-art">Kobblon</span>
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="w-72">
                <RatingBar likes={1900} dislikes={120} iLike iDislike={false} />
              </div>

              <div className="flex items-center gap-2">
                <Button size="lg" variant="enter" className="sm:px-10">
                  <Glyph icon={faPlay} />
                  <span className="font-display text-lg font-extrabold">Play</span>
                </Button>
                {[faStar, faBell, faEllipsis].map((icon, i) => (
                  <span
                    key={i}
                    className="grid h-12 w-12 place-items-center rounded-xl border border-on-art/20 bg-black/40 text-on-art/80 backdrop-blur-sm"
                  >
                    <Glyph icon={icon} on={i === 0} />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </WorldStage>

        <Ribbon className="mt-4">
          <Stat label="Playing" value="143" tone="live" />
          <Stat label="Visits" value="18.2K" />
          <Stat label="Saved" value="964" />
          <Stat label="Genre" value="Adventure" />
          <Stat label="Updated" value="2 days ago" />
          <Stat label="Published" value="7 months ago" />
        </Ribbon>

        <Tabs
          look="line"
          className="mt-8"
          value="Servers"
          onChange={() => {}}
          options={[
            { value: 'About', label: 'About' },
            { value: 'Servers', label: 'Servers', count: 4 },
            { value: 'Badges', label: 'Badges', count: 4 },
            { value: 'Store', label: 'Store', count: 2 },
          ]}
        />

        <div className="mt-6 space-y-8">
          <ServerList servers={servers} name="First Ground" onJoin={() => {}} onShare={() => {}} highlight="c9930a1b77" />

          <Band
            id="more"
            icon={faCompass}
            title="You might like"
            to="/discover"
            all="Discover"
          >
            <p className="text-sm text-muted">Eight Worlds would sit here.</p>
          </Band>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Demo /></MemoryRouter>,
)
