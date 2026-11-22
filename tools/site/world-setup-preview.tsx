/*
 * Setting a World up, proposed rather than shipped.
 *
 * `?step=what|art|runs|things|out` jumps to a section; everything is on
 * one page and the chips scroll to it.
 *
 * What is wrong with the page today, which this answers:
 *
 * 1. **The address is the uuid.** `/create/worlds/e0000000-…-0001` for a
 *    World the rest of the site calls WLD-1069. Nothing else in the Hub
 *    works that way: an asset is `/create/DCL-88120`.
 * 2. **There is one picture doing two jobs.** The page says "emblem",
 *    crops it square, and saves it to `cover_url` - the *wide* slot. And
 *    `worlds.emblem_url`, which every reader coalesces to first, **has
 *    never been written by anything**. So a square crop is being stretched
 *    across a 16/9 cover everywhere a World is shown wide.
 * 3. **Publishing is a button with nothing behind it.** It does not say
 *    what a World needs before it is worth putting out, so Worlds go out
 *    with no description, no genre and no picture.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faLink, faCopy, faArrowUpRightFromSquare, faImage, faPlus, faTrash,
  faCircleCheck, faCircleXmark, faUpload, faBell, faCrop, faVideo, faGripVertical,
  faDesktop, faMobileScreen, faTabletScreenButton, faGamepad, faAward,
  faBagShopping, faPen, faEye, faThumbsUp, faCircleExclamation, faBookmark,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { worldIcon } from '@/lib/naming'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/brand/Icon'
import { CurrencyMark } from '@/components/brand/Currency'
import { Input, Textarea } from '@/components/ui/Input'
import { HubTop, Stat, Head, Sheet, Chip, Flag, LiveFlag } from '@/components/create/HubShapes'
import { DEFAULT_WORLD_EMBLEM, DEFAULT_WORLD_THUMBNAIL } from '@/lib/worldart'
import { cn } from '@/lib/cn'
import '@/index.css'

/* --------------------------------------------------------------- pieces */

/** A picture this World wears, with the shape it is cut to and where it shows. */
function ArtSlot({ title, note, shape, art, where, set }: {
  title: string
  note: string
  shape: 'square' | 'wide'
  art: string | null
  where: string
  set: boolean
}) {
  return (
    <div className="flex flex-wrap items-start gap-4 border-b border-ink-line p-4 last:border-0">
      <span className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-media',
        shape === 'square' ? 'h-24 w-24' : 'h-24 w-[10.65rem]',
      )}>
        {art
          ? <img src={art} alt="" className="h-full w-full object-cover" />
          : <Glyph icon={faImage} className="text-xl text-white/25" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-display text-base font-extrabold">
          {title}
          {set
            ? <Flag tone="bg-space/15 text-space-bright" icon={faCircleCheck}>Set</Flag>
            : <Flag tone="bg-warn/15 text-warn-bright" icon={faCircleExclamation}>Missing</Flag>}
        </p>
        <p className="mt-1 text-xs leading-snug text-muted">{note}</p>
        <p className="mt-1 text-mini font-bold uppercase tracking-wide text-white/35">{where}</p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Button size="sm" variant="subtle" icon={faUpload}>
            {art ? 'Change it' : 'Choose a picture'}
          </Button>
          {art && <Button size="sm" variant="ghost" icon={faCrop}>Cut it again</Button>}
          {art && <Button size="sm" variant="ghost" icon={faTrash}>Take it off</Button>}
        </div>
      </div>
    </div>
  )
}

/** One thing a World needs before it is worth putting out. */
function Need({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 border-b border-ink-line px-4 py-2.5 text-sm last:border-0">
      <span className={cn(
        'grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2',
        done ? 'border-space/40 bg-space/15 text-space-bright' : 'border-ink-line bg-ink-raised text-white/30',
      )}>
        <Glyph icon={done ? faCircleCheck : faCircleXmark} className="text-tiny" />
      </span>
      <span className={done ? 'text-white/70' : 'font-bold text-white'}>{children}</span>
    </li>
  )
}

const DEVICES: { icon: IconDefinition; label: string }[] = [
  { icon: faDesktop, label: 'Computer' },
  { icon: faMobileScreen, label: 'Phone' },
  { icon: faTabletScreenButton, label: 'Tablet' },
  { icon: faGamepad, label: 'Console' },
]

/* ----------------------------------------------------------------- page */

function Setup() {
  const [emblem, setEmblem] = useState<string | null>(DEFAULT_WORLD_EMBLEM)
  const [cover, setCover] = useState<string | null>(null)
  const [on, setOn] = useState(['Computer', 'Phone'])
  const [maturity, setMaturity] = useState('Everyone')
  const [genre, setGenre] = useState('Obby')
  void setEmblem; void setCover

  const needs = [
    { done: true, what: 'A name' },
    { done: true, what: 'A description people can read before deciding' },
    { done: !!genre, what: 'A genre, so Discover knows where to put it' },
    { done: !!emblem, what: 'An emblem, for lists and tiles' },
    { done: !!cover, what: 'A thumbnail, for its own page and Discover' },
    { done: on.length > 0, what: 'At least one thing it runs on' },
  ]
  const left = needs.filter((one) => !one.done).length

  return (
    <div className="space-y-7">
      <HubTop
        icon={worldIcon}
        title="Tower of Doom"
        lead="Workspace writes the scene; this is everything else about it - what it is called, what it looks like, who it is for, and whether it is out."
        action={<Button variant="subtle" icon={faArrowUpRightFromSquare}>Open its page</Button>}
      />

      {/* Where it stands, and the thing people come to this page for. */}
      <div className="flex flex-wrap items-center gap-2">
        <LiveFlag />
        <Flag tone="bg-ink-raised text-white/60" icon={worldIcon}>WLD-1069</Flag>
        <span className="ml-auto flex items-center gap-2">
          <Glyph icon={faLink} className="text-muted" />
          <code className="truncate rounded-lg border-2 border-ink-line bg-ink-raised px-3 py-1.5 text-xs text-white/80">
            kobblon.com/worlds/1069/tower-of-doom
          </code>
          <Button size="sm" variant="subtle" icon={faCopy}>Copy</Button>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {/* Somebody in there right now, in Staw's own drawing - the same
            mark and the same word its page uses. */}
        <div className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card px-4 py-3">
          <p className="flex items-center gap-1.5 text-mini font-extrabold uppercase tracking-wide text-muted">
            <Icon name="playing" className="h-3.5 w-3.5" />
            Playing
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-space-bright">412</p>
        </div>
        <Stat icon={faEye} label="Visits" value="1.3M" />
        {/* The filled thumb is Staw's own drawing, the one the rating bar
            shows once you have pressed it. */}
        <Stat icon={faThumbsUp} label="Likes" value="24.1K" />
        {/* The same marks this World's own page wears: an award for a
            badge, a bag for a gamepass. Two drawings of one thing is two
            ideas of what it is. */}
        <Stat icon={faBookmark} label="Saved" value="8,120" />
        <Stat icon={faAward} label="Badges" value="4" />
      </div>

      {/* ------------------------------------------------------- what */}
      <section id="what">
        <Head>What it is</Head>
        <Sheet className="space-y-4 p-4">
          <Input label="Name" value="Tower of Doom" onChange={() => {}} />
          <Textarea
            label="Description"
            labelNote="What somebody reads before deciding"
            rows={4}
            value="Climb the tower. Do not look down. Every floor is somebody else's bad idea."
            onChange={() => {}}
          />

          <div>
            <p className="mb-1.5 text-mini font-extrabold uppercase tracking-wide text-muted">Genre</p>
            <div className="flex flex-wrap gap-2">
              {['Obby', 'Fighting', 'Roleplay', 'Racing', 'Tycoon', 'Horror'].map((one) => (
                <Chip key={one} on={genre === one} onClick={() => setGenre(one)}>{one}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-mini font-extrabold uppercase tracking-wide text-muted">
              Who it is for
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['Everyone', 'Nothing anybody needs warning about'],
                ['Mild', 'A little cartoon violence, mild fright'],
                ['Moderate', 'Repeated violence, or frightening scenes'],
                ['Strong', 'Strong violence or themes for older players'],
              ].map(([label, note]) => (
                <button
                  key={label}
                  onClick={() => setMaturity(label)}
                  aria-pressed={maturity === label}
                  className={cn(
                    'kob-press rounded-xl border-2 px-3 py-2 text-left transition-colors',
                    maturity === label
                      ? 'border-brand-deep border-b-[6px] bg-brand text-on-art'
                      : 'border-ink-line border-b-4 bg-ink-card hover:border-brand/50',
                  )}
                >
                  <span className="block font-display text-sm font-extrabold">{label}</span>
                  <span className={cn('mt-0.5 block text-mini leading-snug', maturity === label ? 'text-on-art/75' : 'text-muted')}>
                    {note}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      </section>

      {/* -------------------------------------------------------- art */}
      <section id="art">
        <Head>How it looks</Head>
        <Sheet>
          {/*
            * Two pictures, two shapes, two jobs - said out loud, because
            * today there is one picture cut square and stretched wide.
            */}
          <ArtSlot
            title="Emblem"
            shape="square"
            art={emblem}
            set={!!emblem}
            note="A square picture. Cut to a square here, so nothing is squashed later."
            where="Lists · tiles · the Launcher · your Worlds"
          />
          <ArtSlot
            title="Thumbnail"
            shape="wide"
            art={cover}
            set={!!cover}
            note="A wide picture, 16 by 9. This is the big one at the top of its page."
            where="Its own page · Discover · what gets shared"
          />
        </Sheet>
      </section>

      <section>
        <Head>What its page shows</Head>
        <Sheet className="p-4">
          <p className="mb-3 text-xs text-muted">
            Up to twelve pictures and videos, in this order. Drag one to move it.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="group relative aspect-video overflow-hidden rounded-xl border-2 border-ink-line bg-media">
                {i === 2
                  ? <span className="grid h-full w-full place-items-center text-white/40"><Glyph icon={faVideo} /></span>
                  : <img src={DEFAULT_WORLD_THUMBNAIL} alt="" className="h-full w-full object-cover" />}
                <span className="absolute left-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-ink/80 text-tiny text-white/60">
                  <Glyph icon={faGripVertical} />
                </span>
                <span className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-ink/80 text-tiny text-white/60 hover:bg-danger hover:text-white">
                  <Glyph icon={faTrash} />
                </span>
                <span className="absolute bottom-1.5 left-1.5 rounded-lg bg-ink/80 px-1.5 text-mini font-bold">
                  {i + 1}
                </span>
              </div>
            ))}
            <button className="grid aspect-video place-items-center gap-1 rounded-xl border-2 border-b-4 border-dashed border-ink-line bg-ink-raised text-sm text-muted transition-colors hover:border-brand/60 hover:text-white">
              <Glyph icon={faPlus} />
              Add
            </button>
          </div>
        </Sheet>
      </section>

      {/* ------------------------------------------------------- runs */}
      <section id="runs">
        <Head>What it runs on</Head>
        <Sheet className="p-4">
          <div className="flex flex-wrap gap-2">
            {DEVICES.map((one) => (
              <Chip
                key={one.label}
                on={on.includes(one.label)}
                icon={one.icon}
                onClick={() => setOn((was) => (
                  was.includes(one.label)
                    ? (was.length > 1 ? was.filter((x) => x !== one.label) : was)
                    : [...was, one.label]
                ))}
              >
                {one.label}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Discover lets people keep the Worlds that run on what they are holding. It has to run
            on something, so the last one cannot be turned off.
          </p>
        </Sheet>
      </section>

      {/* ----------------------------------------------------- things */}
      <section id="things">
        <Head>Badges and gamepasses</Head>
        <Sheet>
          {[
            { icon: faAward, name: 'Reached the top', note: 'Badge · given by the World · 1,204 earned' },
            { icon: faBagShopping, name: 'Skip the queue', note: 'Gamepass · 318 sold', price: 50 },
          ].map((one) => (
            <div key={one.name} className="flex items-center gap-3 border-b border-ink-line px-4 py-3 last:border-0">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-ink-line bg-ink-raised text-brand-bright">
                <Glyph icon={one.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{one.name}</span>
                <span className="flex items-center gap-1 truncate text-mini text-muted">
                  {one.price !== undefined && (
                    <><CurrencyMark className="mr-0.5" />{one.price} · </>
                  )}
                  {one.note}
                </span>
              </span>
              <Button size="sm" variant="ghost" icon={faPen}>Change</Button>
            </div>
          ))}
          <div className="flex gap-2 p-3">
            <Button size="sm" variant="subtle" icon={faPlus} className="flex-1">Make a badge</Button>
            <Button size="sm" variant="subtle" icon={faPlus} className="flex-1">Make a gamepass</Button>
          </div>
        </Sheet>
      </section>

      {/* -------------------------------------------------------- out */}
      <section id="out">
        <Head>Putting it out</Head>
        <Sheet>
          <div className="flex flex-wrap items-center gap-4 border-b-2 border-ink-line p-4">
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-extrabold">This World is out</p>
              <p className="mt-0.5 text-sm text-muted">
                Anybody can find it and play it. Taking it back in hides the page and stops the
                Launcher opening it.
              </p>
            </div>
            <Button variant="ghost">Take it back in</Button>
          </div>

          {/*
            * The checklist is the point. Publishing is one press today and
            * says nothing about what a World needs first, so Worlds go out
            * with no description, no genre and no picture.
            */}
          <div className="border-b-2 border-ink-line">
            <p className="flex items-center gap-2 px-4 pb-1 pt-3 font-display text-tiny font-extrabold uppercase tracking-[0.18em] text-white/40">
              Before it goes out
              {left > 0 && (
                <Flag tone="bg-warn/15 text-warn-bright" icon={faCircleExclamation}>
                  {left} left
                </Flag>
              )}
            </p>
            <ul>
              {needs.map((one) => <Need key={one.what} done={one.done}>{one.what}</Need>)}
            </ul>
          </div>

          <div className="space-y-3 p-4">
            <p className="font-display text-sm font-extrabold">Tell people it changed</p>
            <p className="text-xs leading-relaxed text-muted">
              Everybody who pressed Notify gets one notification, and it takes them here. Once
              every six hours, because a World that announces itself all day is one people
              switch off.
            </p>
            <Input
              label="What changed"
              labelNote="Left empty, it just says the World was updated"
              value=""
              onChange={() => {}}
            />
            <div className="flex justify-end">
              <Button variant="subtle" icon={faBell}>Announce an update</Button>
            </div>
          </div>
        </Sheet>
      </section>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink px-6 py-7 text-white">
      <div className="mx-auto max-w-4xl"><Setup /></div>
    </div>
  </MemoryRouter>,
)
