/* Staw's icons, all of them, as they will be used. */
import { createRoot } from 'react-dom/client'
import { Icon, UI_ICONS, WORKSPACE_ICONS } from '@/components/brand/Icon'
import { Price } from '@/components/brand/Currency'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-8 bg-ink p-10">
    <section>
      <p className="mb-3 font-display text-xs uppercase tracking-wider text-muted">
        As drawn
      </p>
      <div className="flex flex-wrap gap-4">
        {UI_ICONS.map((one) => (
          <div key={one} className="w-24 text-center">
            <div className="grid h-16 place-items-center rounded-xl border border-ink-line bg-ink-card">
              <Icon name={one} className="h-8 w-8" />
            </div>
            <p className="mt-1 truncate text-[10px] text-muted">{one}</p>
          </div>
        ))}
      </div>
    </section>

    <section>
      <p className="mb-3 font-display text-xs uppercase tracking-wider text-muted">
        Painted, for where they sit beside words
      </p>
      <div className="flex flex-wrap gap-4 text-brand-bright">
        {UI_ICONS.slice(0, 12).map((one) => (
          <div key={one} className="grid h-16 w-16 place-items-center rounded-xl border border-ink-line bg-ink-card">
            <Icon name={one} tone="currentColor" className="h-8 w-8" />
          </div>
        ))}
      </div>
    </section>

    <section>
      <p className="mb-3 font-display text-xs uppercase tracking-wider text-muted">
        The Workspace's, which Create borrows from
      </p>
      <div className="flex flex-wrap gap-4">
        {WORKSPACE_ICONS.map((one) => (
          <div key={one} className="w-24 text-center">
            <div className="grid h-16 place-items-center rounded-xl border border-ink-line bg-ink-card">
              <Icon name={`workspace/${one}`} className="h-8 w-8" />
            </div>
            <p className="mt-1 truncate text-[10px] text-muted">{one}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="space-y-2">
      <p className="font-display text-xs uppercase tracking-wider text-muted">
        A price, with the real mark on it
      </p>
      <Price amount={1250} className="text-2xl font-bold" />
      <Price amount={60} className="text-sm" />
    </section>
  </div>,
)
