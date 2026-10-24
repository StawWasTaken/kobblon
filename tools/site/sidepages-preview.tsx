/*
 * Support and Standing, on the chrome they moved onto.
 *
 * Both pages need an account, so the live routes send anybody signed out
 * back to the front page - and this container has no route to Supabase, so
 * there is no signing in here at all. Mounted with a session handed
 * straight to `AuthContext`, every call they make fails and they draw
 * their own error states, which is exactly the view worth looking at: the
 * frame, the bar, the foot, and whether anything underneath is doubled.
 *
 * It is not a substitute for seeing them with real tickets in them. It
 * proves the shell, and that is what changed.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthContext, type AuthValue } from '@/hooks/useAuth'
import Support from '@/pages/Support'
import Standing from '@/pages/Standing'
import '@/index.css'

const signedIn = {
  profile: {
    id: 'a', username: 'pixelhead', display_name: 'Pixelhead', avatar_url: null,
    is_guest: false,
  },
  session: { user: { id: 'a' } },
  loading: false,
} as unknown as AuthValue

function Page() {
  return (
    <div>
      <Support />
      <Standing />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <AuthContext.Provider value={signedIn}>
    <MemoryRouter>
      <ToastProvider>
        <Page />
      </ToastProvider>
    </MemoryRouter>
  </AuthContext.Provider>,
)
