/*
 * Get Kobblon, proposed.
 *
 * What is wrong with the page today, beyond looking nothing like the three
 * pages beside it: **it only has half of what it is for.** It lists the
 * Launcher and nothing else, while What is Kobblon sends anybody who wants
 * to build to `/download` for Kobblon Workspace, which this page has never
 * mentioned. Two programs, one page.
 *
 * Staw, about the last version: "why are you making the download page like
 * it needs headers and presentation, its just a download page." Still
 * true, and the shape holds to it - the name of each thing, what it is
 * for, what it runs on, and the honest state of it. Nothing is a button
 * until there is a file behind it.
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

const platforms: { name: string; icon: IconDefinition; note: string }[] = [
  { name: 'Windows', icon: faWindows, note: '10 and 11' },
  { name: 'macOS', icon: faApple, note: 'Apple silicon' },
  { name: 'Linux', icon: faLinux, note: 'Debian and Arch' },
]

/** One of our faces, placed by a wrapper of our own. */
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

/**
 * One program: what it is, what it runs on, and whether it exists yet.
 *
 * The three platforms are rows rather than buttons for as long as there is
 * nothing to press - a download button with no file behind it is the fake
 * functionality this project has a rule against, and "Not yet" said three
 * times is the truth said three times.
 */
function Program({ name, what, art, who, children }: {
  name: string
  what: string
  art: string
  who: string
  children?: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card">
      <div className="relative flex flex-wrap items-center gap-5 border-b-2 border-ink-line p-6">
        <img
          src={asset(art)}
          alt=""
          aria-hidden="true"
          className="h-16 w-20 shrink-0 select-none object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-mini font-extrabold uppercase tracking-wide text-muted">{who}</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold leading-none">{name}</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{what}</p>
        </div>
        {children}
      </div>

      <ul className="divide-y-2 divide-ink-line">
        {platforms.map((one) => (
          <li key={one.name} className="flex items-center gap-4 px-6 py-3.5">
            <Glyph icon={one.icon} className="text-lg text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{one.name}</span>
              <span className="block text-xs text-muted">{one.note}</span>
            </span>
            <span className="rounded-full border-2 border-ink-line px-2.5 py-0.5 text-mini font-extrabold uppercase tracking-wide text-muted">
              Not yet
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DownloadNew() {
  return (
    <div className="min-h-screen bg-ink">
      <AtTop
        title={<>Get Kobblon.</>}
        says="Two programs: one to play Worlds, one to build them. Neither is out yet, and there is no date being guessed at here."
      >
        <Face face="smile" turn={-10} className="bottom-6 right-10 hidden sm:block" />
      </AtTop>

      <div className="mx-auto max-w-5xl space-y-4 px-5 py-12 sm:px-8">
        <Program
          who="To play"
          name="Kobblon Launcher"
          art="/about/play.webp"
          what="Worlds run in the Launcher, not in a browser tab. It is what opens when somebody presses Play."
        />

        <Program
          who="To build"
          name="Kobblon Workspace"
          art="/about/workspace.webp"
          what="Where a World is made: parts, scripts, the lot. Publish from here and the World is on the site two minutes later."
        />

        <p className="pt-2 text-sm leading-relaxed text-muted">
          Until then everything else works in the browser - make an account, make
          things for the Catalog, join a Community, write on the forum.
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
