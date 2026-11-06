/*
 * The World page's shape, with nothing around it: the picture on the left,
 * everything you can do on the right, every section straight down the page.
 * No database and no Launcher, so the parts can be looked at as a whole.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import {
  faAward, faBagShopping, faCircleInfo, faEllipsis, faFlag, faPlay, faServer, faStar, faBell,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Button } from '@/components/ui/Button'
import { SidePanel, Fact } from '@/components/ui/SidePanel'
import { ServerList } from '@/components/worlds/ServerList'
import { WorldThings } from '@/components/worlds/WorldThings'
import { formatCount } from '@/lib/format'
import '@/index.css'

const person = (id: string, name: string) => ({
  id, username: name, display_name: name, avatar_url: null, avatar_changed_at: null,
})

const servers = [
  { id: 's1', capacity: 20, how_many: 7, people: [person('1', 'marri'), person('2', 'Staw'), person('3', 'builder'), person('4', 'quietone'), person('5', 'five'), person('6', 'six'), person('7', 'seven')] },
  { id: 's2', capacity: 12, how_many: 12, people: [person('8', 'eight'), person('9', 'nine')] },
  { id: 's3', capacity: 20, how_many: 2, people: [person('10', 'ten')] },
] as never[]

const badges = [
  { id: 'b1', name: 'First steps', icon_url: null, awarded_count: 1200 },
  { id: 'b2', name: 'Got to the top', icon_url: null, awarded_count: 42 },
  { id: 'b3', name: 'Never fell once', icon_url: null, awarded_count: 3 },
] as never[]

const passes = [
  { id: 'p1', name: 'Double jump', icon_url: null, price: 250, is_for_sale: true },
  { id: 'p2', name: 'A long gamepass name', icon_url: null, price: 0, is_for_sale: true },
] as never[]

function Section({ icon, title, count, children }: {
  icon: typeof faAward; title: string; count: number; children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 font-display text-lg font-extrabold">
        <Glyph icon={icon} className="text-sm text-muted" />
        {title}
        {count > 0 && <span className="text-sm font-bold text-muted">{formatCount(count)}</span>}
      </h2>
      {children}
    </section>
  )
}

function Demo() {
  return (
    <div className="min-h-screen bg-ink p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start gap-3 border-b border-ink-line pb-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-line bg-gradient-to-br from-brand to-brand-deep font-display text-2xl font-black">
            F
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="truncate font-display text-3xl font-extrabold leading-tight">First Ground</h1>
            <p className="mt-1 text-sm text-white/70">By <span className="font-bold text-white">Kobblon</span></p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-line text-white/70">
            <Glyph icon={faEllipsis} />
          </span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <div className="min-w-0 space-y-6">
            <div className="grid aspect-[16/9] place-items-center rounded-xl border border-ink-line bg-ink-card text-sm text-muted">
              The gallery
            </div>

            <SidePanel title="About this World">
              <p className="leading-relaxed text-white/75">
                The first thing the Kobblon Engine ever ran. A floor, some stairs, a gateway and
                somewhere to jump off.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-space/15 px-2.5 py-1 font-bold text-space">
                  <span className="h-1.5 w-1.5 rounded-full bg-space" />9 playing
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 font-semibold text-muted">Something else</span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 font-semibold text-muted">237 visits</span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-danger/80">
                  <Glyph icon={faFlag} className="text-[10px]" />Report Abuse
                </span>
              </div>
            </SidePanel>

            <Section icon={faAward} title="Badges" count={3}>
              <WorldThings kind="badges" badges={badges} mine={false} worldId="w1" />
            </Section>

            <Section icon={faBagShopping} title="Store" count={2}>
              <WorldThings kind="shop" passes={passes} mine={false} worldId="w1" />
            </Section>

            <Section icon={faServer} title="Servers" count={3}>
              <ServerList servers={servers} name="First Ground" onJoin={() => {}} />
            </Section>
          </div>

          <aside className="space-y-4">
            <Button size="lg" variant="enter" block>
              <Glyph icon={faPlay} />
              <span className="font-display text-lg font-extrabold">Play</span>
            </Button>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-line bg-ink-card px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-white/60">
                <Glyph icon={faStar} />6
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-white/60">
                <Glyph icon={faBell} />Notify
              </span>
              <span className="text-xs font-bold text-muted">19 / 1</span>
            </div>

            <SidePanel icon={faCircleInfo} title="Details">
              <dl>
                <Fact label="Playing now" value={<span className="text-space-bright">9</span>} />
                <Fact label="Visits" value="237" />
                <Fact label="Favourites" value="6" />
                <Fact label="Likes" value="19" />
                <Fact label="Genre" value="Something else" />
                <Fact label="Published" value="19 Sept" />
                <Fact label="Updated" value="3m ago" />
              </dl>
            </SidePanel>
          </aside>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Demo /></MemoryRouter>,
)
