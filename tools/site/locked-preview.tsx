/* The screen a suspended account sees, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@/hooks/useTheme'
import { AuthProvider } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/ui/Toast'
import { Locked } from '@/components/social/Locked'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter>
          <div className="min-h-screen bg-ink">
            <Locked />
          </div>
        </MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  </ThemeProvider>,
)
