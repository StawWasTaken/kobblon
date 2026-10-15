/* The reaction bar, with its tray open, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { Glyph } from '@/components/brand/Glyph'
import { faFaceSmile, faPlus } from '@fortawesome/free-solid-svg-icons'
import { Icon } from '@/components/brand/Icon'
import { FACES } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import '@/index.css'

const ON = [
  ['laugh', 12, true], ['heart-eyes', 5, false], ['skull', 2, false],
] as const

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-6 bg-ink p-10">
    <Card className="max-w-xl space-y-3 p-4">
      <p className="text-sm text-white/85">
        A post on a Community wall. The thumb is gone; these are what you say
        about it instead.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {ON.map(([face, n, mine]) => (
            <button
              key={face}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold',
                mine
                  ? 'border-brand bg-brand/15 text-white'
                  : 'border-ink-line bg-ink-raised text-white/70',
              )}
            >
              <Icon name={`reaction-${face}`} className="h-4 w-4" />
              {n}
            </button>
          ))}
          <button className="inline-flex items-center gap-1 rounded-full border border-ink-line bg-ink-raised px-2.5 py-1 text-xs text-white/60">
            <Glyph icon={faFaceSmile} />
            <Glyph icon={faPlus} className="text-[9px]" />
          </button>
        </div>
        <p className="text-xs text-muted">2 hours ago</p>
      </div>
    </Card>

    <div>
      <p className="mb-2 font-display text-xs uppercase tracking-wider text-muted">
        The tray
      </p>
      <div className="inline-flex gap-0.5 rounded-2xl border border-ink-line bg-ink-card p-1.5 shadow-pop">
        {FACES.map((face) => (
          <button
            key={face}
            className={cn(
              'grid h-9 w-9 place-items-center rounded-xl transition-transform hover:scale-110',
              face === 'laugh' && 'bg-brand/20',
            )}
          >
            <Icon name={`reaction-${face}`} className="h-6 w-6" />
          </button>
        ))}
      </div>
    </div>
  </div>,
)
