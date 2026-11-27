/*
 * The At Kobblon pages, each on its own, with no route to Supabase.
 *
 * `?page=about|safety|players|economy|policies|download|stock`. They draw
 * their own error states where they need data, which is the view worth
 * looking at anyway: this is about the frame, the words and how corporate
 * the whole thing reads.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/hooks/useTheme'
import { AuthContext, type AuthValue } from '@/hooks/useAuth'
import About from '@/pages/About'
import Safety from '@/pages/inside/Safety'
import Players from '@/pages/inside/Players'
import Economy from '@/pages/inside/Economy'
import Policies from '@/pages/Policies'
import Download from '@/pages/Download'

import '@/index.css'

const out = { profile: null, session: null, loading: false } as unknown as AuthValue

const PAGES: Record<string, { at: string; show: () => React.JSX.Element }> = {
  about: { at: '/about', show: About },
  safety: { at: '/about/safety', show: Safety },
  players: { at: '/about/players', show: Players },
  economy: { at: '/about/economy', show: Economy },
  policies: { at: '/policies', show: Policies },
  download: { at: '/download', show: Download },

}

const which = new URLSearchParams(location.search).get('page') ?? 'about'
const one = PAGES[which] ?? PAGES.about
const Shown = one.show

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <ToastProvider>
      <AuthContext.Provider value={out}>
        <MemoryRouter initialEntries={[one.at]}>
          <Shown />
        </MemoryRouter>
      </AuthContext.Provider>
    </ToastProvider>
  </ThemeProvider>,
)
