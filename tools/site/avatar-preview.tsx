/* The My Avatar layout, with nothing around it and nothing to sign in to. */
import { createRoot } from 'react-dom/client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faFaceSmile, faHatCowboy, faPalette, faFolder, faShuffle,
  faCamera, faEraser, faBookmark, faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons'
import { Input } from '@/components/ui/Input'
import { Studio } from '@/components/avatar/Studio'
import { AvatarStage } from '@/components/avatar/AvatarStage'
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
    Head: '#f2d08a', Torso: '#1b34e8', LeftArm: '#f2d08a',
    RightArm: '#f2d08a', LeftLeg: '#2a2f45', RightLeg: '#2a2f45',
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
              'group relative grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-2xl border px-2 text-center transition-all lg:h-[5.5rem] lg:w-[5.5rem]',
              i === 0
                ? 'border-brand bg-brand/15 text-white shadow-[0_0_0_1px_var(--brand)]'
                : 'border-ink-line bg-ink-card text-white/40',
            )}
          >
            <FontAwesomeIcon icon={one.icon} className="text-xl" />
            <span className="mt-1.5 font-display text-[10px] font-extrabold uppercase leading-none tracking-wide">
              {one.label}
            </span>
            {!!one.count && (
              <span className={cn(
                'absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold leading-none',
                i === 0 ? 'bg-brand text-white' : 'bg-ink-hover text-white/50',
              )}>
                {one.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="min-w-0 space-y-4">
        <div className="relative rounded-2xl border border-ink-line bg-ink-card pb-12">
          <div className="relative overflow-hidden rounded-2xl">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(70%_55%_at_50%_40%,rgba(58,80,255,0.18),transparent_70%)]"
            />
            <Studio className="grid aspect-[5/4] w-full place-items-center">
              <div className="aspect-square h-[80%]">
                <AvatarStage look={LOOK} handled className="h-full" />
              </div>
            </Studio>
            <div className="pointer-events-none absolute left-4 top-4 z-[2] flex items-center gap-2 rounded-xl border border-ink-line bg-ink-card/70 px-3 py-1.5 backdrop-blur">
              <Icon name="avatar" tone="currentColor" className="h-3.5 w-3.5 text-brand-bright" />
              <span className="font-display text-xs font-extrabold">Staw</span>
            </div>
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
