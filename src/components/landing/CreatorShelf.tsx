import { Marquee } from '@/components/landing/Marquee'
import { Piece } from '@/components/landing/Piece'
import { Skeleton } from '@/components/ui/States'
import type { MarketAsset } from '@/types/db'

/**
 * What people have made, on two shelves drifting against each other. Each
 * piece is previewed the way its kind deserves rather than as a thumbnail in
 * a box, which is the whole point of showing it here at all.
 */
export function CreatorShelf({ items, loading }: { items: MarketAsset[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex gap-5 overflow-hidden px-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[17rem] w-[17rem] shrink-0 rounded-2xl" />
        ))}
      </div>
    )
  }

  const half = Math.ceil(items.length / 2)
  const top = items.slice(0, half)
  const bottom = items.slice(half)

  return (
    <div className="space-y-8">
      <Marquee seconds={80}>
        {top.map((item) => <Piece key={item.id} item={item} />)}
      </Marquee>

      {!!bottom.length && (
        <Marquee seconds={96} reverse>
          {bottom.map((item) => <Piece key={item.id} item={item} />)}
        </Marquee>
      )}
    </div>
  )
}
