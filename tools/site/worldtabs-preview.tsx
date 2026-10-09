/*
 * Badges and Shop, as the owner and as everybody else.
 *
 * The difference between the two is the whole design - the add tile must
 * not be drawn for somebody who cannot use it - and it cannot be seen from
 * one screenshot, so both are here.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Page } from '@/components/layout/AppShell'
import { ToastProvider } from '@/components/ui/Toast'
import { WorldThings } from '@/components/worlds/WorldThings'
import type { WorldBadge, WorldPass } from '@/lib/api'
import '@/index.css'

const badges: WorldBadge[] = [
  { id: 'b1', content_id: 1436, world_id: 'w', name: 'First Steps', description: null, icon_url: null, is_enabled: true, awarded_count: 412 },
  { id: 'b2', content_id: 1440, world_id: 'w', name: 'Up The Tower', description: null, icon_url: null, is_enabled: true, awarded_count: 37 },
]
const passes: WorldPass[] = [
  { id: 'p1', content_id: 1437, world_id: 'w', name: 'Gold Key', description: null, icon_url: null, price: 250, is_for_sale: true },
  { id: 'p2', content_id: 1441, world_id: 'w', name: 'Early Access', description: null, icon_url: null, price: 0, is_for_sale: true },
]

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen bg-ink text-ink-strong">
        <Page className="space-y-8">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Badges — the owner</p>
          <WorldThings kind="badges" badges={badges} mine worldId="w" />

          <p className="text-xs uppercase tracking-wide text-ink-soft">Shop — the owner</p>
          <WorldThings kind="shop" passes={passes} mine worldId="w" />

          <p className="text-xs uppercase tracking-wide text-ink-soft">Badges — the owner, nothing made yet</p>
          <WorldThings kind="badges" badges={[]} mine worldId="w" />

          <p className="text-xs uppercase tracking-wide text-ink-soft">Shop — anybody else, nothing for sale</p>
          <WorldThings kind="shop" passes={[]} mine={false} worldId="w" />
        </Page>
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
