/*
 * The forum's composer and its renderer, side by side, with nothing around
 * them.
 *
 * Two jobs. The first is looking at the toolbar at all: the composer only
 * draws for somebody signed in, so the forum pages screenshot as the
 * signed-out card and the buttons never appear in a shot.
 *
 * The second is the duty that comes with owning a shared component - it has
 * to stand up outside the website. There is no router here beyond a
 * MemoryRouter, no AuthProvider, no session: just a context value handed
 * in. If either of these ever grows a hook that needs the site around it,
 * this page goes blank and says so, which is a better way to find out than
 * a panel going blank in the Workspace.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/ui/Toast'
import { Composer } from '@/components/forum/Composer'
import { Markup } from '@/components/forum/Markup'
import { AboutNav } from '@/components/layout/AboutNav'
import '@/index.css'

const session = {
  profile: { id: 'b', username: 'staw', display_name: 'Staw', avatar_url: null },
} as never

const written = [
  '## What the toolbar writes',
  '',
  'Every button here produces a mark that is **read back** and drawn, which',
  'is the only reason the toolbar is allowed to exist. *Italic*, ~~crossed',
  'out~~ and `inline code` all come back.',
  '',
  '> A quote, for when somebody is answering something said further up.',
  '',
  '- a list',
  '- of things',
  '',
  '1. and a numbered one',
  '2. for steps',
  '',
  '---',
  '',
  '```',
  'local door = script.Parent',
  'door.Touched:Connect(function() end)',
  '```',
  '',
  'And the thing that matters most: <script>alert(1)</script> is text.',
].join('\n')

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <AuthContext.Provider value={session}>
      <ToastProvider>
        {/* The At Kobblon bar as somebody signed in sees it: their own
            picture and the account menu where Log in and Sign up were. */}
        <AboutNav />
        <div className="min-h-dvh bg-ink p-8 pt-24 text-white">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-white/35">
                Writing it
              </p>
              <Composer
                placeholder="Everything you know about it. Screenshots help."
                action="Post it"
                withTitle={{ value: 'My door will not open when I touch it', onChange: () => {} }}
                onSend={async () => {}}
              />
            </div>
            <div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-white/35">
                Reading it back
              </p>
              <div className="rounded-2xl border border-white/10 bg-ink-card/40 p-5">
                <Markup body={written} />
              </div>
            </div>
          </div>
        </div>
      </ToastProvider>
    </AuthContext.Provider>
  </MemoryRouter>,
)
