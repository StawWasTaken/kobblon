/* The reaction bar, with its tray open, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { Glyph } from '@/components/brand/Glyph'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { Icon } from '@/components/brand/Icon'
import { FACES } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Price } from '@/components/brand/Currency'
import { cn } from '@/lib/cn'
import '@/index.css'

const YELLOW = '#FFCC4D'
const COLOUR: Record<string, string> = {
  smile: YELLOW, laugh: YELLOW, 'happy-grin': YELLOW, 'winky-grin': YELLOW,
  'heart-eyes': YELLOW, sunglasses: YELLOW, shocked: YELLOW, sad: YELLOW,
  angry: '#DF1F2D', skull: '#E6E7E8',
}

const ON = [
  ['laugh', 12, true], ['heart-eyes', 5, false], ['skull', 2, false],
  ['angry', 1, false],
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
                'inline-flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2.5 text-sm font-bold',
                mine
                  ? 'border-brand bg-brand/15 text-white'
                  : 'border-ink-line bg-ink-raised text-white/70',
              )}
            >
              <Icon
                name={`reaction-${face}`}
                tone={mine ? COLOUR[face] : undefined}
                className="h-5 w-5"
              />
              {n}
            </button>
          ))}
          <button className="inline-flex items-center gap-0.5 rounded-full border border-ink-line bg-ink-raised py-1 pl-1.5 pr-2 text-white/60">
            <Icon name="reaction-smile" tone={YELLOW} className="h-5 w-5" />
            <Glyph icon={faPlus} className="text-[10px]" />
          </button>
        </div>
        <p className="text-xs text-muted">2 hours ago</p>
      </div>
    </Card>

    <div>
      <p className="mb-2 font-display text-xs uppercase tracking-wider text-muted">
        The tray
      </p>
      <div className="inline-flex gap-1 rounded-2xl border border-ink-line bg-ink-card p-2 shadow-pop">
        {FACES.map((face) => (
          <button
            key={face}
            className={cn(
              'grid h-11 w-11 place-items-center rounded-xl transition-transform hover:scale-110',
              face === 'laugh' && 'bg-brand/20',
            )}
          >
            <Icon name={`reaction-${face}`} tone={COLOUR[face]} className="h-8 w-8" />
          </button>
        ))}
      </div>

      <p className="mb-2 mt-8 font-display text-xs uppercase tracking-wider text-muted">
        On a light card, where the white ones used to vanish
      </p>
      <div className="inline-flex items-center gap-4 rounded-2xl bg-white p-4 text-ink">
        <Price amount={1250} className="text-lg font-bold" />
        <Icon name="users" className="h-6 w-6" />
        <Icon name="notification" className="h-6 w-6" />
        <Icon name="report" className="h-6 w-6" />
        <Icon name="reaction-smile" tone={YELLOW} className="h-6 w-6" />
      </div>
    </div>
  </div>,
)
