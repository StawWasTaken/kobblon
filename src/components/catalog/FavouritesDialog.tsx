/*
 * What somebody has starred, as a card.
 *
 * Staw: "make that all the favourited items are in a popup card a bit like
 * the basket card". It was a toggle that narrowed the shelf in place, which
 * meant looking at your own favourites and looking at the shop were the same
 * view in two states - you lost the shelf to see them, and lost them to get
 * the shelf back.
 *
 * Built the way the basket is, and for the same reason: it takes its lines
 * and what to do with one, it neither spends Brix nor decides anything, and
 * it mounts with nothing around it.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { faArrowUpRightFromSquare, faStar } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { BuyButton } from '@/components/money/BuyButton'
import { CurrencyMark } from '@/components/brand/Currency'
import { WornPicture } from '@/components/catalog/WornPicture'
import { Skeleton } from '@/components/ui/States'
import { avatarTag } from '@/lib/kinds'
import type { AvatarItem } from '@/types/db'

export function FavouritesDialog({
  open, onClose, items, loading, busy, canTake, onTake, onUnstar,
}: {
  open: boolean
  onClose: () => void
  items: AvatarItem[]
  loading: boolean
  /** Which one is being bought, so only that line's button spins. */
  busy: string | null
  canTake: boolean
  onTake: (item: AvatarItem) => void
  onUnstar: (item: AvatarItem) => void
}) {
  /*
   * Taken off the star here rather than reloading the list under somebody's
   * hand: a line that vanishes the moment it is unstarred takes the undo
   * with it, and a card that empties itself while being read is its own
   * kind of wrong.
   */
  const [dropped, setDropped] = useState<string[]>([])

  const total = items.reduce((sum, one) => sum + (one.price ?? 0), 0)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your favourites"
      description={
        items.length
          ? `${items.length} starred${total > 0 ? `, ${total} together` : ', all free'}`
          : undefined
      }
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing starred yet. The star on anything in the Catalog keeps it here.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const off = dropped.includes(item.id)
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-raised p-2"
              >
                <Link
                  to={`/catalog/${avatarTag(item.kind, item.content_id)}`}
                  onClick={onClose}
                  className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-media"
                >
                  <WornPicture item={item} />
                </Link>
                <span className="min-w-0 flex-1">
                  <Link
                    to={`/catalog/${avatarTag(item.kind, item.content_id)}`}
                    onClick={onClose}
                    className="block truncate text-sm font-bold transition-colors hover:text-link"
                  >
                    {item.name}
                    <Glyph icon={faArrowUpRightFromSquare} className="ml-1.5 text-[10px] text-white/35" />
                  </Link>
                  <span className="block text-xs font-bold">
                    {item.price > 0
                      ? <><CurrencyMark className="mr-0.5" />{item.price}</>
                      : <span className="text-space-bright">Free</span>}
                  </span>
                </span>

                <BuyButton
                  size="sm"
                  price={item.price}
                  owned={item.owned}
                  ownedLabel="Wear it"
                  freeLabel="Take it"
                  loading={busy === item.id}
                  disabled={!canTake}
                  onClick={() => onTake(item)}
                />
                <button
                  type="button"
                  aria-label={off ? `Star ${item.name} again` : `Take the star off ${item.name}`}
                  aria-pressed={!off}
                  onClick={() => {
                    setDropped((was) => (off
                      ? was.filter((one) => one !== item.id)
                      : [...was, item.id]))
                    onUnstar(item)
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
                >
                  <Glyph icon={faStar} on={!off} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}
