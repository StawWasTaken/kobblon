/*
 * The free badge on a card that clips, and the buy button at both prices.
 *
 * The whole point of the badge is that half of it hangs off the corner, and
 * the whole risk is that the card clips that half away without anything
 * erroring. So this puts one on a card with `overflow-hidden`, which is what
 * every card on the site has.
 */
import { createRoot } from 'react-dom/client'
import { FreeCorner, FreeBadge } from '@/components/brand/FreeBadge'
import { BuyButton } from '@/components/money/BuyButton'
import '@/index.css'

function Tile({ free, label }: { free: boolean; label: string }) {
  return (
    <div className="relative w-44">
      {free && <FreeCorner />}
      <article className="overflow-hidden rounded-2xl border border-ink-line bg-ink-card">
        <div className="grid aspect-square place-items-center bg-ink-raised text-white/20">
          picture
        </div>
        <div className="space-y-2 p-3">
          <p className="truncate text-sm font-bold">{label}</p>
          <BuyButton size="sm" price={free ? 0 : 250} className="w-full" />
        </div>
      </article>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-10 bg-ink p-10 text-white">
    <div className="flex flex-wrap items-start gap-10">
      <Tile free label="A free hat" />
      <Tile free={false} label="A hat that costs" />
    </div>

    <div className="space-y-3">
      <p className="font-display text-xs uppercase tracking-wider text-muted">
        The button at every state
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <BuyButton price={0} />
        <BuyButton price={250} />
        <BuyButton price={128400} />
        <BuyButton price={250} owned />
      </div>
    </div>

    <div className="space-y-3">
      <p className="font-display text-xs uppercase tracking-wider text-muted">
        The badge on its own, at the sizes it gets used
      </p>
      <div className="flex items-end gap-6">
        {[32, 44, 64, 96].map((n) => (
          <div key={n} style={{ width: n, height: n }} className="shrink-0">
            <FreeBadge />
          </div>
        ))}
      </div>
    </div>
  </div>,
)
