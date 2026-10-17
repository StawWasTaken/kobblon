/* The reaction bar, with its tray open, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { Icon } from '@/components/brand/Icon'
import { Reactions } from '@/components/social/Reactions'
import { Card } from '@/components/ui/Card'
import { Price } from '@/components/brand/Currency'
import '@/index.css'

const YELLOW = '#FFCC4D'

const ON = [
  ['laugh', 12, true], ['heart-eyes', 5, false], ['fire', 8, false],
  ['sad', 3, false], ['skull', 2, false], ['angry', 1, false],
] as const

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-10 bg-ink p-10">
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

    {/*
      * The tray is the component's own, opened by the shoot script pressing
      * the button - a hand-made copy of it beside the real one is how two
      * trays with different padding ended up in one screenshot.
      */}
    <div>
      <p className="mb-2 font-display text-xs uppercase tracking-wider text-muted">
        The tray, pressed open
      </p>
      <div className="pt-24">
        <Reactions what="post" which="tray" counts={[]} />
      </div>
    </div>

    <div>
      <p className="mb-2 font-display text-xs uppercase tracking-wider text-muted">
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
