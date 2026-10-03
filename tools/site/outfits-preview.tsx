/*
 * The outfit panels, with nothing around them.
 *
 * Both of them talk to the database, which this container cannot reach, so
 * what this shows is their empty state and their frame - which is the half
 * that can be got wrong without anybody noticing until somebody has saved
 * their first outfit.
 */
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { Outfits } from '@/components/avatar/Outfits'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen bg-ink p-8 text-white">
        <h2 className="mb-4 font-display text-lg">Outfits</h2>
        <Outfits onWear={() => {}} />
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
