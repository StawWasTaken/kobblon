/* The profile of an account that is gone, on its own. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '@/index.css'
import { GoneProfile } from '@/components/social/GoneProfile'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-dvh bg-ink px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-[68rem]">
        <GoneProfile handle="AccountDeleted4242" />
      </div>
    </div>
  </MemoryRouter>,
)
