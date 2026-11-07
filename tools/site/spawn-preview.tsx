import { createRoot } from 'react-dom/client'
import { Icon } from '@/components/brand/Icon'
import '@/index.css'

/** The Spawn mark beside the ones it has to live next to. */
function Page() {
  return (
    <div className="flex items-end gap-6 bg-ink p-8 text-white">
      {(['spawn', 'part', 'world', 'truss'] as const).map((one) => (
        <figure key={one} className="m-0 text-center text-xs text-muted">
          <Icon name={`workspace/${one}`} className="h-12 w-12" />
          <figcaption className="mt-2">{one}</figcaption>
        </figure>
      ))}
      <figure className="m-0 text-center text-xs text-muted">
        <Icon name="workspace/spawn" className="h-5 w-5" />
        <figcaption className="mt-2">spawn 20</figcaption>
      </figure>
      <figure className="m-0 text-center text-xs text-brand-bright">
        <Icon name="workspace/spawn" className="h-12 w-12" />
        <figcaption className="mt-2 text-muted">on brand</figcaption>
      </figure>
      <figure className="m-0 rounded-xl bg-white p-2 text-center text-xs text-ink">
        <Icon name="workspace/spawn" className="h-12 w-12" />
        <figcaption className="mt-2">on white</figcaption>
      </figure>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
