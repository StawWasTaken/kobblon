/*
 * The Settings page, proposed rather than shipped.
 *
 * The first attempt went straight onto the site and Staw's verdict was
 * three things: not everything was redesigned, it was overcomplicated, and
 * it was not what we were after. So this is a drawing with nothing behind
 * it - every section, mocked, nothing routed, nothing saved - and it is
 * what the rule is from now on: a preview first, then a yes.
 *
 * What is different from the page that is live:
 *
 * - **One column of settings, not a stack of cards.** A console's settings
 *   are a long list with rules between the rows and a heading every few
 *   rows. Cards inside a panel inside a frame was three boxes deep for a
 *   row that says "Email".
 * - **The rail is names, not paragraphs.** Six words down the side. The
 *   sentence under each was the overcomplication.
 * - **The value is on the right, where it is answered.** Every row reads
 *   left to right: what it is, what it is set to, the way to change it.
 * - **Every section is drawn**, including the three that were left as they
 *   were: Privacy, Appearance, Safety.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faUser, faLock, faEye, faLink, faPalette, faShieldHalved,
  faChevronRight, faPen, faRightFromBracket, faMoon, faSun, faDesktop,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons'
import { faDiscord } from '@fortawesome/free-brands-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Avatar } from '@/components/ui/Avatar'
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

/** A heading inside a section: a few words and a rule out to the edge. */
function Head({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pb-2 pt-6 first:pt-0">
      <h3 className="shrink-0 font-display text-tiny font-extrabold uppercase tracking-[0.18em] text-white/40">
        {children}
      </h3>
      <span className="h-px flex-1 bg-ink-line" />
    </div>
  )
}

/**
 * One setting.
 *
 * Name on the left, what it is set to on the right, and the control after
 * it. No card, no tile, no icon: the rule under it is what separates it
 * from the next one, which is how every console settings list on earth is
 * drawn and it is lighter than anything we have.
 */
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
      {value !== undefined && (
        <span className="shrink-0 text-sm text-white/60">{value}</span>
      )}
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
    <div className="flex items-center gap-4 border-b border-ink-line px-1 py-3.5 last:border-0">
      <span className="w-40 shrink-0 text-sm font-bold">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

const input = 'h-10 w-full rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised px-3 text-sm focus:border-brand-bright focus:outline-none'

function Account() {
  return (
    <>
      <Head>Who you are</Head>
      <Field label="Display name"><input className={input} defaultValue="Staw" /></Field>
      <Field label="Username">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-white/70">@stawrer</p>
          <Button size="sm" variant="subtle" icon={faPen}>Change</Button>
        </div>
      </Field>
      <Field label="Gender">
        <div className="flex gap-2">
          {['Male', 'Female', 'Other'].map((one, i) => (
            <button
              key={one}
              className={cn(
                'rounded-xl border-2 border-b-4 px-3 py-1.5 text-sm font-bold',
                i === 0 ? 'border-brand-deep bg-brand text-on-art' : 'border-ink-line bg-ink-raised text-white/70',
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
      <Head>Getting in</Head>
      <Row
        label="Password"
        note="At least eight characters. You stay signed in here."
        action={<Button size="sm" variant="subtle">Change</Button>}
      />
      <Row label="Email" value="staw@kobblon.com" action={<Button size="sm" variant="subtle">Change</Button>} />

      <Head>This device</Head>
      <Row
        label="Log out"
        note="Ends this session on this device only."
        action={<Button size="sm" variant="subtle" icon={faRightFromBracket}>Log out</Button>}
      />
    </>
  )
}

function Privacy() {
  const rows: [string, string, string][] = [
    ['Who can message you', 'Friends', 'Everybody · Friends · Nobody'],
    ['Who can see your Worlds', 'Everybody', 'Everybody · Friends'],
    ['Who can see what you are playing', 'Friends', 'Everybody · Friends · Nobody'],
    ['Who can ask to be your friend', 'Everybody', 'Everybody · Nobody'],
  ]
  return (
    <>
      <Head>Who may</Head>
      {rows.map(([label, value, note]) => (
        <Row
          key={label}
          label={label}
          note={note}
          action={
            <span className="rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised px-3 py-1.5 text-sm font-bold">
              {value}
            </span>
          }
        />
      ))}

      {/* A switch draws its own row - label, note and the toggle - so it
          is the row rather than something put inside one. */}
      <Head>Showing</Head>
      <div className="space-y-2 py-2">
        <Switch on onChange={() => {}} label="Show when you are online" />
        <Switch
          on={false}
          onChange={() => {}}
          label="Show your Brix on your page"
          note="The number, not what you spent it on."
        />
      </div>
    </>
  )
}

function Connections() {
  return (
    <>
      <Head>Linked</Head>
      <Row
        label="Discord"
        note="Linked 12 November"
        value={<span className="inline-flex items-center gap-2"><Glyph icon={faDiscord} className="text-[#5865F2]" />@staw</span>}
        action={<Button size="sm" variant="subtle">Unlink</Button>}
      />
      <Row
        label="Who sees it"
        note="Your friends can see your handle."
        action={
          <span className="rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised px-3 py-1.5 text-sm font-bold">
            Friends
          </span>
        }
      />
    </>
  )
}

function Appearance() {
  const [mode, setMode] = useState('dark')
  return (
    <>
      <Head>Theme</Head>
      <div className="grid gap-2 py-3 sm:grid-cols-3">
        {([['dark', faMoon, 'Dark'], ['light', faSun, 'Light'], ['system', faDesktop, 'System']] as const).map(
          ([key, icon, name]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={cn(
                'flex items-center gap-3 rounded-xl border-2 border-b-4 px-3 py-2.5 text-left',
                mode === key ? 'border-brand-deep bg-brand text-on-art' : 'border-ink-line bg-ink-raised text-white/70',
              )}
            >
              <Glyph icon={icon} />
              <span className="text-sm font-bold">{name}</span>
            </button>
          ),
        )}
      </div>

      <Head>Text size</Head>
      <div className="flex gap-2 py-3">
        {[14, 16, 18, 20].map((px, i) => (
          <button
            key={px}
            className={cn(
              'h-11 w-14 rounded-xl border-2 border-b-4 font-bold',
              i === 1 ? 'border-brand-deep bg-brand text-on-art' : 'border-ink-line bg-ink-raised text-white/70',
            )}
            style={{ fontSize: px }}
          >
            A
          </button>
        ))}
      </div>
    </>
  )
}

function Safety() {
  return (
    <>
      <Head>Your standing</Head>
      <Row
        label="Nothing on record"
        note="No warnings, no suspensions. Carry on."
        value={<Glyph icon={faCircleCheck} className="text-space" />}
        to
      />

      <Head>If something is wrong</Head>
      <Row label="Write to us" note="Reports are anonymous to the person reported." to />
      <Row label="Policies" to />
      <Row label="Moderation and appeals" to />
    </>
  )
}

function Preview() {
  const [room, setRoom] = useState<Room>('Account')

  return (
    <div className="min-h-dvh bg-ink p-6">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="font-display text-3xl font-extrabold">Settings</h1>

        {/* Who is signed in, as one line rather than a card: the page is
            already about you, so this only has to say which you. */}
        <div className="mt-3 flex items-center gap-3 border-b-2 border-ink-line pb-4">
          <Avatar name="Staw" size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-extrabold">Staw</p>
            <p className="truncate text-xs text-muted">@stawrer · 48.2K Brix · here since Oct 2025</p>
          </div>
          <Button size="sm" variant="subtle">Your page</Button>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          {/* Six words. No sentences, no tiles: a settings rail is a table
              of contents and a table of contents is a list of names. */}
          <nav className="flex gap-1 overflow-x-auto pb-1 kob-scroll lg:block lg:space-y-0.5 lg:overflow-visible">
            {ROOMS.map((one) => {
              const on = one.name === room
              return (
                <button
                  key={one.name}
                  onClick={() => setRoom(one.name)}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-bold transition-colors lg:w-full',
                    on ? 'bg-brand text-on-art' : 'text-white/60 hover:bg-ink-hover hover:text-white',
                  )}
                >
                  <Glyph icon={one.icon} className={cn('w-4 text-xs', !on && 'text-brand-bright')} />
                  {one.name}
                </button>
              )
            })}
          </nav>

          <section className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold">{room}</h2>
            <div className="mt-3">
              {room === 'Account' && <Account />}
              {room === 'Security' && <Security />}
              {room === 'Privacy' && <Privacy />}
              {room === 'Connections' && <Connections />}
              {room === 'Appearance' && <Appearance />}
              {room === 'Safety' && <Safety />}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Preview /></MemoryRouter>,
)
