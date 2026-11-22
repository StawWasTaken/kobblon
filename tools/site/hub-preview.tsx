/*
 * The Creator Hub, proposed rather than shipped. One page at a time.
 *
 * `?page=overview|worlds|uploads|marketplace|avatar|inventory|ads|analytics`
 *
 * What the redesign is: the Hub's eight pages are eight different pages
 * today - one opens with a hero, one with five number tiles, one with a
 * plain heading, one with a form. This gives all eight the same four
 * shapes, the ones Settings was approved on, so moving between them feels
 * like one place:
 *
 *   HubRail   one card down the left, the room you are in in Kobblon blue
 *   HubTop    a mark tile, the name in the pixel face, a lead, the action
 *   Stat      a number with its mark and the lip, in a strip
 *   Sheet     one card per section, rows separated by rules, never nested
 *   Chip      a filter with the lip, chosen one in blue
 *
 * Nothing invented: every row, number, filter and button below exists on
 * the live page it is drawn from.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faChartSimple, faGaugeHigh, faBoxOpen, faShapes, faUpload, faShirt,
  faRectangleAd, faCircleCheck, faCircleXmark, faClock, faHardDrive,
  faFileArrowDown, faEllipsis, faMagnifyingGlass, faPlus, faEye,
  faHandPointer, faHourglassHalf, faTableCellsLarge, faList, faPen,
  faChevronRight, faStore, faBoxArchive, faRotateRight, faStop,
  faTrash, faGear, faArrowUpRightFromSquare, faImage, faMusic,
  faCube, faFont, faVideo, faPuzzlePiece, faThumbsUp,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Button } from '@/components/ui/Button'
import { worldIcon } from '@/lib/naming'
import { DEFAULT_WORLD_EMBLEM, DEFAULT_WORLD_THUMBNAIL } from '@/lib/worldart'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import '@/index.css'

type Key = 'overview' | 'worlds' | 'uploads' | 'marketplace' | 'avatar' | 'inventory' | 'ads' | 'analytics'

const GROUPS: { head: string; rooms: { key: Key; label: string; icon: IconDefinition; note: string; count?: number }[] }[] = [
  {
    head: 'What you have made',
    rooms: [
      { key: 'overview', label: 'Overview', icon: faGaugeHigh, note: 'Everything at a glance' },
      { key: 'worlds', label: 'My Worlds', icon: worldIcon, note: 'The Worlds you build', count: 3 },
      { key: 'uploads', label: 'My Uploads', icon: faUpload, note: 'What you have put in', count: 24 },
      { key: 'avatar', label: 'Things to Wear', icon: faShirt, note: 'For the Catalog', count: 7 },
    ],
  },
  {
    head: 'What you build with',
    rooms: [
      { key: 'marketplace', label: 'Marketplace', icon: faShapes, note: 'Anything anybody has made' },
      { key: 'inventory', label: 'Inventory', icon: faBoxOpen, note: 'Everything you own', count: 61 },
    ],
  },
  {
    head: 'How it is doing',
    rooms: [
      { key: 'ads', label: 'Ads', icon: faRectangleAd, note: 'Your work, in front of people', count: 2 },
      { key: 'analytics', label: 'Analytics', icon: faChartSimple, note: 'Views and uses, counted' },
    ],
  },
]

/* ------------------------------------------------------------- the shapes */

/*
 * The rooms of the Hub.
 *
 * Staw: "instead of making it into something like in settings, id like to
 * keep a sidebar like in communities" - so it is the Communities rail's
 * shape, flush against the page with a rule down its right rather than a
 * card floating in the margin: a heading, a search, headings over groups,
 * and a row that is a picture, a name and a second line.
 */
function HubRail({ here, go }: { here: Key; go: (k: Key) => void }) {
  return (
    <aside
      aria-label="Creator Hub"
      className="hidden w-72 shrink-0 flex-col self-stretch border-r border-ink-line px-3 pb-6 pt-4 lg:flex"
    >
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="font-display text-base font-extrabold">Creator Hub</h2>
        <button className="text-xs font-bold text-link hover:underline">Get Workspace</button>
      </div>

      {/* Who you are building as, which decides what every page below holds. */}
      <button
        type="button"
        className="mb-3 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-ink-hover"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-ink text-xs font-extrabold text-brand-bright">
          SW
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-link">@staw</span>
          <span className="block text-xs text-muted">Building as yourself</span>
        </span>
        <Glyph icon={faChevronRight} className="text-tiny text-muted" />
      </button>

      {GROUPS.map((group) => (
        <div key={group.head}>
          <p className="px-2 pb-1 pt-3 font-display text-tiny uppercase tracking-wider text-muted">
            {group.head}
          </p>
          {group.rooms.map((room) => {
            const on = room.key === here
            return (
              <button
                key={room.key}
                type="button"
                onClick={() => go(room.key)}
                aria-current={on}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                  on ? 'bg-brand/20' : 'hover:bg-ink-hover',
                )}
              >
                <span className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                  on ? 'bg-brand text-on-art' : 'bg-ink-raised text-brand-bright',
                )}>
                  <Glyph icon={room.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm font-bold', on ? 'text-white' : 'text-link')}>
                    {room.label}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {room.count !== undefined ? `${room.count} · ${room.note}` : room.note}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </aside>
  )
}

/** The name of the page, its mark, what it is for, and the one thing to do. */
function HubTop({ icon, title, lead, action }: {
  icon: IconDefinition
  title: string
  lead: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised text-lg text-brand-bright">
          <Glyph icon={icon} />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold leading-none sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-snug text-muted">{lead}</p>
        </div>
      </div>
      {action}
    </header>
  )
}

/** One number, with its mark and the lip. */
function Stat({ icon, label, value, tone, note }: {
  icon: IconDefinition
  label: string
  value: string
  tone?: string
  note?: string
}) {
  return (
    <div className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card px-4 py-3">
      <p className="flex items-center gap-1.5 text-mini font-extrabold uppercase tracking-wide text-muted">
        <Glyph icon={icon} className={tone ?? 'text-brand-bright'} />
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{value}</p>
      {note && <p className="text-mini leading-snug text-muted">{note}</p>}
    </div>
  )
}

/** A few words over the rows they belong to, a rule, and a way to the rest. */
function Head({ children, all }: { children: React.ReactNode; all?: string }) {
  return (
    <div className="flex items-center gap-3 pb-2">
      <h2 className="shrink-0 font-display text-tiny font-extrabold uppercase tracking-[0.18em] text-white/40">
        {children}
      </h2>
      <span className="h-px flex-1 bg-ink-line" />
      {all && (
        <button type="button" className="shrink-0 text-xs font-bold text-link hover:underline">{all}</button>
      )}
    </div>
  )
}

/** One card per section. Rows inside are separated by rules, not by cards. */
function Sheet({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card', className)}>
      {children}
    </div>
  )
}

/** A filter, with the lip; the chosen one in Kobblon blue. */
function Chip({ on, icon, children, onClick }: {
  on: boolean
  icon?: IconDefinition
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'kob-press inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border-2 px-3 text-xs font-extrabold transition-colors',
        on
          ? 'border-brand-deep border-b-4 bg-brand text-on-art'
          : 'border-ink-line border-b-4 bg-ink-card text-white/70 hover:border-brand/50 hover:text-white',
      )}
    >
      {icon && <Glyph icon={icon} className="text-tiny" />}
      {children}
    </button>
  )
}

/** The search box, the same one on every page of the Hub that has one. */
function Hunt({ placeholder, wide }: { placeholder: string; wide?: boolean }) {
  return (
    <div className={cn('relative', wide ? 'flex-1' : 'min-w-[16rem] flex-1')}>
      <Glyph
        icon={faMagnifyingGlass}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
      />
      <input
        readOnly
        placeholder={placeholder}
        className={cn(
          'w-full rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised pl-11 pr-4 font-semibold placeholder:font-normal placeholder:text-white/30 focus:border-brand-bright focus:outline-none',
          wide ? 'h-14 text-base' : 'h-11 text-sm',
        )}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ parts */

const day = 864e5
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

const KIND_ICON: Record<string, IconDefinition> = {
  Decal: faImage, Sound: faMusic, Video: faVideo, Font: faFont, Model: faCube, Build: faPuzzlePiece,
}

/** A square of World art, or an upload's picture, at a size that fits a row. */
function Tile({ src, size = 'md', children }: {
  src?: string
  size?: 'sm' | 'md'
  children?: React.ReactNode
}) {
  return (
    <span className={cn(
      'grid shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-ink-line bg-brand-ink',
      size === 'sm' ? 'h-10 w-10' : 'h-14 w-14',
    )}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : children}
    </span>
  )
}

/** Out in the world, said in the colour Kobblon says alive in. */
function Live() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-space/15 px-2 py-0.5 text-mini font-extrabold uppercase tracking-wide text-space-bright">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-space-bright" />
      Live
    </span>
  )
}

function Flag({ tone, icon, children }: { tone: string; icon: IconDefinition; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-mini font-extrabold uppercase tracking-wide', tone)}>
      <Glyph icon={icon} className="text-tiny" />
      {children}
    </span>
  )
}

/** A rule-separated row inside a Sheet. */
function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'flex items-center gap-3 border-b border-ink-line px-4 py-3 transition-colors last:border-0 hover:bg-ink-hover',
      className,
    )}>
      {children}
    </div>
  )
}

/* --------------------------------------------------------------- overview */

const WORLDS = [
  { name: 'Tower of Doom', tag: 'WLD-10244', live: true, visits: 1284000, likes: 24100, saved: ago(2 * day), players: 412 },
  { name: 'Kobville', tag: 'WLD-10889', live: true, visits: 940, likes: 61, saved: ago(20 * 60000), players: 3 },
  { name: 'Obby of a thousand doors', tag: null, live: false, visits: 0, likes: 0, saved: ago(9 * day), players: 0 },
]

const UPLOADS = [
  { name: 'Brick wall, red', kind: 'Decal', tag: 'DCL-88120', live: true, when: '2 days ago', taken: 1240 },
  { name: 'Footstep, gravel', kind: 'Sound', tag: 'SND-41007', live: true, when: '2 days ago', taken: 318 },
  { name: 'Lamp post', kind: 'Model', tag: 'MDL-7741', live: false, when: '5 hours ago', taken: 0 },
  { name: 'Kobblon Pixel', kind: 'Font', tag: 'FNT-1120', live: true, when: 'last week', taken: 86 },
]

function Overview() {
  return (
    <div className="space-y-7">
      <HubTop
        icon={faGaugeHigh}
        title="Creator Hub"
        lead="Everything you have made, and everything you are allowed to build with."
        action={<Button icon={faUpload}>Upload</Button>}
      />

      {/*
        * The numbers were a side panel you had to look for and five tiles
        * that opened the page. They are a strip now: read in one pass,
        * above the work rather than instead of it.
        */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Stat icon={worldIcon} label="Worlds" value="3" note="1 not published" />
        <Stat icon={faEye} label="Visits" value={formatCount(1284940)} />
        <Stat icon={faUpload} label="Uploads" value="24" note="2 in review" />
        <Stat icon={faHandPointer} label="Uses" value={formatCount(5610)} />
        <Stat icon={faBoxOpen} label="Owned" value="61" note="Yours to build with" />
      </div>

      <section>
        <Head all="All my Worlds">What you are building</Head>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {WORLDS.map((world) => (
            <article key={world.name} className="overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card">
              <div className="relative aspect-video bg-brand-ink">
                <img src={DEFAULT_WORLD_THUMBNAIL} alt="" className="h-full w-full object-cover" />
                <span className="absolute left-2 top-2">{world.live ? <Live /> : (
                  <Flag tone="bg-ink/80 text-white/60" icon={faPen}>Draft</Flag>
                )}</span>
                {world.players > 0 && (
                  <span className="absolute bottom-2 right-2 rounded-lg bg-ink/85 px-2 py-0.5 text-mini font-extrabold tabular-nums">
                    {formatCount(world.players)} playing
                  </span>
                )}
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate font-display text-base font-extrabold">{world.name}</p>
                <p className="font-mono text-mini text-muted">{world.tag ?? 'No number yet'}</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <Button size="sm" variant="subtle" icon={faGear} className="flex-1">Set it up</Button>
                  <Button size="sm" variant="ghost" icon={faArrowUpRightFromSquare}>Open</Button>
                  <button className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/45 hover:bg-ink-hover hover:text-white">
                    <Glyph icon={faEllipsis} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <Head all="All uploads">Latest uploads</Head>
        <Sheet>
          {UPLOADS.map((one) => (
            <Row key={one.tag}>
              <Tile size="sm"><Glyph icon={KIND_ICON[one.kind]} className="text-brand-bright" /></Tile>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{one.name}</span>
                <span className="block truncate font-mono text-mini text-muted">{one.tag} · {one.when}</span>
              </span>
              <span className="hidden text-right text-xs tabular-nums text-muted sm:block">
                {formatCount(one.taken)} taken
              </span>
              {one.live
                ? <Flag tone="bg-space/15 text-space-bright" icon={faCircleCheck}>Live</Flag>
                : <Flag tone="bg-warn/15 text-warn-bright" icon={faClock}>In review</Flag>}
              <Glyph icon={faChevronRight} className="text-xs text-muted" />
            </Row>
          ))}
        </Sheet>
      </section>

      {/* The two shelves that are not yours: what you can take, and what you
          have taken. One row each, because neither is a number. */}
      <section>
        <Head>Where to get more</Head>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: faShapes, title: 'Marketplace', note: 'Everything anybody on Kobblon has put up to be built with, free and paid.', act: 'Open it' },
            { icon: faBoxOpen, title: 'Inventory', note: '61 things you own, from the Marketplace and your own uploads.', act: 'Open it' },
          ].map((one) => (
            <div key={one.title} className="flex items-start gap-3 rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-ink-line bg-ink-raised text-brand-bright">
                <Glyph icon={one.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-extrabold">{one.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted">{one.note}</p>
              </div>
              <Button size="sm" variant="subtle">{one.act}</Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ----------------------------------------------------------------- worlds */

function Worlds() {
  const [shelf, setShelf] = useState('In use')
  return (
    <div className="space-y-5">
      <HubTop
        icon={worldIcon}
        title="My Worlds"
        lead="Built in Kobblon Workspace, played in the Launcher, and set up here or there."
        action={<Button variant="subtle" icon={faArrowUpRightFromSquare}>Get Workspace</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        {['In use', 'Published', 'Drafts', 'Archived'].map((one) => (
          <Chip key={one} on={shelf === one} onClick={() => setShelf(one)}>{one}</Chip>
        ))}
      </div>

      <Sheet>
        {WORLDS.map((world) => (
          <Row key={world.name} className="py-3.5">
            <Tile src={DEFAULT_WORLD_EMBLEM} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-extrabold">{world.name}</span>
                {world.live ? <Live /> : <Flag tone="bg-ink-raised text-white/55" icon={faPen}>Draft</Flag>}
              </span>
              <span className="mt-0.5 block truncate font-mono text-mini text-muted">
                {world.tag ?? 'No number yet'}
              </span>
              {/* The same six things Workspace shows in its own list, in the
                  same order and from the same my_worlds(). */}
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-mini font-bold text-muted">
                <span className="inline-flex items-center gap-1"><Glyph icon={faEye} />{formatCount(world.visits)} visits</span>
                <span className="inline-flex items-center gap-1"><Glyph icon={faThumbsUp} on />{formatCount(world.likes)} likes</span>
                <span className="inline-flex items-center gap-1"><Glyph icon={faClock} />saved 2 days ago</span>
              </span>
            </span>
            <Button size="sm" variant="subtle" icon={faGear}>Set it up</Button>
            <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/45 hover:bg-ink-hover hover:text-white">
              <Glyph icon={faEllipsis} />
            </button>
          </Row>
        ))}
      </Sheet>
    </div>
  )
}

/* ---------------------------------------------------------------- uploads */

const MORE_UPLOADS = [
  ...UPLOADS,
  { name: 'Door creak', kind: 'Sound', tag: 'SND-41055', live: true, when: 'last week', taken: 12 },
  { name: 'Crate, wooden', kind: 'Model', tag: 'MDL-7799', live: true, when: 'last week', taken: 402 },
  { name: 'Title card', kind: 'Video', tag: 'VID-2201', live: false, when: 'yesterday', taken: 0 },
  { name: 'Grass, tall', kind: 'Decal', tag: 'DCL-88155', live: true, when: '3 weeks ago', taken: 2810 },
]

function Uploads() {
  const [kind, setKind] = useState('Everything')
  const [state, setState] = useState('Any state')
  const [grid, setGrid] = useState(true)
  return (
    <div className="space-y-5">
      <HubTop
        icon={faUpload}
        title="My Uploads"
        lead="Everything you have put into the Creator Hub, with its number and where it stands. Open one to rename it, list it, or see who is asking to use it."
        action={<Button icon={faUpload}>Upload</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat icon={faCircleCheck} tone="text-space-bright" label="Live" value="19" />
        <Stat icon={faClock} tone="text-warn-bright" label="In review" value="2" />
        <Stat icon={faCircleXmark} tone="text-danger" label="Turned down" value="3" />
        <Stat icon={faHardDrive} label="Room used" value="412 MB" />
        <Stat icon={faFileArrowDown} label="Taken" value={formatCount(4878)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Hunt placeholder="Search by name or number" />
        <div className="flex shrink-0 items-center gap-1 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-1">
          {[
            { on: grid, icon: faTableCellsLarge, act: () => setGrid(true) },
            { on: !grid, icon: faList, act: () => setGrid(false) },
          ].map((one, i) => (
            <button
              key={i}
              onClick={one.act}
              aria-pressed={one.on}
              className={cn(
                'grid h-7 w-8 place-items-center rounded-lg text-xs transition-colors',
                one.on ? 'bg-brand text-on-art' : 'text-white/45 hover:text-white',
              )}
            >
              <Glyph icon={one.icon} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {['Everything', 'Decals', 'Sounds', 'Video', 'Fonts', 'Models', 'Builds'].map((one) => (
          <Chip key={one} on={kind === one} onClick={() => setKind(one)}>{one}</Chip>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-ink-line sm:block" />
        {['Any state', 'Live', 'In review', 'Turned down'].map((one) => (
          <Chip key={one} on={state === one} onClick={() => setState(one)}>{one}</Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {MORE_UPLOADS.map((one) => (
          <article key={one.tag} className="overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card transition-colors hover:border-brand/50">
            <div className="relative grid aspect-[4/3] place-items-center bg-ink-raised">
              <Glyph icon={KIND_ICON[one.kind]} className="text-3xl text-white/15" />
              <span className="absolute left-2 top-2">
                {one.live
                  ? <Flag tone="bg-ink/85 text-space-bright" icon={faCircleCheck}>Live</Flag>
                  : <Flag tone="bg-ink/85 text-warn-bright" icon={faClock}>In review</Flag>}
              </span>
            </div>
            <div className="space-y-1 border-t-2 border-ink-line p-3">
              <p className="truncate text-sm font-extrabold">{one.name}</p>
              <p className="truncate font-mono text-mini text-muted">{one.tag}</p>
              <p className="flex items-center justify-between pt-1 text-mini font-bold text-muted">
                <span>{one.kind}</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Glyph icon={faFileArrowDown} />{formatCount(one.taken)}
                </span>
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ marketplace */

const MARKET = [
  { name: 'Cobblestone', kind: 'Decal', by: 'kobblon', price: 0, used: 18200, official: true, tag: 'DCL-90009' },
  { name: 'Medieval door', kind: 'Model', by: 'kobblon', price: 0, used: 9400, official: true, tag: 'MDL-90010' },
  { name: 'Rain loop', kind: 'Sound', by: 'mira', price: 25, used: 3100, tag: 'SND-90011' },
  { name: 'Neon sign set', kind: 'Decal', by: 'volt', price: 40, used: 880, tag: 'DCL-90012' },
  { name: 'Pixel face font', kind: 'Font', by: 'kobblon', price: 0, used: 7700, official: true, tag: 'FNT-90013' },
  { name: 'Market stall', kind: 'Model', by: 'jun', price: 60, used: 240, tag: 'MDL-90014' },
  { name: 'Water splash', kind: 'Sound', by: 'mira', price: 0, used: 5100, tag: 'SND-90015' },
  { name: 'Grass blades', kind: 'Decal', by: 'tam', price: 10, used: 1900, tag: 'DCL-90016' },
  { name: 'Lamp, hanging', kind: 'Model', by: 'volt', price: 30, used: 610, tag: 'MDL-90017' },
  { name: 'Title sting', kind: 'Video', by: 'jun', price: 50, used: 90, tag: 'VID-90018' },
]

function Market() {
  const [kind, setKind] = useState('Everything')
  const [by, setBy] = useState('Anybody')
  return (
    <div className="space-y-6">
      <HubTop
        icon={faShapes}
        title="Creator Marketplace"
        lead="Pictures, sounds, video, fonts and models, made by people here."
        action={<Button icon={faUpload}>Upload</Button>}
      />

      {/* The search is the page, so it opens the page. Kept from the live
          Marketplace, given the Hub's own lip instead of its own hero. */}
      <div className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <Hunt wide placeholder="Search by name, by what it is, or by who made it" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-mini font-extrabold uppercase tracking-wide text-muted">Made by</span>
          <Chip on={by === 'Anybody'} onClick={() => setBy('Anybody')}>Anybody</Chip>
          <Chip on={by === 'Kobblon'} icon={faCircleCheck} onClick={() => setBy('Kobblon')}>Kobblon</Chip>
          <span className="inline-flex h-9 items-center gap-1 rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised px-2.5">
            <span className="text-xs text-muted">@</span>
            <input readOnly placeholder="somebody" className="w-24 bg-transparent text-xs font-semibold placeholder:text-white/30 focus:outline-none" />
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {['Everything', 'Decals', 'Sounds', 'Video', 'Fonts', 'Models', 'Builds'].map((one) => (
          <Chip key={one} on={kind === one} onClick={() => setKind(one)}>{one}</Chip>
        ))}
        <span className="ml-auto" />
        <button className="kob-press inline-flex h-9 items-center gap-2 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card px-3 text-xs font-extrabold text-white/70 hover:border-brand/50 hover:text-white">
          Newest
          <Glyph icon={faChevronRight} className="rotate-90 text-tiny" />
        </button>
      </div>

      <section>
        <Head all="See all">Made by Kobblon</Head>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {MARKET.filter((one) => one.official).map((one) => <Tileish key={one.name} one={one} />)}
        </div>
      </section>

      <section>
        <Head>Just uploaded</Head>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {MARKET.map((one) => <Tileish key={one.name} one={one} />)}
        </div>
      </section>
    </div>
  )
}

function Tileish({ one, owned }: {
  one: { name: string; kind: string; by: string; price: number; used: number; tag: string; official?: boolean }
  owned?: boolean
}) {
  return (
    <article className="overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card transition-colors hover:border-brand/50">
      <div className="relative grid aspect-square place-items-center bg-ink-raised">
        <Glyph icon={KIND_ICON[one.kind]} className="text-3xl text-white/15" />
        <span className="absolute left-2 top-2">
          <Flag tone="bg-ink/85 text-white/60" icon={KIND_ICON[one.kind]}>{one.kind}</Flag>
        </span>
        {owned && (
          <span className="absolute right-2 top-2">
            <Flag tone="bg-ink/85 text-space-bright" icon={faCircleCheck}>Owned</Flag>
          </span>
        )}
      </div>
      <div className="space-y-1 border-t-2 border-ink-line p-3">
        <p className="truncate text-sm font-extrabold">{one.name}</p>
        <p className="flex items-center gap-1 truncate text-mini font-bold text-muted">
          @{one.by}
          {one.official && <Glyph icon={faCircleCheck} className="text-[#4d68ff]" />}
        </p>
        {/* What you own is used by its number, so the number is what the
            tile offers. A price on a thing you already have is noise. */}
        {owned ? (
          <button className="mt-1 flex w-full items-center justify-between rounded-lg border-2 border-ink-line bg-ink-raised px-2 py-1 text-mini font-bold text-white/70 transition-colors hover:border-brand/50 hover:text-white">
            <span className="font-mono">{one.tag}</span>
            <span>Copy id</span>
          </button>
        ) : (
          <p className="flex items-center justify-between pt-1 text-mini font-extrabold">
            <span className={one.price === 0 ? 'text-space-bright' : ''}>
              {one.price === 0 ? 'Free' : `${one.price} Brix`}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums text-muted">
              <Glyph icon={faHandPointer} />{formatCount(one.used)}
            </span>
          </p>
        )}
      </div>
    </article>
  )
}

/* -------------------------------------------------------- things to wear */

const WEARS = [
  { name: 'Kobblon hoodie', kind: 'Shirt', live: true, price: 25, sold: 412 },
  { name: 'Cargo trousers', kind: 'Trousers', live: true, price: 15, sold: 180 },
  { name: 'Spiky hair', kind: 'Hair', live: false, price: 40, sold: 0 },
  { name: 'Headphones', kind: 'Accessory', live: true, price: 60, sold: 91 },
  { name: 'Smiley t-decal', kind: 'T-decal', live: true, price: 0, sold: 2400 },
  { name: 'Winter coat', kind: 'Shirt', live: true, price: 80, sold: 33 },
  { name: 'Cap, backwards', kind: 'Accessory', live: false, price: 20, sold: 0 },
]

function Wear() {
  const [which, setWhich] = useState('In the Catalog')
  return (
    <div className="space-y-5">
      <HubTop
        icon={faShirt}
        title="Things to Wear"
        lead="Shirts, trousers, t-decals, accessories and hair, for the Catalog."
        action={<Button variant="subtle" icon={faStore}>The Catalog</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Hunt placeholder="Search what you have made" />
        <Chip on={which === 'In the Catalog'} icon={faStore} onClick={() => setWhich('In the Catalog')}>In the Catalog</Chip>
        <Chip on={which === 'Put away'} icon={faBoxArchive} onClick={() => setWhich('Put away')}>Put away (2)</Chip>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <button
          type="button"
          className="group grid aspect-[3/4] place-items-center gap-2 rounded-2xl border-2 border-b-4 border-dashed border-ink-line bg-ink-raised text-white/60 transition-colors hover:border-brand/60 hover:bg-ink-hover hover:text-white"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-ink-hover transition-transform duration-150 group-hover:scale-110">
            <Glyph icon={faPlus} className="text-lg" />
          </span>
          <span className="text-sm font-extrabold">Make something</span>
          <span className="px-4 text-center text-mini leading-snug text-muted">
            A shirt, trousers, a t-decal, an accessory or hair
          </span>
        </button>

        {WEARS.map((one) => (
          <article key={one.name} className="overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card transition-colors hover:border-brand/50">
            <div className="relative grid aspect-square place-items-center bg-ink-raised">
              <Glyph icon={faShirt} className="text-3xl text-white/15" />
              <span className="absolute left-2 top-2">
                <Flag tone="bg-ink/85 text-white/60" icon={faShirt}>{one.kind}</Flag>
              </span>
              <span className="absolute bottom-2 left-2">
                {one.live
                  ? <Flag tone="bg-ink/85 text-space-bright" icon={faCircleCheck}>Live</Flag>
                  : <Flag tone="bg-ink/85 text-warn-bright" icon={faClock}>Screening</Flag>}
              </span>
            </div>
            <div className="space-y-1 border-t-2 border-ink-line p-3">
              <p className="truncate text-sm font-extrabold">{one.name}</p>
              <p className="flex items-center justify-between pt-0.5 text-mini font-extrabold">
                <span className={one.price === 0 ? 'text-space-bright' : ''}>
                  {one.price === 0 ? 'Free' : `${one.price} Brix`}
                </span>
                <span className="text-muted">{one.live ? 'On sale' : 'Not up yet'}</span>
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <Button size="sm" variant="subtle" className="flex-1">Change</Button>
                <button className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/45 hover:bg-ink-hover hover:text-white">
                  <Glyph icon={faEllipsis} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- inventory */

function Inventory() {
  const [kind, setKind] = useState('Everything')
  return (
    <div className="space-y-5">
      <HubTop
        icon={faBoxOpen}
        title="Inventory"
        lead="Your own work and everything you have taken from the marketplace, Kobblon's included. Copy an id and paste it into a World."
        action={<Button variant="subtle" icon={faShapes}>Marketplace</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Hunt placeholder="Search what you own" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {['Everything', 'Decals', 'Sounds', 'Video', 'Fonts', 'Models', 'Builds'].map((one) => (
          <Chip key={one} on={kind === one} onClick={() => setKind(one)}>{one}</Chip>
        ))}
        <span className="ml-auto text-xs font-bold text-muted">61 things</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {MARKET.map((one) => <Tileish key={one.name} one={one} owned />)}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- ads */

const CAMPAIGNS = [
  {
    name: 'Tower of Doom, October', running: true, budget: 5000, spent: 3120, left: 1880,
    views: 182000, clicks: 4100, ends: '6 days left', renewed: 1,
    ads: [
      { name: 'Wide banner', shape: '728 × 90', to: 'Tower of Doom', on: true },
      { name: 'Square', shape: '300 × 300', to: 'Tower of Doom', on: true },
      { name: 'Tall', shape: '160 × 600', to: 'My profile', on: false },
    ],
  },
  {
    name: 'Kobville launch', running: false, budget: 1200, spent: 1200, left: 0,
    views: 44000, clicks: 910, ends: null, renewed: 0,
    ads: [{ name: 'Wide banner', shape: '728 × 90', to: 'Kobville', on: false }],
  },
]

function Ads() {
  return (
    <div className="space-y-5">
      <HubTop
        icon={faRectangleAd}
        title="Ads"
        lead="A campaign holds the name, the Brix and the clock, up to a month of it. The ads inside it are the work: as many as you like, each with its own decal, shape and destination."
        action={<Button icon={faPlus}>Start a campaign</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={faRectangleAd} label="Running" value="1" />
        <Stat icon={faEye} label="Views" value={formatCount(226000)} />
        <Stat icon={faHandPointer} label="Presses" value={formatCount(5010)} />
        <Stat icon={faHourglassHalf} label="Brix left" value={formatCount(1880)} note="Of 6,200 put up" />
      </div>

      {CAMPAIGNS.map((one) => (
        <Sheet key={one.name}>
          <div className="flex flex-wrap items-start gap-4 border-b-2 border-ink-line p-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="truncate font-display text-lg font-extrabold">{one.name}</span>
                <button className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-white/40 hover:bg-ink-hover hover:text-white">
                  <Glyph icon={faPen} className="text-tiny" />
                </button>
                {one.running
                  ? <Live />
                  : <Flag tone="bg-ink-raised text-white/55" icon={faStop}>Finished</Flag>}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-mini font-bold text-muted">
                <span className="text-white/90">{formatCount(one.left)} Brix left of {formatCount(one.budget)}</span>
                {one.ends && <span className="inline-flex items-center gap-1"><Glyph icon={faHourglassHalf} />{one.ends}</span>}
                <span className="inline-flex items-center gap-1"><Glyph icon={faEye} />{formatCount(one.views)} views</span>
                <span className="inline-flex items-center gap-1"><Glyph icon={faHandPointer} />{formatCount(one.clicks)} presses</span>
                {one.renewed > 0 && <span>Renewed once</span>}
              </div>

              <div className="mt-2.5 h-2 w-full max-w-md overflow-hidden rounded-full border-2 border-ink-line bg-ink-raised">
                <span style={{ width: `${(one.spent / one.budget) * 100}%` }} className="block h-full bg-brand" />
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Button size="sm" variant="subtle" icon={faPlus}>Add an ad</Button>
              {one.running ? (
                <>
                  <Button size="sm" variant="ghost" icon={faClock}>How long</Button>
                  <Button size="sm" variant="ghost" icon={faStop}>Stop</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="subtle" icon={faRotateRight}>Put it back up</Button>
                  <Button size="sm" variant="ghost" icon={faTrash}>Remove</Button>
                </>
              )}
            </div>
          </div>

          <div>
            {one.ads.map((ad) => (
              <Row key={ad.name}>
                <span className="grid h-12 w-20 shrink-0 place-items-center rounded-xl border-2 border-ink-line bg-ink-raised">
                  <Glyph icon={faImage} className="text-white/20" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{ad.name}</span>
                  <span className="block truncate text-mini text-muted">{ad.shape} · goes to {ad.to}</span>
                </span>
                {ad.on
                  ? <Flag tone="bg-space/15 text-space-bright" icon={faCircleCheck}>Showing</Flag>
                  : <Flag tone="bg-ink-raised text-white/55" icon={faStop}>Resting</Flag>}
                <Button size="sm" variant="ghost" icon={faPen}>Change</Button>
                <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/45 hover:bg-ink-hover hover:text-white">
                  <Glyph icon={faEllipsis} />
                </button>
              </Row>
            ))}
          </div>
        </Sheet>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------- analytics */

const ROWS = [
  { name: 'Brick wall, red', tag: 'DCL-88120', kind: 'Decal', views: 24100, uses: 1240, asking: 3 },
  { name: 'Grass, tall', tag: 'DCL-88155', kind: 'Decal', views: 18800, uses: 2810, asking: 0 },
  { name: 'Crate, wooden', tag: 'MDL-7799', kind: 'Model', views: 9100, uses: 402, asking: 1 },
  { name: 'Footstep, gravel', tag: 'SND-41007', kind: 'Sound', views: 4400, uses: 318, asking: 0 },
  { name: 'Kobblon Pixel', tag: 'FNT-1120', kind: 'Font', views: 2100, uses: 86, asking: 2 },
]

function Analytics() {
  return (
    <div className="space-y-5">
      <HubTop
        icon={faChartSimple}
        title="Analytics"
        lead="Counted as they happen, not as unique people. Open an item for its last thirty days."
        action={<Button variant="subtle" icon={faUpload}>My Uploads</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={faEye} label="Views" value={formatCount(58500)} />
        <Stat icon={faHandPointer} label="Uses" value={formatCount(4856)} />
        <Stat icon={faUpload} label="Items counted" value="24" />
        <Stat icon={faClock} tone="text-warn-bright" label="Asking to use" value="6" note="Across 3 items" />
      </div>

      <Sheet>
        <div className="hidden grid-cols-[1fr_6rem_6rem_7rem] gap-3 border-b-2 border-ink-line bg-ink-raised/60 px-4 py-2.5 text-mini font-extrabold uppercase tracking-wide text-muted sm:grid">
          <span>Item</span>
          <span className="text-right">Views</span>
          <span className="text-right">Uses</span>
          <span className="text-right">Asking to use</span>
        </div>
        {ROWS.map((row) => (
          <div
            key={row.tag}
            className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-ink-line px-4 py-3 transition-colors last:border-0 hover:bg-ink-hover sm:grid-cols-[1fr_6rem_6rem_7rem]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Tile size="sm"><Glyph icon={KIND_ICON[row.kind]} className="text-brand-bright" /></Tile>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{row.name}</span>
                <span className="block font-mono text-mini text-muted">{row.tag}</span>
              </span>
            </span>
            <span className="text-right text-sm font-bold tabular-nums">{formatCount(row.views)}</span>
            <span className="hidden text-right text-sm font-bold tabular-nums sm:block">{formatCount(row.uses)}</span>
            <span className="hidden text-right text-sm font-bold tabular-nums sm:block">
              {row.asking > 0
                ? <span className="text-warn-bright">{row.asking}</span>
                : <span className="text-muted">0</span>}
            </span>
          </div>
        ))}
      </Sheet>
      <p className="text-mini text-muted">
        Asking to use is a number, not a link: there is no requests page yet.
      </p>
    </div>
  )
}

/* ----------------------------------------------------------------- mounts */

const PAGES: Record<Key, () => JSX.Element> = {
  overview: Overview,
  worlds: Worlds,
  uploads: Uploads,
  marketplace: Market,
  avatar: Wear,
  inventory: Inventory,
  ads: Ads,
  analytics: Analytics,
}

function Preview() {
  const asked = new URLSearchParams(location.search).get('page') as Key | null
  const [here, setHere] = useState<Key>(asked && PAGES[asked] ? asked : 'overview')
  const Page = PAGES[here]
  return (
    <div className="flex min-h-screen items-stretch bg-ink text-white">
      <HubRail here={here} go={setHere} />
      <main className="min-w-0 flex-1 px-6 py-7"><Page /></main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Preview /></MemoryRouter>,
)
