/*
 * The Creator Hub's front page, with nothing around it: the work down the
 * middle and the standing numbers down the side, so the two can be weighed
 * against each other without a database or a Workspace.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { faBoxOpen, faChartSimple, faShapes } from '@fortawesome/free-solid-svg-icons'
import { WorldWork } from '@/components/create/WorldWork'
import { SidePanel, Fact } from '@/components/ui/SidePanel'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCount } from '@/lib/format'
import '@/index.css'

const day = 864e5

const worlds = [
  {
    id: 'w1', name: 'Tower of Doom', cover_url: null, is_published: true,
    visit_count: 1284000, updated_at: new Date(Date.now() - 2 * day).toISOString(),
  },
  {
    id: 'w2', name: 'A rather long World name that has to be cut short somewhere',
    cover_url: null, is_published: false, visit_count: 0,
    updated_at: new Date(Date.now() - 20 * 60000).toISOString(),
  },
  {
    id: 'w3', name: 'Kobville', cover_url: null, is_published: true,
    visit_count: 940, updated_at: null,
  },
] as never[]

function Demo() {
  return (
    <div className="min-h-screen bg-ink p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Creator Hub</h1>
            <p className="mt-1.5 text-muted">
              Everything you have made, and everything you are allowed to build with.
            </p>
          </div>
          <Button>Upload</Button>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
          <div className="min-w-0 space-y-8">
            <section>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="font-display text-xl font-extrabold">What you are building</h2>
                <span className="ml-auto text-xs font-bold text-link">All my Worlds</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {worlds.map((world) => (
                  <WorldWork key={(world as { id: string }).id} world={world} onMissing={() => {}} />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="font-display text-xl font-extrabold">Latest uploads</h2>
                <span className="ml-auto text-xs font-bold text-link">All uploads</span>
              </div>
              <Card className="py-16 text-center text-sm text-muted">The upload list</Card>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <SidePanel icon={faChartSimple} title="The numbers" to="#" all="All of your numbers">
              <dl className="divide-y divide-ink-line">
                <Fact label="Worlds" value="3" />
                <Fact label="Visits to your Worlds" value={formatCount(1284940)} />
                <Fact label="Uploads" value="28" />
                <Fact label="Views of your content" value={formatCount(9120)} />
                <Fact label="Uses of your content" value={formatCount(340)} />
              </dl>
            </SidePanel>

            <SidePanel icon={faBoxOpen} title="Yours to build with" to="#" all="Open your inventory">
              <p className="font-display text-2xl font-extrabold tabular-nums">112</p>
              <p className="text-xs text-muted">
                Things you own, from the Marketplace and your own uploads.
              </p>
            </SidePanel>

            <SidePanel icon={faShapes} title="Need something" to="#" all="Open the Marketplace">
              <p className="text-xs leading-relaxed text-muted">
                Everything anybody on Kobblon has put up to be built with, free and paid.
              </p>
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
