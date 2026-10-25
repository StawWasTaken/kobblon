/* The foot of the page, which is where the version number lives. Both
 * shapes of it, because the compact one is what a signed-in page gets. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { SiteFooter } from '@/components/layout/SiteFooter'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink text-white">
      <SiteFooter />
      <SiteFooter compact />
    </div>
  </MemoryRouter>,
)
