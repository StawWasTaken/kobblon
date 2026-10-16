/*
 * The two new pieces of a shop, on their own: the byline that says a
 * Community made something, and the picture that stands in for one that did
 * not load. Both are pure, so they can be looked at without a session.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Byline } from '@/components/catalog/Byline'
import { Missing } from '@/components/brand/Missing'
import type { AvatarItem } from '@/types/db'
import '@/index.css'

const base = {
  id: '1', content_id: 1, kind: 'shirt', slot: 'shirt', name: 'Regal Noir Suit',
  price: 5, image_path: null, mesh_path: null, texture_path: null,
} as unknown as AvatarItem

const byPerson: AvatarItem = {
  ...base,
  creator_username: 'eduardmuller',
  creator_display_name: 'EduardMuller',
  creator_is_verified: true,
}

const byCommunity: AvatarItem = {
  ...byPerson,
  community_id: 'c1',
  community_slug: 'schneider-co',
  community_name: 'Schneider Co.',
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink p-10 text-white">
      <div className="grid max-w-3xl gap-6 sm:grid-cols-3">
        {[byPerson, byCommunity].map((item, nth) => (
          <div key={nth} className="overflow-hidden rounded-xl border border-ink-line bg-ink-card">
            <div className="grid aspect-square place-items-center bg-media">
              <Missing why={nth ? 'Turned down' : undefined} />
            </div>
            <div className="space-y-2 p-3">
              <h3 className="truncate text-sm font-bold">{item.name}</h3>
              <Byline item={item} className="text-xs" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </MemoryRouter>,
)
