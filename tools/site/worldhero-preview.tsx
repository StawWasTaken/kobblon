/*
 * The World page's new head, drawn without a database.
 *
 * It is a copy of the hero's markup rather than the page itself, because the
 * page fetches a World, its media, its genres and the viewer's standing on
 * it before it draws anything, and none of that can be reached from here.
 * What this checks is the thing that was actually changed: the shape.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faEllipsis, faLink, faStar, faBell, faSliders, faCube, faFlag } from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { Tabs } from '@/components/ui/Tabs'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { RatingBar } from '@/components/worlds/RatingBar'
import { ToastProvider } from '@/components/ui/Toast'
import '@/index.css'

const kobblon = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'kobblon', display_name: 'Kobblon',
  avatar_url: null, avatar_changed_at: null,
} as never

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen bg-ink text-ink-strong">
        <Page>
        <section className="overflow-hidden rounded-3xl border border-ink-line bg-ink-card">
          <div className="relative h-32 w-full sm:h-44">
            <div className="h-full w-full bg-gradient-to-br from-brand-deep to-ink-sunken" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-card via-ink-card/60 to-ink-card/10" />
          </div>
          <div className="relative px-5 pb-5 sm:px-7 sm:pb-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-end gap-4">
                <div className="-mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-ink-card bg-gradient-to-br from-brand to-brand-deep sm:-mt-12 sm:h-24 sm:w-24">
                  <div className="flex h-full w-full items-center justify-center font-display text-3xl font-black text-white/90">F</div>
                </div>
                <div className="min-w-0 pb-1">
                  <h1 className="truncate font-display text-2xl font-extrabold leading-tight sm:text-3xl">First Ground</h1>
                  <span className="mt-1.5 inline-flex items-center gap-2 text-sm text-white/70">
                    <PersonAvatar person={kobblon} size="xs" />
                    By <span className="font-bold text-white">Kobblon</span>
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-space/15 px-2.5 py-1 font-bold text-space">
                      <span className="h-1.5 w-1.5 rounded-full bg-space" />13 playing
                    </span>
                    <span className="rounded-full bg-white/5 px-2.5 py-1 font-semibold text-muted">Obby</span>
                    <span className="rounded-full bg-white/5 px-2.5 py-1 font-semibold text-muted">21 visits</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:min-w-[18rem]">
                <div className="flex items-center gap-2">
                  <Button size="lg" variant="enter" className="flex-1">
                    <FontAwesomeIcon icon={faPlay} />
                    <span className="font-display text-lg font-extrabold">Play</span>
                  </Button>
                  <Menu
                    label="More" align="right"
                    trigger={<span className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-line text-white/70"><FontAwesomeIcon icon={faEllipsis} /></span>}
                    items={[
                      { label: 'Copy link', icon: faLink, onSelect: () => {} },
                      { label: 'Edit the page', icon: faSliders, to: '/x' },
                      { label: 'Open in Workspace', icon: faCube, onSelect: () => {} },
                      { label: 'Report abuse', icon: faFlag, danger: true, onSelect: () => {} },
                    ]}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <button className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-white/60"><FontAwesomeIcon icon={faStar} />0</button>
                  <button className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-white/60"><FontAwesomeIcon icon={faBell} />Notify</button>
                  <RatingBar likes={13} dislikes={0} iLike={false} iDislike={false} onLike={() => {}} onDislike={() => {}} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <Tabs
          look="line" className="mt-8" label="Which part"
          value="About" onChange={() => {}}
          options={['About', 'Badges', 'Shop', 'Servers'].map((v) => ({ value: v, label: v }))}
        />
        </Page>
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
