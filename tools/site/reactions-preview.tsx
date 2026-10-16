/* The reaction bar, with its tray open, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { Glyph } from '@/components/brand/Glyph'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { Icon } from '@/components/brand/Icon'
import { Reactions } from '@/components/social/Reactions'
import { FACES } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Price } from '@/components/brand/Currency'
import { cn } from '@/lib/cn'
import '@/index.css'

const YELLOW = '#FFCC4D'
const COLOUR: Record<string, string> = {
  smile: YELLOW, laugh: YELLOW, 'happy-grin': YELLOW, 'winky-grin': YELLOW,
  'heart-eyes': YELLOW, sunglasses: YELLOW, shocked: YELLOW, sad: YELLOW,
  angry: '#DF1F2D', skull: 'rgb(var(--face-bone))',
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
        <Reactions
          what="post"
          which="preview"
          counts={ON.map(([face, how_many, mine]) => ({ face, how_many, mine })) as never}
        />
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
              'grid h-14 w-14 place-items-center rounded-xl transition-transform hover:scale-110',
              face === 'laugh' && 'bg-brand/20',
            )}
          >
            <Icon name={`reaction-${face}`} tone={COLOUR[face]} className="h-10 w-10" />
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
