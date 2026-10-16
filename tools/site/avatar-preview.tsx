/* The My Avatar layout, with nothing around it and nothing to sign in to. */
import { createRoot } from 'react-dom/client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faFaceSmile, faHatCowboy, faPalette, faFolder, faShuffle,
  faCamera, faEraser, faBookmark, faMagnifyingGlass, faImage, faCube,
} from '@fortawesome/free-solid-svg-icons'
import { Input } from '@/components/ui/Input'
import { Studio } from '@/components/avatar/Studio'
import { AvatarStage } from '@/components/avatar/AvatarStage'
import { ViewSwitch } from '@/components/avatar/ViewSwitch'
import { Icon } from '@/components/brand/Icon'
import { cn } from '@/lib/cn'
import '@/index.css'

const DRAWERS = [
  { id: 'clothing', label: 'Clothing', icon: faShirt, count: 12 },
  { id: 'accessories', label: 'Accessories', icon: faHatCowboy, count: 7 },
  { id: 'face', label: 'Face', icon: faFaceSmile, count: 3 },
  { id: 'body', label: 'Body', icon: faPalette },
  { id: 'outfits', label: 'Outfits', icon: faFolder },
]

const LOOK = {
  body: {
    Head: '#ebb591', Torso: '#1b34e8', LeftArm: '#ebb591',
    RightArm: '#ebb591', LeftLeg: '#2a2f45', RightLeg: '#2a2f45',
  },
  pieces: [],
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink px-6 py-6">
    <div className="mx-auto grid max-w-[86rem] items-start justify-center gap-5 lg:grid-cols-[auto_minmax(22rem,38rem)_minmax(18rem,32rem)]">
      <nav className="flex shrink-0 gap-2 lg:w-[5.5rem] lg:flex-col">
        {DRAWERS.map((one, i) => (
          <button
            key={one.id}
            className={cn(
              'group relative flex h-[4.25rem] w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 transition-colors lg:h-[4.75rem] lg:w-[4.75rem]',
              i === 0
                ? 'border-brand bg-brand/15 text-white'
                : 'border-ink-line bg-ink-card text-white/45',
            )}
          >
            <FontAwesomeIcon icon={one.icon} className="text-[1.35rem]" />
            <span className="flex max-w-full items-center gap-1">
              <span className="truncate font-display text-[9.5px] font-extrabold uppercase leading-none tracking-wide">
                {one.short ?? one.label}
              </span>
              {!!one.count && (
                <span className={cn(
                  'shrink-0 text-[9px] font-bold leading-none',
                  i === 0 ? 'text-white/70' : 'textateframe-white/30',
                )}>
                  {one.count}
                </span>
              )}
            </span>
          </button>
        ))}
      </nav>

      <div className="min-w-0 space-y-4">
        <div className="relative rounded-2xl border border-ink-line bg-ink-card pb-12">
          <div className="relative overflow-hidden rounded-2xl">
            <Studio className="aspect-[4/3] w-full">
              <AvatarStage look={LOOK} handled fill className="h-full w-full" />
              <ViewSwitch
                ways={[
                  { value: 'picture' as const, icon: faImage, label: '2D' },
                  { value: 'body' as const, icon: faCube, label: '3D' },
                ]}
                value={'body' as const}
                onChange={() => {}}
              />
            </Studio>
          </div>

          <div className="absolute right-4 top-4 z-[3]">
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-ink-line bg-ink-card/85 p-1.5 shadow-pop backdrop-blur">
              {[faEraser, faShuffle, faBookmark, faCamera].map((icon, i) => (
                <span key={i} className="grid h-10 w-10 place-items-center rounded-xl text-sm text-white/80">
                  <FontAwesomeIcon icon={icon} />
                </span>
              ))}
            </div>
          </div>

          <div className="absolute bottom-3 left-4 z-[2] w-fit max-w-[calc(100%-2rem)] rounded-2xl border border-ink-line bg-ink-card/90 p-3 shadow-pop backdrop-blur sm:left-6 sm:max-w-[calc(100%-3rem)]">
            <div className="flex items-center gap-2">
              <p className="font-display text-[10px] font-extrabold uppercase tracking-wider text-muted">
                Wearing
              </p>
              <span className="rounded-full bg-ink-hover px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white/50">
                4
              </span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {['a', 'b', 'c', 'd'].map((n) => (
                <li key={n}>
                  <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl border border-ink-line bg-media p-1">
                    <FontAwesomeIcon icon={faHatCowboy} className="text-white/30" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-base font-extrabold">Clothing</h2>
          <span className="text-xs text-muted">9</span>
          <div className="ml-auto w-full sm:w-44">
            <Input
              value=""
              onChange={() => {}}
              placeholder="Search"
              icon={faMagnifyingGlass}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[['Everything', 9, true], ['Shirts', 2, false], ['Trousers', 2, false], ['T-decals', 5, false]].map(([label, n, on]) => (
            <button
              key={String(label)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold',
                on
                  ? 'border-brand bg-brand/15 text-white'
                  : 'border-ink-line bg-ink-raised text-white/60',
              )}
            >
              {label}
              <span className={on ? 'text-white/70' : 'text-white/30'}>{n as number}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 [&>*]:max-w-[11rem]">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className={cn(
                'flex flex-col overflow-hidden rounded-2xl border bg-ink-card text-left',
                i === 0 ? 'border-brand' : 'border-ink-line',
              )}
            >
              <span className="relative block p-2">
                <span className="relative grid aspect-square place-items-center overflow-hidden rounded-xl bg-media">
                  <FontAwesomeIcon icon={faShirt} className="text-2xl text-white/25" />
                </span>
                {i === 0 && (
                  <span className="absolute right-3.5 top-3.5 grid h-6 w-6 place-items-center rounded-lg bg-brand text-white shadow-pop">
                    <Icon name="checkmark" tone="currentColor" className="h-3 w-3" />
                  </span>
                )}
                {(i === 1 || i === 4) && (
                  <span className={cn(
                    'absolute bottom-3.5 left-3.5 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide',
                    i === 4 ? 'bg-ink/85 text-white/60' : 'bg-amber-400/90 text-ink',
                  )}>
                    {i === 4 ? 'Closed' : 'Limited'}
                  </span>
                )}
              </span>
              <span className="block px-3 pb-3 pt-0.5">
                <span className="block truncate text-xs font-bold leading-snug">
                  Kobblon TDecal {i + 1}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted">T-decal</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>,
)
