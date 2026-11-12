import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  faBolt, faCircleCheck, faCube, faGem, faHeart, faImage,
  faMagnifyingGlass, faMusic, faPlay, faShapes, faStar, faTrash,
  faTriangleExclamation, faVideo,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { Meter } from '@/components/ui/Meter'
import { Note } from '@/components/ui/Note'
import { Switch } from '@/components/ui/Switch'
import { Tickbox } from '@/components/ui/Tickbox'
import { Choices } from '@/components/ui/Choices'
import { Tabs } from '@/components/ui/Tabs'
import { StatTile } from '@/components/ui/StatTile'
import { Avatar } from '@/components/ui/Avatar'
import { useAtTitle } from '@/hooks/useTitle'
import { cn } from '@/lib/cn'

/**
 * The style guide: every token and every shared component, on one page.
 *
 * Staw's brief asked for "a simple style-guide page showing every token and
 * component" before the site moved onto the system, and the reason it comes
 * first is that a system you can only see by visiting forty-four pages is
 * not a system anybody can hold an opinion about.
 *
 * It renders the real components rather than pictures of them, so a change
 * to `Button` changes this page by itself. Nothing here reads the database
 * and nothing here needs an account: it is the one page that can be looked
 * at when everything else is down.
 */

function Section({ id, title, lead, children }: {
  id: string
  title: string
  lead: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t-2 border-ink-line pt-10">
      <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{lead}</p>
      <div className="mt-6">{children}</div>
    </section>
  )
}

/** A swatch, its name, and the job it is allowed to do. */
function Swatch({ name, cls, job, on }: { name: string; cls: string; job: string; on?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-ink-card">
      <div className={cn('grid h-16 place-items-center text-sm font-bold', cls, on)}>{on ? 'Aa' : ''}</div>
      <div className="px-3 py-2.5">
        <p className="font-mono text-xs font-bold">{name}</p>
        <p className="mt-0.5 text-mini leading-snug text-muted">{job}</p>
      </div>
    </div>
  )
}

const BUILT = [
  { icon: faImage, word: 'Decal', cls: 'bg-brand/25' },
  { icon: faMusic, word: 'Sound', cls: 'bg-space/25' },
  { icon: faVideo, word: 'Video', cls: 'bg-link/25' },
  { icon: faCube, word: 'Mesh', cls: 'bg-craft/30' },
  { icon: faShapes, word: 'Build', cls: 'bg-brand-bright/25' },
]

export default function StyleGuide() {
  useAtTitle('Design system')
  const [on, setOn] = useState(true)
  const [ticked, setTicked] = useState(false)
  const [choice, setChoice] = useState<'all' | 'mine' | 'new'>('all')
  const [tab, setTab] = useState<'blocks' | 'colour' | 'motion'>('blocks')
  const [replay, setReplay] = useState(0)

  return (
    <main className="min-h-dvh bg-ink pb-24 text-white">
      {/* ------------------------------------------------------- the head */}
      <header className="border-b-2 border-ink-line bg-ink-raised">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.3em] text-brand-bright">
            Kobblon
          </p>
          <h1 className="mt-3 font-display text-4xl font-black leading-[0.95] sm:text-6xl">
            The design system
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            One stroke, one depth, one set of corners, and a palette where every
            colour has a job it is not allowed to leave. Everything below is the
            live component, not a picture of it.
          </p>
          <nav className="mt-7 flex flex-wrap gap-2">
            {[
              ['colour', 'Colour'], ['surfaces', 'Surfaces'], ['type', 'Type'],
              ['controls', 'Controls'], ['fields', 'Fields'], ['pieces', 'Pieces'],
              ['motion', 'Motion'],
            ].map(([id, word]) => (
              <a
                key={id}
                href={`#${id}`}
                className="kob-press rounded-lg border-2 border-b-4 border-ink-line bg-ink-card px-3 py-1.5 text-xs font-bold hover:border-brand-bright hover:bg-ink-hover"
              >
                {word}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-12 px-5 pt-12 sm:px-8">
        {/* ----------------------------------------------------- colour */}
        <Section
          id="colour"
          title="Colour"
          lead="Seven colours and a neutral scale. Blue is where you are, green means yes, the gem means somebody earned it, ochre means be careful, red means danger and nothing else, violet belongs to the workshop, and the link blue is for words you can press."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Swatch name="brand" cls="bg-brand" on="text-on-art" job="Kobblon. The page you are standing in, and the workhorse button." />
            <Swatch name="space" cls="bg-space" on="text-on-art" job="Yes. Save, publish, buy, enter a World. One per screen." />
            <Swatch name="gem" cls="bg-gem" on="text-gem-ink" job="Earned. XP, levels, streaks, quests, Brix. If it glows, somebody earned it." />
            <Swatch name="warn" cls="bg-warn" on="text-on-art" job="Careful. A review, a limit, a room nearly full. Never a button on its own." />
            <Swatch name="danger" cls="bg-danger" on="text-on-art" job="Danger. Delete, report, block, ban. Nothing else is red." />
            <Swatch name="craft" cls="bg-craft" on="text-on-art" job="The workshop. Scripting, building, meshes - the things somebody makes." />
            <Swatch name="link" cls="bg-link" on="text-on-art" job="A word you can press, inside a sentence." />
            <Swatch name="muted" cls="bg-muted" on="text-ink" job="A second line that is true but not the point." />
          </div>

          <h3 className="mt-8 font-display text-lg font-extrabold">The neutral scale</h3>
          <p className="mt-1 text-sm text-muted">
            Five steps and an edge, from the page to the thing you are hovering.
            They flip with the theme; the seven above never do, which is how a
            colour keeps its meaning in daylight.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Swatch name="ink" cls="bg-ink" on="text-white" job="The page." />
            <Swatch name="ink-raised" cls="bg-ink-raised" on="text-white" job="A panel standing on the page." />
            <Swatch name="ink-card" cls="bg-ink-card" on="text-white" job="A card." />
            <Swatch name="ink-hover" cls="bg-ink-hover" on="text-white" job="The one under the pointer." />
            <Swatch name="ink-line" cls="bg-ink-line" on="text-ink" job="The house stroke. 3.8 against a card, so it is seen and not guessed at." />
            <Swatch name="ink-edge" cls="bg-ink-edge" on="text-white" job="Darker than the page. Nothing on the website rests on it now; the applications still can." />
          </div>
        </Section>

        {/* --------------------------------------------------- surfaces */}
        <Section
          id="surfaces"
          title="Surfaces, strokes and depth"
          lead="Every surface is a block: a 2px stroke all round and a 4px stroke along the bottom, which is the front face of a thing seen slightly from above. There is one depth and it is a border. No gradients on a surface, no stacked shadows, and a blur only for the few things that genuinely float."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="font-display font-extrabold">A card</p>
              <p className="mt-1 text-sm text-muted">
                Stroke, fill, bottom edge, `rounded-xl`. Nothing else.
              </p>
            </Card>
            <div className="rounded-xl border-2 border-ink-line bg-ink-raised p-5">
              <p className="font-display font-extrabold">A panel</p>
              <p className="mt-1 text-sm text-muted">
                No front face: it is part of the page rather than lying on it.
              </p>
            </div>
            <div className="rounded-xl border-2 border-b-4 border-brand/45 bg-brand/12 p-5">
              <p className="font-display font-extrabold">A card with a job</p>
              <p className="mt-1 text-sm text-muted">
                A flat tint of the colour that means something. Never a fade.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-ink-line bg-ink-card p-5">
              <p className="font-display font-extrabold">Corners</p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                {[['rounded-lg', 'h-10 w-16'], ['rounded-xl', 'h-14 w-20'], ['rounded-2xl', 'h-16 w-24'], ['rounded-full', 'h-12 w-12']].map(([r, size]) => (
                  <div key={r} className="text-center">
                    <div className={cn('border-2 border-b-4 border-ink-line bg-ink-hover', r, size)} />
                    <p className="mt-1.5 font-mono text-tiny text-muted">{r}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                `lg` for a small control, `xl` for a card, `2xl` for something
                that holds cards, `full` for a face or a chip. There is no
                `md`, no `sm` and no arbitrary radius.
              </p>
            </div>
            <div className="rounded-xl border-2 border-ink-line bg-ink-card p-5">
              <p className="font-display font-extrabold">The press</p>
              <p className="mt-1 text-sm text-muted">
                Everything you can press goes one pixel down and loses its lip.
                Hold one of these.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm">Primary</Button>
                <button className="kob-press rounded-lg border-2 border-b-4 border-ink-line bg-ink-raised px-3 py-1.5 text-sm font-bold">
                  A chip
                </button>
                <button className="kob-press kob-chosen rounded-lg border-2 border-brand bg-brand/20 px-3 py-1.5 text-sm font-bold text-brand-bright">
                  Chosen
                </button>
              </div>
            </div>
          </div>

          {/*
            Two lifts, near and far. There used to be one, and seven bespoke
            blurs written around it - which is one token and seven exceptions
            rather than one system.
          */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-5 shadow-lift">
              <p className="font-display font-extrabold">The near lift</p>
              <p className="mt-1 text-sm text-muted">
                `shadow-lift`. A tooltip, a toast, the cookie note: a few
                pixels off the page, not above it.
              </p>
            </div>
            <div className="rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-5 shadow-pop">
              <p className="font-display font-extrabold">The far lift</p>
              <p className="mt-1 text-sm text-muted">
                `shadow-pop`. A dialog, a menu, the sticky bar once it has
                left the top. Nothing else gets a blur at all.
              </p>
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------- type */}
        <Section
          id="type"
          title="Type"
          lead="Two faces. BD Gravel is the display face and it is for headings and nothing else; Inter carries every word somebody has to read. Controls are bold, because a control on a gamified page should look like it carries its own weight."
        >
          <div className="space-y-3 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
            <p className="font-display text-5xl font-black leading-none">Make it</p>
            <p className="font-display text-3xl font-extrabold">A heading</p>
            <p className="font-display text-xl font-extrabold">A smaller heading</p>
            <p className="text-base leading-relaxed">
              Body copy, Inter, 16px. Long enough to show a second line, because
              a type specimen on one line tells you nothing about the leading.
            </p>
            <p className="text-sm text-muted">A second line that is true but not the point.</p>
            <p className="font-display text-xs font-extrabold uppercase tracking-[0.3em] text-white/45">
              An eyebrow
            </p>
          </div>

          {/*
            Tailwind's scale stops at 12px and Kobblon does not. Six named
            steps below it, so a mark beside a name and a handle under a face
            card are the same size in both places by name rather than by two
            people happening to type the same number.
          */}
          <div className="mt-4 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
            <p className="font-display text-xs font-extrabold uppercase tracking-[0.3em] text-white/45">
              Under body text
            </p>
            <div className="mt-4 space-y-2.5">
              {([
                ['lede', 'text-lede', '15px', 'A line that should carry.'],
                ['note', 'text-note', '13px', 'A display name on a face card.'],
                ['mini', 'text-mini', '11px', 'A handle, a label on a chip.'],
                ['tiny', 'text-tiny', '10px', 'A count, a caption.'],
                ['mark', 'text-mark', '9px', 'A verified mark beside a name.'],
                ['nib', 'text-nib', '8px', 'The smallest thing still a letter.'],
              ] as const).map(([name, cls, px, what]) => (
                <div key={name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="w-20 shrink-0 font-mono text-xs font-bold text-brand-bright">{cls}</p>
                  <p className="w-12 shrink-0 font-mono text-xs text-muted">{px}</p>
                  <p className={cn(cls, 'font-bold')}>{what}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              Sizes only, no leading. That is on purpose: the names are a
              rename of four hundred and fifty-five arbitrary values that were
              already on the page, so naming them moved nothing.
            </p>
          </div>
        </Section>

        {/* --------------------------------------------------- controls */}
        <Section
          id="controls"
          title="Controls"
          lead="Seven button variants, three sizes. Green is said on purpose - if two buttons on a screen are both green, one of them is wrong."
        >
          <div className="space-y-5 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={faBolt}>Primary</Button>
              <Button variant="yes" icon={faCircleCheck}>Yes</Button>
              <Button variant="enter" icon={faPlay}>Enter</Button>
              <Button variant="subtle">Subtle</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger" icon={faTrash}>Danger</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button loading>Working</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-5">
              <Choices
                label="Choices"
                value={choice}
                onChange={setChoice}
                options={[
                  { value: 'all', label: 'Everything' },
                  { value: 'mine', label: 'Mine' },
                  { value: 'new', label: 'New' },
                ]}
              />
              <div className="mt-5">
                <Tabs
                  label="Tabs"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'blocks', label: 'Blocks', count: 12 },
                    { value: 'colour', label: 'Colour' },
                    { value: 'motion', label: 'Motion' },
                  ]}
                />
              </div>
            </div>
            <div className="space-y-4 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-5">
              <Switch on={on} onChange={setOn} label="A switch" note="With the line under it that says what it does." />
              <Tickbox on={ticked} onChange={setTicked} label="A tickbox" />
            </div>
          </div>
        </Section>

        {/* ----------------------------------------------------- fields */}
        <Section
          id="fields"
          title="Fields"
          lead="A field is a block too: the same stroke, the same bottom edge, and a focus that turns the whole edge brand blue rather than a hairline changing shade."
        >
          <div className="grid gap-4 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-6 sm:grid-cols-2">
            <Input label="A field" placeholder="Type something" icon={faMagnifyingGlass} />
            <Input label="One that went wrong" defaultValue="taken" error="Somebody has that name." />
            <div className="sm:col-span-2">
              <Textarea label="Something longer" rows={3} placeholder="A description, a reason, a reply." />
            </div>
          </div>
        </Section>

        {/* ----------------------------------------------------- pieces */}
        <Section
          id="pieces"
          title="Pieces"
          lead="The small things that carry meaning: chips, notes, numbers, faces, and the one meter every progress bar on Kobblon is made of."
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-5">
              <Badge>Neutral</Badge>
              <Badge tone="brand" icon={faStar}>Brand</Badge>
              <Badge tone="space" icon={faCircleCheck}>Yes</Badge>
              <Badge tone="warm" icon={faTriangleExclamation}>Careful</Badge>
              <Badge tone="danger" icon={faTrash}>Danger</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Note>A note, for a thing worth saying once.</Note>
              <Note tone="yes" icon={faCircleCheck}>And the one that means it went well.</Note>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile icon={faHeart} value={128} label="Friends" />
              <StatTile icon={faCube} value="1.2k" label="Worlds" />
              <StatTile icon={faGem} value={940} label="Brix" />
              <StatTile icon={faStar} value={12} label="Favourites" />
            </div>

            <div className="space-y-4 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
              <div>
                <p className="mb-2 text-sm font-bold">A meter, filling a block at a time</p>
                <Meter done={7} goal={10} tone="gem" label="A quest" />
              </div>
              <Meter done={3} goal={10} label="Something merely happening" />
              <Meter done={10} goal={10} label="Finished" />
              <p className="text-xs text-muted">
                The notches are the whole of the pixel flavour in this system.
                Nothing else on Kobblon carries a pixel grid, which is what
                keeps it a seasoning.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
              {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
                <Avatar key={size} name="Kobblon" size={size} />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {BUILT.map((one) => (
                <div
                  key={one.word}
                  className={cn('grid place-items-center gap-2 rounded-xl border-2 border-b-4 border-ink-line py-6', one.cls)}
                >
                  <Glyph icon={one.icon} className="text-xl" />
                  <span className="text-xs font-bold">{one.word}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ----------------------------------------------------- motion */}
        <Section
          id="motion"
          title="Motion"
          lead="Short and purposeful: a thing arriving, a row being dealt, a step replacing another. Nothing loops for decoration, nothing waits on an animation to be usable, and every one of them stops under prefers-reduced-motion."
        >
          <div className="rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
            <Button size="sm" variant="subtle" onClick={() => setReplay((n) => n + 1)}>
              Play them again
            </Button>
            <div key={replay} className="mt-5 grid gap-3 sm:grid-cols-4">
              {[
                ['animate-pop-in', 'pop-in', 'A card arriving'],
                ['animate-slide-up', 'slide-up', 'A section arriving'],
                ['animate-slide-in', 'slide-in', 'A drawer'],
                ['animate-row-in', 'row-in', 'One row of a list'],
              ].map(([cls, name, job], i) => (
                <div
                  key={name}
                  className={cn('rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised p-4', cls)}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <p className="font-mono text-xs font-bold">{name}</p>
                  <p className="mt-1 text-mini text-muted">{job}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <p className="border-t-2 border-ink-line pt-8 text-sm text-muted">
          Everything on this page comes from <span className="font-mono text-xs">design/preset.js</span>,{' '}
          <span className="font-mono text-xs">design/tokens.css</span> and{' '}
          <span className="font-mono text-xs">src/components/ui</span>. A colour
          Kobblon does not have is added there or it does without.{' '}
          <Link to="/" className="font-bold text-link hover:underline">Back to Kobblon</Link>
        </p>
      </div>
    </main>
  )
}
