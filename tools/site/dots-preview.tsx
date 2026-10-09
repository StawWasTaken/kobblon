/* The dot at every size and state, with no mark inside it. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { StatusDot, type Presence } from '@/components/ui/StatusDot'
import '@/index.css'

const states: Presence[] = ['online', 'in-space', 'building', 'offline']

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink p-10 text-ink-strong">
      {(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const).map((size) => (
        <div key={size} className="mb-6 flex items-center gap-6">
          <span className="w-10 text-xs uppercase text-ink-soft">{size}</span>
          {states.map((p) => (
            <span key={p} className="flex items-center gap-2">
              <StatusDot presence={p} size={size} />
              <span className="text-xs text-ink-soft">{p}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  </MemoryRouter>,
)
