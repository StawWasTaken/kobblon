import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight, faPlay } from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import { cn } from '@/lib/cn'

export type Shot = { id: string; kind: 'image' | 'video'; url: string }

/**
 * What a World shows of itself.
 *
 * The emblem first, then whatever else it has, and one of them may be a
 * clip: a World that moves is better sold by something that moves. A video
 * is not autoplayed, because a page that starts making a noise on its own is
 * a page people close.
 */
export function WorldGallery({ shots, name }: { shots: Shot[]; name: string }) {
  const [at, setAt] = useState(0)
  const many = shots.length > 1
  const here = shots[Math.min(at, shots.length - 1)]

  const step = (by: number) => setAt((i) => (i + by + shots.length) % shots.length)

  if (!here) {
    return (
      <div className="grid aspect-[16/9] place-items-center rounded-xl border border-ink-line bg-media">
        <div className="text-center">
          <FontAwesomeIcon icon={worldIcon} className="text-3xl text-white/25" />
          <p className="mt-3 text-sm text-muted">Nothing to show of this World yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="group relative aspect-[16/9] overflow-hidden rounded-xl border border-ink-line bg-media">
        {here.kind === 'video' ? (
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

        {many && ([-1, 1] as const).map((by) => (
          <button
            key={by}
            onClick={() => step(by)}
            aria-label={by === -1 ? 'Previous picture' : 'Next picture'}
            className={cn(
              'absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full',
              'bg-black/55 text-white backdrop-blur-sm transition-all duration-200',
              'hover:bg-black/80 focus-visible:opacity-100',
              'opacity-0 group-hover:opacity-100',
              by === -1 ? 'left-3' : 'right-3',
            )}
          >
            <FontAwesomeIcon icon={by === -1 ? faChevronLeft : faChevronRight} />
          </button>
        ))}
      </div>

      {many && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {shots.map((shot, i) => (
            <button
              key={shot.id}
              onClick={() => setAt(i)}
              aria-label={`Show picture ${i + 1}`}
              aria-current={i === at}
              className={cn(
                'relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border transition-colors',
                i === at ? 'border-brand-bright' : 'border-ink-line hover:border-white/30',
              )}
            >
              {shot.kind === 'video' ? (
                <span className="grid h-full w-full place-items-center bg-media text-white/70">
                  <FontAwesomeIcon icon={faPlay} className="text-xs" />
                </span>
              ) : (
                <img src={shot.url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
