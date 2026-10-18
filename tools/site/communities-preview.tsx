/* The Communities panel's card, at each of the three ranks. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { CommunityCard } from '@/pages/Admin'
import { ToastProvider } from '@/components/ui/Toast'
import type { StaffCommunity } from '@/types/db'
import '@/index.css'

const base: StaffCommunity = {
  id: 'a', content_id: 1309, slug: 'staw-fanclub', name: 'Staw Fanclub',
  icon_url: null, member_count: 1482, funds: 3200,
  is_public: true, is_verified: true, is_removed: false,
  closed_at: null, erase_after: null, closed_reason: null,
  created_at: new Date().toISOString(),
  owner_id: 'b', owner_username: 'johndoe', owner_name: 'JohnDoe',
  owner_avatar: null, owner_suspended: false, open_reports: 2,
}

const closed: StaffCommunity = {
  ...base, id: 'c', slug: 'old-club', name: 'Old Club', is_verified: false,
  is_removed: true, closed_at: new Date().toISOString(),
  erase_after: new Date(Date.now() + 60 * 86400_000).toISOString(),
  closed_reason: 'Repeated breaches of the guidelines, and no answer from the owner.',
  owner_suspended: true, open_reports: 0, member_count: 1,
}

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <MemoryRouter>
      <div className="min-h-screen space-y-6 bg-ink p-8">
        {(['moderator', 'admin', 'superadmin'] as const).map((rank) => (
          <section key={rank} className="space-y-3">
            <p className="font-display text-xs uppercase tracking-wider text-muted">{rank}</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <CommunityCard row={base} rank={rank} onChanged={() => {}} />
              <CommunityCard row={closed} rank={rank} onChanged={() => {}} />
            </div>
          </section>
        ))}
      </div>
    </MemoryRouter>
  </ToastProvider>,
)
