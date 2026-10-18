/* The Community header with a cover and without one, side by side. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { CommunityHeader } from '@/components/community/CommunityHeader'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider } from '@/hooks/useAuth'
import type { Community } from '@/types/db'
import '@/index.css'

const base = {
  id: 'c1', owner_id: 'u1', slug: 'kobville', name: "Cooki3's Kobville",
  description: 'for kobblonians!',
  icon_url: null, banner_url: null,
  join_policy: 'open', is_verified: true, member_count: 10, funds: 0,
  is_removed: false, content_id: 1, created_at: new Date().toISOString(),
} as unknown as Community

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <ToastProvider>
      <MemoryRouter>
        <div className="min-h-dvh bg-ink pb-10">
          <p className="px-6 pt-4 text-xs font-bold uppercase tracking-wide text-muted">No cover</p>
          <CommunityHeader group={base} ownerName="imCooki3" />
          <p className="px-6 pt-10 text-xs font-bold uppercase tracking-wide text-muted">With a cover</p>
          <CommunityHeader
            group={{ ...base, banner_url: '/brand/banner3.png' }}
            ownerName="imCooki3"
          />
        </div>
      </MemoryRouter>
    </ToastProvider>
  </AuthProvider>,
)
