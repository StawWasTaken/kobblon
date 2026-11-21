/*
 * The Settings page, proposed rather than shipped. Second pass.
 *
 * Staw's notes on the first drawing, all four in:
 *
 * - **No account strip across the top.** The page is already about you.
 * - **Every piece of content kept.** The first pass quietly lost the
 *   theme appearances and had invented privacy rows that do not exist.
 *   This mirrors what the live page actually holds, section by section,
 *   including the appearances and the three text sizes.
 * - **Some icons, not a field of them.** The rail, the section heading and
 *   the tiles that are choices. Nothing on an ordinary row, where a mark
 *   beside every line is noise rather than help.
 * - **Nothing flat.** The rail and every selector carry the lip the avatar
 *   page's drawers wear: two-pixel border, four under it, and the chosen
 *   one in Kobblon blue. That is the platform's own "this is the one".
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { Logomark } from '@/components/brand/Wordmark'
import {
  faUser, faLock, faEye, faLink, faPalette, faShieldHalved,
  faChevronRight, faPen, faRightFromBracket, faMoon, faSun, faDesktop,
  faCircleCheck, faKey, faHeadset, faScroll, faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import { faDiscord } from '@fortawesome/free-brands-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/cn'
import '@/index.css'

type Room = 'Account' | 'Security' | 'Privacy' | 'Connections' | 'Appearance' | 'Safety'

const ROOMS: { name: Room; icon: IconDefinition }[] = [
  { name: 'Account', icon: faUser },
  { name: 'Security', icon: faLock },
  { name: 'Privacy', icon: faEye },
  { name: 'Connections', icon: faLink },
  { name: 'Appearance', icon: faPalette },
  { name: 'Safety', icon: faShieldHalved },
]

/* ------------------------------------------------------------- the shapes */

/** The name of the room, with its mark, once at the top of the panel. */
function Title({ icon, children }: { icon: IconDefinition; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-2xl font-extrabold">
      <span className="grid h-9 w-9 place-items-center rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised text-base text-brand-bright">
        <Glyph icon={icon} />
      </span>
      {children}
    </h2>
  )
}

/** A few words over the rows they belong to, and a rule out to the edge. */
function Head({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pb-1 pt-6 first:pt-1">
      <h3 className="shrink-0 font-display text-tiny font-extrabold uppercase tracking-[0.18em] text-white/40">
        {children}
      </h3>
      <span className="h-px flex-1 bg-ink-line" />
    </div>
  )
}

/** One setting: what it is, what it is set to, and the way to change it. */
function Row({ label, note, value, action, to, danger }: {
  label: string
  note?: string
  value?: React.ReactNode
  action?: React.ReactNode
  to?: boolean
  danger?: boolean
}) {
  const inside = (
    <>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-bold', danger && 'text-danger')}>{label}</span>
        {note && <span className="mt-0.5 block text-xs leading-snug text-muted">{note}</span>}
      </span>
      {value !== undefined && <span className="shrink-0 text-sm text-white/60">{value}</span>}
      {action}
      {to && <Glyph icon={faChevronRight} className="shrink-0 text-xs text-muted" />}
    </>
  )
  const shape = 'flex w-full items-center gap-4 border-b border-ink-line px-1 py-3.5 text-left last:border-0'
  return to
    ? <button type="button" className={cn(shape, 'transition-colors hover:bg-ink-hover')}>{inside}</button>
    : <div className={shape}>{inside}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-ink-line px-1 py-3.5 last:border-0">
      <span className="w-40 shrink-0 text-sm font-bold">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

const INPUT = 'h-10 w-full rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised px-3 text-sm focus:border-brand-bright focus:outline-none'

/**
 * A choice, with the lip.
 *
 * The avatar page's drawers are the shape: two-pixel border, four under
 * it, and the one you are on in Kobblon blue with a deeper lip. The one
 * that is off keeps the same thickness in a quiet colour so the row does
 * not jump by three pixels when you press it.
 */
function Pick({ on, icon, swatch, title, note, onClick, wide }: {
  on: boolean
  icon?: IconDefinition
  swatch?: React.ReactNode
  title: string
  note?: string
  onClick: () => void
  wide?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'kob-press flex items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-colors',
        on
          ? 'border-brand-deep border-b-[6px] bg-brand text-on-art'
          : 'border-ink-line border-b-4 bg-ink-card text-white/75 hover:border-brand/50 hover:text-white',
        wide && 'w-full',
      )}
    >
      {swatch ?? (icon && (
        <span className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2',
          on ? 'border-white/25 bg-white/15' : 'border-ink-line bg-ink-raised text-brand-bright',
        )}>
          <Glyph icon={icon} />
        </span>
      ))}
      <span className="min-w-0">
        <span className="block font-display text-sm font-extrabold leading-tight">{title}</span>
        {note && (
          <span className={cn('mt-0.5 block text-xs leading-snug', on ? 'text-on-art/75' : 'text-muted')}>
            {note}
          </span>
        )}
      </span>
    </button>
  )
}

/* -------------------------------------------------------------- the rooms */

function Account() {
  const [gender, setGender] = useState('Male')
  return (
    <>
      <Title icon={faUser}>Account</Title>

      <Head>Who you are</Head>
      <Field label="Display name"><input className={INPUT} defaultValue="Staw" /></Field>
      <Field label="Username">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-white/70">@stawrer</p>
          <Button size="sm" variant="subtle" icon={faPen}>Change</Button>
        </div>
      </Field>
      <Field label="Gender">
        <div className="flex flex-wrap gap-2">
          {['Male', 'Female', 'Other'].map((one) => (
            <button
              key={one}
              onClick={() => setGender(one)}
              className={cn(
                'kob-press rounded-xl border-2 px-3.5 py-1.5 text-sm font-bold transition-colors',
                gender === one
                  ? 'border-brand-deep border-b-[5px] bg-brand text-on-art'
                  : 'border-ink-line border-b-4 bg-ink-raised text-white/70 hover:text-white',
              )}
            >
              {one}
            </button>
          ))}
        </div>
      </Field>

      <Head>On record</Head>
      <Row label="Email" value="staw@kobblon.com" />
      <Row label="Birthday" value="9 May 2004" />
      <Row label="Names you have used" value="@staw" />
      <Row label="Picture, bio and colour" note="All three live on your page." to />
    </>
  )
}

function Security() {
  return (
    <>
      <Title icon={faLock}>Security</Title>

      <Head>Getting in</Head>
      <Row
        label="Password"
        note="At least eight characters. You stay signed in here."
        action={<Button size="sm" variant="subtle" icon={faKey}>Change</Button>}
      />

      <Head>This device</Head>
      <Row
        label="Log out"
        note="Ends this session on this device only."
        action={<Button size="sm" variant="subtle" icon={faRightFromBracket}>Log out</Button>}
      />
    </>
  )
}

/* The four the live page has, and no invented ones: a thought, where you
   are, who may follow you in, and the Discord handle. */
function Privacy() {
  const [on, setOn] = useState<Record<string, boolean>>({ thought: true, where: false, join: false, discord: false })
  const rows: [string, string, string][] = [
    ['thought', 'Your thought', 'What you are saying about yourself.'],
    ['where', 'The World you are in', 'Shown on your page and in lists.'],
    ['join', 'Joining you', 'Whether somebody can walk in after you.'],
    ['discord', 'Your Discord handle', 'Only where you have linked one.'],
  ]
  return (
    <>
      <Title icon={faEye}>Privacy</Title>
      <Head>Everyone, or friends only</Head>
      <div className="space-y-2 py-2">
        {rows.map(([key, label, note]) => (
          <Switch
            key={key}
            label={label}
            note={on[key] ? 'Everyone' : `Friends only · ${note}`}
            on={on[key]}
            onChange={(next) => setOn((was) => ({ ...was, [key]: next }))}
          />
        ))}
      </div>
    </>
  )
}

function Connections() {
  return (
    <>
      <Title icon={faLink}>Connections</Title>
      <Head>Linked</Head>
      <Row
        label="Discord"
        note="Linked 12 November."
        value={
          <span className="inline-flex items-center gap-2 font-bold">
            <Glyph icon={faDiscord} className="text-[#5865F2]" />@staw
          </span>
        }
        action={<Button size="sm" variant="subtle">Unlink</Button>}
      />
      <Row
        label="Who sees your handle"
        note="Set in Privacy, so there is one answer and one place for it."
        value="Friends"
        to
      />
    </>
  )
}

function Appearance() {
  const [mode, setMode] = useState('dark')
  const [size, setSize] = useState('default')
  const [look, setLook] = useState('kobblon')

  return (
    <>
      <Title icon={faPalette}>Appearance</Title>

      <Head>Light or dark</Head>
      <div className="grid gap-2.5 py-2 sm:grid-cols-3">
        <Pick on={mode === 'dark'} onClick={() => setMode('dark')} icon={faMoon} title="Dark" note="The way Kobblon is built." />
        <Pick on={mode === 'light'} onClick={() => setMode('light')} icon={faSun} title="Light" note="The same interface in daylight." />
        <Pick on={mode === 'system'} onClick={() => setMode('system')} icon={faDesktop} title="System" note="Follows this machine." />
      </div>

      <Head>Size</Head>
      <div className="grid gap-2.5 py-2 sm:grid-cols-3">
        {([
          ['minimalist', 'Minimalist', 'Smaller text, less room taken.', 12],
          ['default', 'Default', 'The way Kobblon is built.', 15],
          ['comfortable', 'Comfortable', 'Bigger text, more room to read.', 18],
        ] as const).map(([key, title, note, px]) => (
          <Pick
            key={key}
            on={size === key}
            onClick={() => setSize(key)}
            title={title}
            note={note}
            swatch={
              <span className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 font-bold',
                size === key ? 'border-white/25 bg-white/15' : 'border-ink-line bg-ink-raised',
              )} style={{ fontSize: px }}>
                Aa
              </span>
            }
          />
        ))}
      </div>

      {/* Kept, and it was the thing the first drawing lost. */}
      <Head>Theme appearances</Head>
      <div className="grid gap-2.5 py-2 sm:grid-cols-2">
        {([
          ['kobblon', 'Kobblon', 'The blue one. Everybody has this.'],
          ['halloween', 'Halloween', 'The bar and the rail in pumpkin orange.'],
          ['christmas', 'Christmas', 'Deep green chrome, and snow on some pages.'],
        ] as const).map(([key, title, note]) => (
          <Pick
            key={key}
            on={look === key}
            onClick={() => setLook(key)}
            title={title}
            note={note}
            swatch={
              <span
                data-appearance={key}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-ink-line bg-chrome"
              >
                <Logomark className="h-6" />
              </span>
            }
          />
        ))}
      </div>
      <p className="px-1 pb-2 text-xs text-muted">
        Halloween comes round in October. Christmas comes round in December.
      </p>
    </>
  )
}

function Safety() {
  return (
    <>
      <Title icon={faShieldHalved}>Safety</Title>

      <Head>Your standing</Head>
      <Row
        label="Nothing on record"
        note="No warnings, no suspensions. Carry on."
        value={<Glyph icon={faCircleCheck} className="text-space" />}
        to
      />

      <Head>If something is wrong</Head>
      <Row label="Write to us" note="Reports are anonymous to the person reported." value={<Glyph icon={faHeadset} className="text-muted" />} to />
      <Row label="Policies" value={<Glyph icon={faScroll} className="text-muted" />} to />
      <Row label="Moderation and appeals" value={<Glyph icon={faArrowUpRightFromSquare} className="text-muted" />} to />
    </>
  )
}

function Preview() {
  const [room, setRoom] = useState<Room>('Account')

  return (
    <div className="min-h-dvh bg-ink p-6">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="font-display text-3xl font-extrabold">Settings</h1>

        <div className="mt-5 grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          {/* The rail, with the lip - the avatar page's drawers down the
              side rather than across the top. */}
          <nav className="flex gap-2 overflow-x-auto pb-1 kob-scroll lg:block lg:space-y-1.5 lg:overflow-visible">
            {ROOMS.map((one) => {
              const on = one.name === room
              return (
                <button
                  key={one.name}
                  onClick={() => setRoom(one.name)}
                  aria-current={on}
                  className={cn(
                    'kob-press flex shrink-0 items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left text-sm font-bold transition-colors lg:w-full',
                    on
                      ? 'border-brand-deep border-b-[5px] bg-brand text-on-art'
                      : 'border-ink-line border-b-4 bg-ink-card text-white/65 hover:border-brand/50 hover:text-white',
                  )}
                >
                  <Glyph icon={one.icon} className={cn('w-4 text-xs', !on && 'text-brand-bright')} />
                  {one.name}
                </button>
              )
            })}
          </nav>

          <section className="min-w-0">
            {room === 'Account' && <Account />}
            {room === 'Security' && <Security />}
            {room === 'Privacy' && <Privacy />}
            {room === 'Connections' && <Connections />}
            {room === 'Appearance' && <Appearance />}
            {room === 'Safety' && <Safety />}
          </section>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Preview /></MemoryRouter>,
)
