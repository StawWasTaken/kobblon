/*
 * The item page's panel, with nothing around it and nothing behind it.
 *
 * The page itself needs a router and a database; this mounts the parts that
 * carry the design - the facts table, the creator line, the actions - so the
 * layout can be looked at in a container that cannot reach storage. It is
 * the only honest way to check this page's design from here.
 */
import { createRoot } from 'react-dom/client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck, faClock, faTrash, faEllipsis, faBasketShopping, faUser,
} from '@fortawesome/free-solid-svg-icons'
import { Menu } from '@/components/ui/Menu'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BuyButton } from '@/components/money/BuyButton'
import { CurrencyMark } from '@/components/brand/Currency'
import { NameMarks } from '@/components/brand/Verified'
import '@/index.css'

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-white/85">{value}</dd>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink p-8">
    <div className="mx-auto grid w-full max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink-card">
        <div className="grid aspect-square place-items-center bg-ink-raised text-sm text-muted">
          the viewer
        </div>
      </div>

      <div className="space-y-4 text-white">
        <Card className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-[10px] uppercase tracking-wider text-muted">Accessory</p>
              <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight">Pirate Bicorne</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-space/15 px-2.5 py-1 text-[11px] font-bold text-space-bright">
                <FontAwesomeIcon icon={faCircleCheck} />Yours
              </span>
              <Menu
                label="More"
                align="right"
                trigger={
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line bg-ink-raised text-white/60 transition-colors hover:bg-ink-hover hover:text-white">
                    <FontAwesomeIcon icon={faEllipsis} />
                  </span>
                }
                items={[
                  { label: 'Wear it on my avatar', icon: faUser, onSelect: () => {} },
                  { label: 'See who made it', icon: faUser, onSelect: () => {} },
                  { label: 'Take it down', icon: faTrash, danger: true, onSelect: () => {} },
                ]}
              />
            </div>
          </div>

          <a className="flex items-center gap-2 text-sm text-white/75">
            <span className="text-muted">By</span>
            <span className="truncate font-semibold text-white/90">Kobblon</span>
            <NameMarks person={{ is_verified: true, is_admin: true }} className="text-[11px]" />
          </a>

          <p className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-200">
            <FontAwesomeIcon icon={faClock} className="mt-0.5" />
            <span>A limited. It can be bought until <span className="font-bold">30 June 2027, 19:00</span>, and not after.</span>
          </p>

          <div className="flex items-center gap-2">
            <BuyButton className="flex-1" price={45} onClick={() => {}} />
            <button
              type="button"
              aria-label="Put it in your basket"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-line bg-ink-raised text-white/60 transition-colors hover:border-brand/60 hover:text-white"
            >
              <FontAwesomeIcon icon={faBasketShopping} />
            </button>
          </div>

          <dl className="divide-y divide-ink-line border-t border-ink-line text-sm">
            <Fact label="Number" value="ACCS-1195" />
            <Fact label="Type" value="Accessory" />
            <Fact label="Worn" value="On the head" />
            <Fact label="Made" value="2 Oct 2026" />
            <Fact label="Taken" value="2 people have it" />
            <Fact label="Price" value={<span className="inline-flex items-center gap-0.5"><CurrencyMark />45</span>} />
          </dl>

        </Card>

        <Card className="space-y-2 p-5">
          <p className="font-display text-[10px] uppercase tracking-wider text-muted">About it</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
            Mandatory headwear for pillaging public servers, hoarding virtual loot,
            and looking slightly more important than everyone else. Arrrr
          </p>
        </Card>
      </div>
    </div>
  </div>,
)
