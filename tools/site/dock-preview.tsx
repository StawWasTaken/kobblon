/* The dock, mounted bare, to find what stops it drawing. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import { ChatDock } from '@/components/chat/ChatDock'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <AuthProvider>
    <div className="min-h-screen bg-ink p-8 text-white">
      <p className="text-sm text-muted">The dock should appear bottom right.</p>
      <ChatDock><span /></ChatDock>
    </div>
    </AuthProvider>
  </MemoryRouter>,
)
