/*
 * Get Kobblon, second drawing: two doors.
 *
 * The first was the old page with a tidier list in it - two programs
 * stacked, each over three rows of platform. Staw wanted a layout rather
 * than a tidy-up, so this is one: the two programs stand side by side as
 * full-height panels, each wearing its own app icon at the size an app
 * icon is actually seen at, with the platforms as chips across the foot
 * instead of three rows of their own.
 *
 * Each door has its own colour from the design system - brand blue for
 * the one you play in, `craft` violet for the one you build in, which is
 * the colour the system already gives the workshop - so the two are told
 * apart before a word is read.
 *
 * Staw, about an earlier version: "its just a download page." Still true.
 * There is no header, no presentation and no button with nothing behind
 * it; "Not out yet" is said plainly on both, once.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { faWindows, faApple, faLinux } from '@fortawesome/free-brands-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { FACE_COLOUR } from '@/components/social/Reactions'
import { AtTop } from '@/components/about/AtTop'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'
import '@/index.css'

const platforms: { name: string; icon: IconDefinition }[] = [
  { name: 'Windows', icon: faWindows },
  { name: 'macOS', icon: faApple },
  { name: 'Linux', icon: faLinux },
]

function Face({ face, className, turn, size = 'h-16 w-16' }: {
  face: keyof typeof FACE_COLOUR; className?: string; turn: number; size?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute select-none', className)}
      style={{ transform: `rotate(${turn}deg)` }}
    >
      <Icon name={`reaction-${face}` as 'reaction-smile'} tone={FACE_COLOUR[face]} className={size} />
    </span>
  )
}

/** One door: an app, what it is for, and what it runs on. */
function Door({ icon, name, who, what, glow, edge, children }: {
  /** The app's own icon, the one on a desktop. */
  icon: string
  name: string
  who: string
  what: string
  /** The light behind the icon, which is what tells the two doors apart. */
  glow: string
  edge: string
  children?: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border-2 border-b-4 bg-ink-card p-7 sm:p-8',
        edge,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full blur-3xl', glow)}
      />

      <div className="relative">
        <img
          src={asset(icon)}
          alt=""
          aria-hidden="true"
          className="h-20 w-20 select-none rounded-2xl shadow-lift sm:h-24 sm:w-24"
        />
        <p className="mt-6 text-mini font-extrabold uppercase tracking-[0.18em] text-muted">{who}</p>
        <h2 className="mt-1.5 font-display text-2xl font-extrabold leading-none sm:text-3xl">{name}</h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{what}</p>
      </div>

      <div className="flex-1" />

      <div className="relative mt-8">
        <div className="flex flex-wrap gap-2">
          {platforms.map((one) => (
            <span
              key={one.name}
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink-line bg-ink-raised px-3 py-1.5 text-xs font-bold text-muted"
            >
              <Glyph icon={one.icon} />
              {one.name}
            </span>
          ))}
        </div>

        {/* The state, said once, where a button would be. */}
        <p className="mt-5 flex items-center gap-2.5 border-t-2 border-ink-line pt-5 text-sm font-bold text-muted">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-warn" />
          Not out yet
        </p>
      </div>
      {children}
    </section>
  )
}

function DownloadNew() {
  return (
    <div className="min-h-screen bg-ink">
      <AtTop
        title={<>Get Kobblon.</>}
        says="Two programs: one to play Worlds, one to build them. Neither is out yet, and nobody here is guessing at a date."
      >
        <Face face="smile" turn={-10} className="bottom-6 right-10 hidden sm:block" />
      </AtTop>

      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          <Door
            icon="/brand/favicon.png"
            who="To play"
            name="Kobblon Launcher"
            what="Worlds run in the Launcher, not in a browser tab. It is what opens when somebody presses Play, and it is how you end up in one with your friends."
            glow="bg-brand/35"
            edge="border-ink-line"
          />
          <Door
            icon="/brand/favicon-create.png"
            who="To build"
            name="Kobblon Workspace"
            what="Where a World is made: parts, scripts, sounds, the lot. Publish from here and the World is on the site two minutes later."
            glow="bg-craft/30"
            edge="border-ink-line"
          />
        </div>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          Until they are out, everything else works in the browser: make an account,
          make things for the Catalog, join a Community, write on the forum.
        </p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <DownloadNew />
  </MemoryRouter>,
)
