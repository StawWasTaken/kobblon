/* The Economy page's charts, with made-up figures and nothing around them. */
import { createRoot } from 'react-dom/client'
import { LineGraph, BarRows } from '@/components/ui/Graph'
import '@/index.css'

const days = Array.from({ length: 30 }, (_, i) =>
  new Date(Date.now() - (29 - i) * 86_400_000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))

const wobble = (base: number, i: number) =>
  Math.round(base + Math.sin(i / 3) * base * 0.35 + (i % 5) * base * 0.08)

const minted = days.map((_, i) => wobble(42_000, i))
const burned = days.map((_, i) => wobble(31_000, i + 2))
const held = days.map((_, i) => 2_400_000 + i * 11_000)

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-6 bg-ink p-10 text-white">
    <div className="rounded-2xl border border-ink-line bg-ink-card p-5">
      <h3 className="mb-4 font-display text-lg font-extrabold">In and out</h3>
      <LineGraph
        labels={days}
        series={[
          { label: 'Made', values: minted, tone: 'text-space-bright' },
          { label: 'Spent', values: burned, tone: 'text-danger' },
        ]}
      />
    </div>

    <div className="rounded-2xl border border-ink-line bg-ink-card p-5">
      <h3 className="mb-4 font-display text-lg font-extrabold">Everything anybody holds</h3>
      <LineGraph
        labels={days}
        height={150}
        series={[{ label: 'Held', values: held, tone: 'text-brand-bright', summary: 'last' }]}
      />
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-ink-line bg-ink-card p-5">
        <h3 className="mb-4 font-display text-lg font-extrabold">Where it comes from</h3>
        <BarRows rows={[
          { label: 'Daily', value: 410_000, tone: 'bg-space', note: '· 8,120' },
          { label: 'Signing up', value: 230_000, tone: 'bg-space', note: '· 460' },
          { label: 'Sold something', value: 120_400, tone: 'bg-space', note: '· 1,902' },
          { label: 'Quests', value: 86_000, tone: 'bg-space', note: '· 1,120' },
        ]} />
      </div>
      <div className="rounded-2xl border border-ink-line bg-ink-card p-5">
        <h3 className="mb-4 font-display text-lg font-extrabold">Where it goes</h3>
        <BarRows rows={[
          { label: 'Bought something', value: 520_000, tone: 'bg-danger', note: '· 4,310' },
          { label: 'Ad budgets', value: 90_000, tone: 'bg-danger', note: '· 54' },
          { label: 'Name changes', value: 42_000, tone: 'bg-danger', note: '· 420' },
        ]} />
      </div>
    </div>
  </div>,
)
