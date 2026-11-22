import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

/*
 * The shapes every page of the Creator Hub is drawn from.
 *
 * The Hub was eight pages that looked like eight products: one opened with
 * a hero, one with five number tiles, one with a plain heading, one with a
 * form. Staw approved one shape for all of them from
 * `tools/site/hub-preview`, and this is it - the same five pieces Settings
 * was rebuilt on, so moving between the two halves of the site is moving
 * between rooms rather than between websites.
 */

/** The name of the page, its mark, what it is for, and the one thing to do. */
export function HubTop({ icon, title, lead, action }: {
  icon: IconDefinition
  title: string
  lead: string
  action?: ReactNode
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

/**
 * One number, with its mark and the lip.
 *
 * `mark` is for the places where the mark is one of Staw's drawings rather
 * than a glyph - a pressed thumb, somebody playing - because those carry
 * their own colours and `Glyph` only reaches for them when the call site
 * says which state it is in.
 */
export function Stat({ icon, mark, label, value, tone, note, big }: {
  icon?: IconDefinition
  mark?: ReactNode
  label: string
  value: string
  tone?: string
  note?: string
  /** The number in Kobblon's green, for a count of people in there now. */
  big?: boolean
}) {
  return (
    <div className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card px-4 py-3">
      <p className={cn(
        'flex items-center gap-1.5 text-mini font-extrabold uppercase tracking-wide',
        big ? 'text-space-bright' : 'text-muted',
      )}>
        {mark ?? (icon && <Glyph icon={icon} className={tone ?? 'text-brand-bright'} />)}
        {label}
      </p>
      <p className={cn(
        'mt-1 font-display text-2xl font-extrabold tabular-nums',
        big && 'text-space-bright',
      )}>
        {value}
      </p>
      {note && <p className="text-mini leading-snug text-muted">{note}</p>}
    </div>
  )
}

/** A few words over the rows they belong to, a rule, and a way to the rest. */
export function Head({ children, all, to, onAll }: {
  children: ReactNode
  all?: string
  to?: string
  onAll?: () => void
}) {
  return (
    <div className="flex items-center gap-3 pb-2">
      <h2 className="shrink-0 font-display text-tiny font-extrabold uppercase tracking-[0.18em] text-white/40">
        {children}
      </h2>
      <span className="h-px flex-1 bg-ink-line" />
      {all && to && (
        <Link to={to} className="shrink-0 text-xs font-bold text-link hover:underline">{all}</Link>
      )}
      {all && !to && (
        <button type="button" onClick={onAll} className="shrink-0 text-xs font-bold text-link hover:underline">
          {all}
        </button>
      )}
    </div>
  )
}

/** One card per section. Rows inside are separated by rules, not by cards. */
export function Sheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card', className)}>
      {children}
    </div>
  )
}

/** A rule-separated row inside a Sheet. */
export function HubRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      'flex items-center gap-3 border-b border-ink-line px-4 py-3 transition-colors last:border-0 hover:bg-ink-hover',
      className,
    )}>
      {children}
    </div>
  )
}

/**
 * A filter, with the lip; the chosen one in Kobblon blue.
 *
 * The one that is off keeps the same four-pixel lip in a quiet colour, so
 * a row of these does not jump when one of them is pressed.
 */
export function Chip({ on, icon, children, onClick, title }: {
  on: boolean
  icon?: IconDefinition
  children: ReactNode
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={cn(
        'kob-press inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border-2 border-b-4 px-3 text-xs font-extrabold transition-colors',
        on
          ? 'border-brand-deep bg-brand text-on-art'
          : 'border-ink-line bg-ink-card text-white/70 hover:border-brand/50 hover:text-white',
      )}
    >
      {icon && <Glyph icon={icon} className="text-tiny" />}
      {children}
    </button>
  )
}

/**
 * A short word about where something stands: live, in review, showing.
 *
 * Not a Chip - nothing is pressed here. `tone` carries both colours
 * because a flag over a picture needs a solid backing and one in a row
 * does not.
 */
export function Flag({ tone, icon, children }: {
  tone: string
  icon: IconDefinition
  children: ReactNode
}) {
  return (
    <span className={cn(
      'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-0.5 text-mini font-extrabold uppercase tracking-wide',
      tone,
    )}>
      <Glyph icon={icon} className="text-tiny" />
      {children}
    </span>
  )
}

/** Out in the world, said in the colour Kobblon says alive in. */
export function LiveFlag() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-space/15 px-2 py-0.5 text-mini font-extrabold uppercase tracking-wide text-space-bright">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-space-bright" />
      Live
    </span>
  )
}

/** A square of art at a size that fits a row: a World's emblem, a kind mark. */
export function HubTile({ src, size = 'md', children }: {
  src?: string | null
  size?: 'sm' | 'md'
  children?: ReactNode
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
