/*
 * The three cards this round added, on their own.
 *
 * The Catalog cannot be opened here - it reads Supabase and there is no
 * Supabase from this container - so the cards are mounted with lines made
 * up on the spot, which is also the test that matters: each of them has to
 * work with nothing around it.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '@/index.css'
import { BuyDialog } from '@/components/catalog/BuyDialog'
import { BasketDialog } from '@/components/catalog/BasketDialog'
import { FavouritesDialog } from '@/components/catalog/FavouritesDialog'
import type { AvatarItem } from '@/types/db'

const starred = [
  { id: '1', content_id: 1201, kind: 'hair', name: 'Deal With It Shades', price: 40, owned: false },
  { id: '2', content_id: 1202, kind: 'shirt', name: 'Kobblon CEO Bespoke Suit', price: 500, owned: true },
  { id: '3', content_id: 1203, kind: 'face', name: 'Grin', price: 0, owned: false },
] as unknown as AvatarItem[]

function Page() {
  /* Which card, from the address, so a screenshot can ask for one without
     having to reach a button that the open card is sitting on top of. */
  const asked = new URLSearchParams(window.location.search).get('card')
  const [which, setWhich] = useState<'buy' | 'basket' | 'stars'>(
    asked === 'basket' || asked === 'stars' ? asked : 'buy',
  )

  return (
    <div className="min-h-screen bg-ink p-8 text-white">
      <div className="mb-6 flex gap-2">
        {(['buy', 'basket', 'stars'] as const).map((one) => (
          <button
            key={one}
            onClick={() => setWhich(one)}
            className="rounded-lg border border-ink-line px-3 py-1.5 text-sm font-bold"
          >
            {one}
          </button>
        ))}
      </div>

      <BuyDialog
        open={which === 'buy'}
        onClose={() => setWhich('buy')}
        onBuy={() => {}}
        name="Engineer Hard Hat"
        kind="accessory"
        price={150}
        balance={1205}
        note="A limited: it stops selling on 24/12/2026."
      />
      <BasketDialog
        open={which === 'basket'}
        onClose={() => setWhich('basket')}
        paying={false}
        balance={1205}
        onBuy={() => {}}
        lines={[
          { id: '1', name: 'Deal With It Shades', kind: 'accessory', price: 40, picture: null },
          { id: '2', name: 'Engineer Hard Hat', kind: 'accessory', price: 150, picture: null },
        ]}
      />
      <FavouritesDialog
        open={which === 'stars'}
        onClose={() => setWhich('stars')}
        items={starred}
        loading={false}
        busy={null}
        canTake
        onTake={() => {}}
        onUnstar={() => {}}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Page /></MemoryRouter>,
)
