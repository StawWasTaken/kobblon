/*
 * The two small pieces of the World page Staw asked about: the dot beside a
 * creator's face at its new size, and the "..." menu that replaced the
 * Configure button.
 *
 * Mounted with nothing around them, because both are shared components and
 * the Workspace will mount them the same way.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsis, faLink, faSliders, faCube, faFlag } from '@fortawesome/free-solid-svg-icons'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { Menu } from '@/components/ui/Menu'
import { ToastProvider } from '@/components/ui/Toast'
import '@/index.css'

const kobblon = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'kobblon',
  display_name: 'Kobblon',
  avatar_url: null,
  avatar_changed_at: null,
} as never

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen bg-ink p-10 text-ink-strong">
        <p className="text-xs uppercase tracking-wide text-ink-soft">The creator line, as the page draws it</p>
        <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl border border-ink-line bg-ink-card p-5">
          <div>
            <h1 className="font-display text-3xl font-extrabold">First Ground</h1>
            <span className="mt-2 inline-flex items-center gap-2 text-sm text-white/70">
              <PersonAvatar person={kobblon} size="xs" />
              By <span className="font-bold text-white">Kobblon</span>
            </span>
          </div>
          <Menu
            label="More"
            align="right"
            trigger={
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
                <FontAwesomeIcon icon={faEllipsis} />
              </span>
            }
            items={[
              { label: 'Copy link', icon: faLink, onSelect: () => {} },
              { label: 'Edit the page', icon: faSliders, to: '/create/worlds/x' },
              { label: 'Open in Workspace', icon: faCube, onSelect: () => {} },
              { label: 'Report abuse', icon: faFlag, danger: true, onSelect: () => {} },
            ]}
          />
        </div>

        <p className="mt-10 text-xs uppercase tracking-wide text-ink-soft">Every face size, so the dots stay in step</p>
        <div className="mt-3 flex items-end gap-5">
          {(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const).map((s) => (
            <PersonAvatar key={s} person={kobblon} size={s} />
          ))}
        </div>
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
