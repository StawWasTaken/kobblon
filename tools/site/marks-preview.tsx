import { createRoot } from 'react-dom/client'
import { NameMark, type MarkName } from '@/components/brand/Verified'
import '@/index.css'

const all: MarkName[] = ['verified', 'staff', 'klub', 'guest']

const Row = ({ name, wears }: { name: string; wears: MarkName[] }) => (
  <div className="flex items-center gap-2 text-white">
    <span className="text-base font-semibold">{name}</span>
    <span className="inline-flex shrink-0 items-center gap-1 align-middle">
      {wears.map((w) => <NameMark key={w} which={w} />)}
    </span>
  </div>
)

createRoot(document.getElementById('root')!).render(
  <div className="flex flex-col gap-4 bg-ink p-8">
    {all.map((w) => <Row key={w} name={`somebody with ${w}`} wears={[w]} />)}
    <Row name="all four at once" wears={all} />
    <div className="flex items-center gap-2 text-2xl text-white">
      <span className="font-semibold">at a heading size</span>
      <span className="inline-flex gap-1">{all.map((w) => <NameMark key={w} which={w} />)}</span>
    </div>
  </div>,
)
