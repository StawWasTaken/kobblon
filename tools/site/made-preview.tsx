/*
 * A thing somebody made, in its card, opened on its editor.
 *
 * Which is the whole point of this page: "Edit it" on a Catalog item sends
 * somebody to `/create/avatar?item=<number>`, and what they should arrive at
 * is this, open, rather than a drawer they have to search. There is no way
 * to see that without an account and a database, so the card is mounted on
 * its own with a made-up item.
 *
 * No provider around it but a router and the toasts the card speaks through.
 */
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { MadeCard } from '@/pages/CreateAvatarItems'
import type { AvatarItem } from '@/types/db'

const item = {
  id: 'aaaa0001-0000-0000-0000-000000000001',
  content_id: 1195,
  kind: 'accessory',
  slot: 'hat',
  name: 'Pirate Bicorne',
  description: 'Mandatory headwear for pillaging public servers.',
  price: 45,
  image_path: null,
  image_bucket: 'catalog',
  preview_path: null,
  mesh_path: 'x/bicorne.obj',
  texture_path: null,
  status: 'approved',
  is_public: true,
  created_at: '2026-10-02T09:00:00Z',
  taken: 2,
} as unknown as AvatarItem

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen bg-ink p-10 text-white">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <MadeCard
            item={item}
            rule={{ kind: 'accessory', upload_cost: 40, least_price: 30, needs_verified: true, kobblon_only: false }}
            canLimit
            canScreen
            me="11111111-1111-1111-1111-111111111111"
            onChanged={() => {}}
            onTrouble={() => {}}
            onDone={() => {}}
            openEditor
          />
        </div>
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
