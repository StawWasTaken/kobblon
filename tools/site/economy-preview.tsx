/* The staff console's Economy panel, mounted on its own.
 *
 * Signed out, so every read refuses and the panel draws its empty states -
 * which is the thing worth checking here: that it stands up without data
 * rather than throwing where nobody is watching. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { EconomySection } from '@/pages/Admin'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen bg-ink p-8 text-white">
        <EconomySection />
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
