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

      {/* The corner holding a line instead of three prize chips, which is
          what a band that is not a contest does with it. */}
      <section className="space-y-2">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          A line of small print instead of prizes
        </h2>
        <EventBand
          event={{
            tag: 'Event', name: 'The Kobblon Winter Show',
            blurb: 'A week of what everybody built this year.',
            action: 'Come along', theme: 'christmas', prizes: [],
            note: 'Until the 24th of December',
          }}
          flat
        />
      </section>

      {/* Prizes and a note at once, which is the case the band used to
          drop: the note was guarded on there being no prizes, so a line
          typed in the console vanished the moment a prize was added. */}
      <section className="space-y-2">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          Prizes and a line of small print
        </h2>
        <EventBand
          event={{ ...words, theme: 'halloween', note: 'Open to everybody, until the 31st' }}
          flat
        />
      </section>

      {/* Its own art, its own background and its own colour - the three
          things a superadmin can upload over the theme. */}
      <section className="space-y-2">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          Pictures of its own
        </h2>
        <EventBand
          event={{
            tag: 'Event', name: 'Kobblon is free',
            blurb: 'It always was, and this is the band saying so with its own art.',
            action: 'Have a look', theme: 'kobblon', prizes: [],
            art_url: '/brand/kobby.png',
            back_url: '/brand/landing-towers.webp',
            note: 'Its own picture, behind and in front',
          }}
          flat
        />
      </section>

      {/* The case that caught us out: an uploaded picture that is wide
          rather than a tall mark with air round it. Drawn in the mark's
          slot it covered the whole band and sat on its own heading. */}
      <section className="space-y-2">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          A wide picture of its own
        </h2>
        <EventBand
          event={{
            tag: 'V3.5', name: '3.5 is live',
            blurb: 'Grab a drink and read what landed.',
            action: 'Have a look', theme: 'kobblon', prizes: [],
            art_url: '/brand/landing-towers.webp',
            note: 'A wide one, kept to its own half',
          }}
          flat
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          A colour of its own, and the theme's mark
        </h2>
        <EventBand
          event={{
            tag: 'Event', name: 'A colour under it',
            blurb: '', action: 'Have a look', theme: 'kobblon', prizes: [],
            back_colour: '#2a0f3d',
          }}
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
