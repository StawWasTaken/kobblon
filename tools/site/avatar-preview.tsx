/* The My Avatar layout, with nothing around it and nothing to sign in to. */
import { createRoot } from 'react-dom/client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faFaceSmile, faHatCowboy, faPalette, faFolder, faShuffle,
  faCamera, faEraser, faBookmark, faXmark, faMagnifyingGlass, faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { Card } from '@/components/ui/Card'
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
  <div className="min-h-screen bg-ink p-6">
    <div className="flex gap-4">
      <nav className="flex shrink-0 flex-col gap-1.5 sm:w-20">
        {DRAWERS.map((one, i) => (
          <button
            key={one.id}
            className={cn(
              'relative grid h-14 w-14 place-items-center rounded-2xl border px-1 text-center transition-colors sm:h-20 sm:w-20',
              i === 0
                ? 'border-brand bg-brand/15 text-white'
                : 'border-ink-line bg-ink-card text-white/45',
            )}
          >
            <FontAwesomeIcon icon={one.icon} className="text-lg" />
            <span className="mt-1 hidden text-[9px] font-extrabold uppercase leading-tight tracking-wide sm:block">
              {one.label}
            </span>
            {!!one.count && (
              <span className="absolute right-1 top-1 text-[9px] font-bold text-white/35">
                {one.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="mx-auto w-full max-w-[32rem] space-y-3">
          <Card className="overflow-hidden p-0">
            <div className="relative">
              <Studio>
                <AvatarStage look={LOOK} handled />
              </Studio>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-ink/80 to-transparent p-3">
                {[faEraser, faShuffle, faBookmark, faCamera].map((icon, i) => (
                  <span key={i} className="grid h-10 w-10 place-items-center rounded-xl border border-ink-line bg-ink-card/90 text-sm text-white/80 backdrop-blur">
                    <FontAwesomeIcon icon={icon} />
                  </span>
                ))}
              </div>
            </div>
            <div className="border-t border-ink-line p-3">
              <p className="mb-2 font-display text-[10px] uppercase tracking-wider text-muted">
                Wearing · 4
              </p>
              <ul className="flex flex-wrap gap-2">
                {['Traffic Wizard', 'Deal With It Shades', ':]', 'Pumpkin Smug'].map((n) => (
                  <li key={n} className="relative">
                    <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl border border-ink-line bg-media">
                      <FontAwesomeIcon icon={faHatCowboy} className="text-white/30" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-bold">Clothing</h2>
            <Input
              value=""
              onChange={() => {}}
              placeholder="Search what you own"
              icon={faMagnifyingGlass}
              className="ml-auto w-44"
            />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'overflow-hidden rounded-xl border bg-ink-card text-left',
                  i === 0 ? 'border-brand' : 'border-ink-line',
                )}
              >
                <div className="relative grid aspect-square place-items-center bg-media">
                  <FontAwesomeIcon icon={faShirt} className="text-2xl text-white/20" />
                  {i === 0 && (
                    <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-brand text-white">
                      <Icon name="checkmark" tone="currentColor" className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="truncate p-2 text-[11px] font-bold">Kobblon TDecal {i + 1}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>,
)
