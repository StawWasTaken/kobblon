import { createRoot } from 'react-dom/client'
import '@/index.css'

const Box = ({ label, cls }: { label: string; cls: string }) => (
  <div className="w-64">
    <div className={`${cls} bg-ink-card p-5`}>
      <p className="text-sm font-bold text-white">Pirate Bicorne</p>
      <p className="mt-1 text-xs text-muted">2 people have it</p>
    </div>
    <p className="mt-3 text-[11px] text-muted">{label}</p>
  </div>
)

createRoot(document.getElementById('root')!).render(
  <div className="flex flex-wrap gap-8 bg-ink p-10">
    <Box label="a  2px stroke only" cls="rounded-xl border-2 border-ink-line" />
    <Box label="b  dark lip under it" cls="rounded-xl border-2 border-ink-line shadow-card" />
    <Box label="c  thick bottom stroke, 4px" cls="rounded-xl border-2 border-b-4 border-ink-line" />
    <Box label="d  thick bottom, lighter" cls="rounded-xl border-2 border-b-4 border-ink-line border-b-[#6e7189]" />
    <Box label="e  thick bottom, 6px" cls="rounded-xl border-2 border-b-[6px] border-ink-line" />
  </div>,
)
