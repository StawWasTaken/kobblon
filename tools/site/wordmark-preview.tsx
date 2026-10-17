/* The name, in both modes and every appearance, on the bar it sits on. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Wordmark } from '@/components/brand/Wordmark'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink p-8">
      {['default', 'halloween', 'christmas'].map((look) => (
        <div key={look} data-appearance={look} className="mb-4 flex h-16 items-center gap-6 rounded-xl bg-chrome px-6">
          <Wordmark to={null} always className="h-7" />
          <Wordmark to={null} className="h-7" />
          <span className="text-xs font-bold uppercase tracking-wide text-onchrome/70">{look}</span>
        </div>
      ))}
    </div>
  </MemoryRouter>,
)
