/*
 * The real At Kobblon pages with the reskin over them.
 *
 * Nothing about the pages is rewritten here: `About`, `Policies`,
 * `Support` and `Download` are imported from src and drawn exactly as
 * they ship. The only difference is `data-skin` on the root and
 * `skin.css`, so whatever you see here is a skin change and cannot be a
 * layout change.
 *
 * `?page=about|policies|support|download`, and the switch turns the skin
 * off so the same page can be compared against itself.
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/hooks/useTheme'
import { AuthContext, type AuthValue } from '@/hooks/useAuth'
import About from '@/pages/About'
import Policies from '@/pages/Policies'
import Support from '@/pages/Support'
import Download from '@/pages/Download'
import '@/index.css'
import './skin.css'

const PAGES: Record<string, { at: string; show: () => React.JSX.Element }> = {
  about: { at: '/about', show: About },
  policies: { at: '/policies', show: Policies },
  support: { at: '/support', show: Support },
  download: { at: '/download', show: Download },
}

const which = new URLSearchParams(location.search).get('page') ?? 'about'
const one = PAGES[which] ?? PAGES.about
const Shown = one.show
const out = { profile: null, session: null, loading: false } as unknown as AuthValue

function Preview() {
  const [skin, setSkin] = useState(true)
  useEffect(() => {
    if (skin) document.documentElement.setAttribute('data-skin', '')
    else document.documentElement.removeAttribute('data-skin')
  }, [skin])

  return (
    <MemoryRouter initialEntries={[one.at]}>
      <ThemeProvider>
        <AuthContext.Provider value={out}>
          <ToastProvider>
            <button
              onClick={() => setSkin((v) => !v)}
              className="fixed bottom-4 right-4 z-[200] rounded-full border-2 border-black bg-white px-4 py-2 text-sm font-extrabold text-black"
            >
              {skin ? 'skin on' : 'skin off'}
            </button>
            <Shown />
          </ToastProvider>
        </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>
  )
}

createRoot(document.getElementById('root')!).render(<Preview />)
