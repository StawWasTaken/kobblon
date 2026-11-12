import { useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faChevronLeft, faChevronRight, faPlay } from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import { cn } from '@/lib/cn'

export type Shot = { id: string; kind: 'image' | 'video'; url: string }

/**
 * A World, shown the size it deserves.
 *
 * The old version of this was a 16/9 card with the page arranged around it,
 * which makes a World look like an entry in a list of Worlds. This is the
 * World as the stage: the picture runs the width of the page, and whatever
 * the page wants said about it sits on the art itself, over a gradient dark
 * enough to read white off.
 *
 * White here is `on-art`, not `white`: `white` is the theme's foreground
 * and turns near-black in daylight, while the photograph under it does
 * not change at all. The World's own name went unreadable on its own
 * banner the moment somebody turned the lights on.
 *
 * A clip is never autoplayed - a page that starts making a noise on its own
 * is a page people close - and while one is on screen the overlay steps out
 * of the way, because controls on top of controls is neither.
 *
 * Props only. No router, no provider, no page: the Workspace can mount it.
 */
export function WorldStage({
  shots, name, children,
}: {
  shots: Shot[]
  name: string
  /** What the page wants said over the art. */
  children?: React.ReactNode
}) {
  const [at, setAt] = useState(0)
  const many = shots.length > 1
  const here = shots[Math.min(at, shots.length - 1)]
  const step = (by: number) => setAt((i) => (i + by + shots.length) % shots.length)

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-media">
      <div className="group relative aspect-[16/10] sm:aspect-[2/1] lg:aspect-[21/8]">
        {!here ? (
          <div className="grid h-full w-full place-items-center">
            <div className="text-center">
              <Glyph icon={worldIcon} className="text-4xl text-on-art/20" />
              <p className="mt-3 text-sm text-muted">Nothing to show of this World yet.</p>
            </div>
          </div>
        ) : here.kind === 'video' ? (
          <video
            key={here.id}
            src={here.url}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <img src={here.url} alt={name} className="h-full w-full object-cover" />
        )}

        {/* Dark enough at the foot to read a name off, clear at the top so
            the picture is still the picture. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5" />

        {many && here?.kind !== 'video' && ([-1, 1] as const).map((by) => (
          <button
            key={by}
            onClick={() => step(by)}
            aria-label={by === -1 ? 'Previous picture' : 'Next picture'}
            className={cn(
              'absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full',
              'bg-black/50 text-on-art backdrop-blur-sm transition-all duration-200',
              'opacity-0 hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100',
              by === -1 ? 'left-3' : 'right-3',
            )}
          >
            <Glyph icon={by === -1 ? faChevronLeft : faChevronRight} />
          </button>
        ))}

        {/* The rest of what there is, small, on the art, top right - so the
            foot of the stage belongs to the World's name and nothing else. */}
        {many && (
          <div className="absolute right-3 top-3 flex max-w-[60%] gap-1.5 overflow-x-auto">
            {shots.map((shot, i) => (
              <button
                key={shot.id}
                onClick={() => setAt(i)}
                aria-label={`Show picture ${i + 1}`}
                aria-current={i === at}
                className={cn(
                  'h-10 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                  i === at
                    ? 'border-on-art shadow-pop'
                    : 'border-on-art/25 opacity-70 hover:opacity-100',
                )}
              >
                {shot.kind === 'video' ? (
                  <span className="grid h-full w-full place-items-center bg-black/60 text-on-art/80">
                    <Glyph icon={faPlay} className="text-tiny" />
                  </span>
                ) : (
                  <img src={shot.url} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}

        {children && here?.kind !== 'video' && (
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">{children}</div>
        )}
      </div>

      {/* With a clip on screen the overlay cannot sit on it, so it sits under
          it rather than disappearing. */}
      {children && here?.kind === 'video' && (
        <div className="border-t border-ink-line bg-ink-card p-4 sm:p-6">{children}</div>
      )}
    </div>
  )
}
