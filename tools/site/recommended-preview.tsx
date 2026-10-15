/* The Recommended row, with cards standing in for a signed-in answer. */
import { createRoot } from 'react-dom/client'
import { Link, MemoryRouter } from 'react-router-dom'
import { faShirt, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Button } from '@/components/ui/Button'
import { Price } from '@/components/brand/Currency'
import { cn } from '@/lib/cn'
import '@/index.css'

const THINGS = [
  ['Pumpkin Smug Tdecal', 'T-decal', 55],
  ['Traffic Wizard', 'Accessory', 120],
  ['Deal With It Shades', 'Accessory', 0],
  ['Kobblon TDecal Blue', 'T-decal', 55],
  ['Hard Hat', 'Accessory', 80],
  ['I love Kobblon Shirt', 'Shirt', 25],
  ['Preppy Kobblon Tdecal', 'T-decal', 55],
] as const

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink p-10">
      <div className="max-w-[38rem] space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-extrabold">Recommended</h2>
          <Button to="/catalog" size="sm" variant="ghost" icon={faArrowRight} className="ml-auto">
            See all
          </Button>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {THINGS.map(([name, kind, price]) => (
            <div key={name} className="relative w-36 shrink-0">
              <Link
                to="/"
                className={cn(
                  'flex flex-col overflow-hidden rounded-2xl border border-ink-line bg-ink-card',
                  'transition-colors hover:border-brand/60',
                )}
              >
                <span className="block p-2">
                  <span className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-media">
                    <Glyph icon={faShirt} className="text-2xl text-white/25" />
                  </span>
                </span>
                <span className="block px-3 pb-3 pt-0.5">
                  <span className="block truncate text-xs font-bold leading-snug">{name}</span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] text-muted">{kind}</span>
                    <Price amount={price} className="shrink-0 text-[11px] font-bold" />
                  </span>
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  </MemoryRouter>,
)
