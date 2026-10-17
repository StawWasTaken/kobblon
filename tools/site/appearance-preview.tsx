/*
 * The three appearances side by side, with nothing around them.
 *
 * The chrome, the marks and the backdrop are all chosen by CSS off
 * `data-appearance`, so this page sets the attribute by hand and never
 * touches the provider - which is also the check that the provider is not
 * load-bearing. If a mark or a backdrop ever grows a hook, this page goes
 * blank and says so before the Workspace does.
 */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { Wordmark } from '@/components/brand/Wordmark'
import { Studio } from '@/components/avatar/Studio'
import { LOOKS, APPEARANCES } from '@/lib/appearances'
import { Button } from '@/components/ui/Button'
import { ToastProvider } from '@/components/ui/Toast'
import { ClaimAppearance } from '@/components/brand/ClaimAppearance'
import { Appearances } from '@/pages/Settings'
import { AppearancePreview } from '@/components/brand/AppearancePreview'
import { Weather } from '@/components/brand/Weather'
import { AppearanceProvider } from '@/hooks/useAppearance'
import '@/index.css'

function Bar({ look }: { look: string }) {
  return (
    <div data-appearance={look} className="overflow-hidden rounded-2xl border border-ink-line">
      <div className="flex items-center gap-3 bg-chrome px-4 py-3">
        {/* The bar as it actually is: the name, which becomes the mark on
            its own when the bar is too narrow for it. */}
        <Wordmark to={null} className="h-5" />
        <span className="ml-auto rounded-full bg-field px-3 py-1.5 text-xs text-onbrand/70">
          Search Kobblon
        </span>
      </div>
      <div className="flex">
        <div className="w-40 space-y-1 bg-chrome p-3">
          {['Home', 'Discover', 'Create', 'Communities'].map((item, at) => (
            <p
              key={item}
              className={at === 0
                ? 'rounded-xl bg-brand px-3 py-2 text-sm font-bold text-white'
                : 'rounded-xl px-3 py-2 text-sm font-bold text-onbrand/75'}
            >
              {item}
            </p>
          ))}
        </div>
        <div className="flex-1 space-y-3 bg-ink p-4">
          <p className="font-display text-lg font-extrabold">{LOOKS[look as 'default'].name}</p>
          <p className="text-sm text-muted">{LOOKS[look as 'default'].note}</p>
          <div className="flex gap-2">
            <Button>Play</Button>
            <Button variant="subtle">Later</Button>
          </div>
          <Studio className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

function Page() {
  const [light, setLight] = useState(false)
  document.documentElement.dataset.theme = light ? 'light' : 'dark'

  return (
    <div className="min-h-screen space-y-6 bg-ink p-8">
      <button
        onClick={() => setLight((was) => !was)}
        className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white"
      >
        {light ? 'Dark' : 'Light'}
      </button>
      {/* The little drawing of the page that Settings offers one with. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {APPEARANCES.map((look) => (
          <AppearancePreview key={look} which={look} className="rounded-xl border border-ink-line" />
        ))}
      </div>

      {APPEARANCES.map((look) => <Bar key={look} look={look} />)}

      {/* The Settings card, signed out, which is the state that shows
          what somebody who has claimed nothing is told. */}
      <ToastProvider>
        <AppearanceProvider>
          <div className="max-w-2xl"><Appearances /></div>
          {/* What falls, in both seasons, side by side. */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div data-appearance="christmas" className="relative h-64 overflow-hidden rounded-2xl bg-chrome">
              <Weather falling="snow" className="pointer-events-none absolute inset-0 overflow-hidden" />
            </div>
            <div data-appearance="halloween" className="relative h-64 overflow-hidden rounded-2xl bg-chrome">
              <Weather falling="leaves" className="pointer-events-none absolute inset-0 overflow-hidden" />
            </div>
          </div>
        </AppearanceProvider>
        <ClaimAppearance offer="halloween" />
      </ToastProvider>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
