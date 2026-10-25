import { useState } from 'react'
import { Link } from 'react-router-dom'
import { faClock, faShapes } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { FreeCorner } from '@/components/brand/FreeBadge'
import { Byline } from '@/components/catalog/Byline'
import { WornPicture } from '@/components/catalog/WornPicture'
import { AssetTile } from '@/components/create/AssetTile'
import { BuyButton } from '@/components/money/BuyButton'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import {
  buyAvatarItem, listAssetsByCreator, listCommunityAssets, shopShelf,
  wearAvatarItem,
} from '@/lib/api'
import { avatarTag } from '@/lib/kinds'
import { cn } from '@/lib/cn'
import type { AvatarItem } from '@/types/db'

/**
 * Somebody's shop, or a Community's.
 *
 * Staw: "when you create stuff that you sell in the create tab (either as
 * you or as a community) then if its published then itll appear on your
 * personal shop or community shop and on the catalog too ofc".
 *
 * So this is not a second Catalog with a filter on it. It is the one place
 * that answers "what does this person sell", which a profile could not
 * answer at all before today - their things were in the Catalog among
 * everybody else's and nowhere on them.
 *
 * Two shelves, because they are two different things to buy and one grid of
 * both reads as neither: things to wear, and things to build with. A shop
 * with nothing on one of them simply does not draw that one.
 *
 * Nothing unapproved is here. The server decides that - `shop_shelf` asks
 * for approved, listed and not taken down - and it is worth saying why the
 * page does not soften it for the owner: a shop is what strangers see, and
 * an owner looking at their own shop is asking what those strangers see.
 * What they are still making is in Create, where it can say what it is
 * waiting for.
 */
export function Shop({ owner, who, isMine }: {
  owner: { user: string } | { community: string }
  /** Whose shop it is, for the empty state to say it in their own name. */
  who: string
  isMine?: boolean
}) {
  const key = 'user' in owner ? owner.user : owner.community
  const items = useAsync(() => shopShelf(owner), [key])
  const assets = useAsync(
    () => ('user' in owner ? listAssetsByCreator(owner.user) : listCommunityAssets(owner.community)),
    [key],
  )

  const loading = items.loading || assets.loading
  const empty = !items.data?.length && !assets.data?.length

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
      </div>
    )
  }

  if (empty) {
    return (
      <Card>
        <EmptyState
          /* The Catalog's own drawing rather than the empty stand: a shop
             with nothing in it is still a shop. */
          mood="style"
          title="Nothing for sale yet"
          body={isMine
            ? 'Make something in Create, wait for it to be looked at, and publish it. It shows up here and in the Catalog.'
            : `${who} has not put anything up for sale.`}
          action={isMine ? <Button to="/create" icon={faShapes}>Go to Create</Button> : undefined}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-10">
      {!!items.data?.length && (
        <section className="space-y-4">
          <header className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-black">To wear</h2>
            <span className="text-xs text-muted">
              {items.data.length === 1 ? '1 thing' : `${items.data.length} things`}
            </span>
          </header>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {items.data.map((item) => <ShopCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {!!assets.data?.length && (
        <section className="space-y-4">
          <header className="flex items-baseline justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Glyph icon={faShapes} className="text-sm text-muted" />
              To build with
            </h2>
            <span className="text-xs text-muted">
              {assets.data.length === 1 ? '1 thing' : `${assets.data.length} things`}
            </span>
          </header>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {assets.data.map((item) => <AssetTile key={item.id} item={item} />)}
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * One thing on a shelf.
 *
 * Buying and wearing in one press, the way the Catalog does it: these are
 * clothes, and a person who has just bought a shirt wants it on. Owned
 * already, the same button simply puts it on.
 */
function ShopCard({ item }: { item: AvatarItem }) {
  const say = useToast()
  const [busy, setBusy] = useState(false)
  const [owned, setOwned] = useState(!!item.owned)
  const closed = !!item.sells_until
    && new Date(item.sells_until).getTime() <= Date.now()

  const take = async () => {
    setBusy(true)
    try {
      if (!owned) await buyAvatarItem(item.id)
      await wearAvatarItem(item.id)
      setOwned(true)
      say(`${item.name} is on.`, 'success')
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not go through.', 'error')
    }
    setBusy(false)
  }

  return (
    <div className="relative">
      {!item.price && <FreeCorner />}
      <div className={cn(
        'overflow-hidden rounded-xl border border-ink-line bg-ink-card',
        'transition-colors hover:border-brand/60',
      )}>
        <Link
          to={`/catalog/${avatarTag(item.kind, item.content_id)}`}
          draggable={false}
          className="relative grid aspect-square place-items-center overflow-hidden bg-media"
        >
          <WornPicture item={item} className="select-none" />

          {item.sells_until && (
            <span className={cn(
              'absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5',
              'text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm',
              closed ? 'bg-ink/85 text-white/60' : 'bg-amber-400/90 text-ink',
            )}>
              <Glyph icon={faClock} />
              {closed ? 'Closed' : 'Limited'}
            </span>
          )}
        </Link>

        <div className="space-y-2 p-3">
          <h3 className="truncate text-sm font-bold">
            <Link
              to={`/catalog/${avatarTag(item.kind, item.content_id)}`}
              className="transition-colors hover:text-link"
            >
              {item.name}
            </Link>
          </h3>
          <Byline item={item} className="text-xs" />
          {closed && !owned
            ? <span className="block rounded-lg bg-ink-raised py-1.5 text-center text-xs font-bold text-muted">Closed</span>
            : (
              <BuyButton
                block
                size="sm"
                price={item.price}
                owned={owned}
                ownedLabel="Wear it"
                freeLabel="Take it"
                loading={busy}
                onClick={() => void take()}
              />
            )}
        </div>
      </div>
    </div>
  )
}
