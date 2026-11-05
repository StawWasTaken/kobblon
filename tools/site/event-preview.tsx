/*
 * The band across the top of Home, in all three of its art themes, and the
 * staff panel that writes one.
 *
 * Not a second implementation: it imports `EventBand` and `EventSection`
 * themselves. The point is to see them without a superadmin account and
 * without a database - the panel's read fails here and that is part of what
 * is being looked at, because "nothing is up" is the state Home is in the
 * moment somebody takes the band down.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { EventBand } from '@/components/home/EventBanner'
import { EventSection } from '@/pages/Admin'
import { EVENT_THEMES, type EventTheme } from '@/lib/event'
import '@/index.css'

const words = {
  tag: 'Avatar contest',
  name: 'Halloween 2026',
  blurb: 'Put together the best Halloween avatar you can and post it. The three best take Brix.',
  action: 'Enter the contest',
  prizes: [
    { place: '1st', brix: 10_000 },
    { place: '2nd', brix: 5_000 },
    { place: '3rd', brix: 2_500 },
  ],
}

function Page() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      {(Object.keys(EVENT_THEMES) as EventTheme[]).map((theme) => (
        <section key={theme} className="space-y-2">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-muted">
            {EVENT_THEMES[theme].label}
          </h2>
          <EventBand event={{ ...words, theme }} flat />
        </section>
      ))}

      {/* One with no prizes and no line under the name, which is the other
          shape the band has to hold. */}
      <section className="space-y-2">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          Nothing to win, nothing to say
        </h2>
        <EventBand
          event={{ tag: 'Event', name: 'The Kobblon Winter Show', blurb: '', action: 'Come along', theme: 'kobblon', prizes: [] }}
          flat
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          The staff panel, with no database behind it
        </h2>
        <EventSection />
      </section>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <Page />
    </ToastProvider>
  </MemoryRouter>,
)
