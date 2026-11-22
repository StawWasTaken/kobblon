/* Badges and gamepasses on their own, so the popup can be looked at. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { MakeThings } from '@/components/worlds/MakeThings'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen bg-ink p-8">
        <div className="mx-auto max-w-3xl space-y-3">
          <MakeThings worldId="e0000000-0000-4000-8000-000000000001" kind="badge" />
          <MakeThings worldId="e0000000-0000-4000-8000-000000000001" kind="pass" />
        </div>
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
