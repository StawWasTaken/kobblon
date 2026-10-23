import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import { cn } from '@/lib/cn'

/**
 * The four shapes a settings page is made of, and nothing else.
 *
 * Staw: "i dont want it overcrowded, with too much infos, but i want it to
 * the best design ever ... thats so good that we dont need to change it for
 * two years". Two years is the part that decides the design, and what lasts
 * is not a flourish - it is a page where every setting is the same shape, so
 * a new one has a place to go and nothing has to be redrawn to make room.
 *
 * So: a `Panel` is one subject, a `Group` is a card of settings that belong
 * together, a `Line` is one setting, and a `Choice` is one option among a
 * few. Every screen in Settings is those four. There is no fifth, and a
 * setting that does not fit one of them is a setting that has not been
 * decided yet.
 *
 * The rule that keeps it uncrowded is in `Line`: **a setting is a name, the
 * answer, and the way to change it.** Not a name, the answer, an
 * explanation, a warning and a link. Where something genuinely needs
 * explaining, it is one short line under the name - and if it needs more
 * than that, it needs a page, not a bigger row.
 */
export function Panel({ title, note, children }: {
  title: string
  /** One line. Not a paragraph; this is the page's own voice, used sparingly. */
  note?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">{title}</h2>
        {note && <p className="mt-1 text-sm leading-relaxed text-muted">{note}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * A card of settings that belong together.
 *
 * Dividers inside, space between cards. That pairing is what tells somebody
 * at a glance how many subjects are on the screen without reading a word of
 * it - four cards is four things, and twelve rules across one card is one
 * thing with twelve parts.
 */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'divide-y divide-ink-line overflow-hidden rounded-2xl border border-ink-line bg-ink-card',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * One setting: its name, what it is set to, and the control that changes it.
 *
 * The control goes right on a wide screen and under the name on a narrow
 * one, which is the only responsive rule on the page. It is a `div` by
 * default, a `Link` when `to` is given, and a `button` when `onClick` is -
 * so a row that leads somewhere is the whole row rather than a word at the
 * end of it, which is the difference between a settings page that works on
 * a phone and one that is merely drawn on it.
 */
export function Line({
  label, note, value, icon, to, onClick, action, danger, className,
}: {
  /**
   * Usually a string. It takes a node for the rows that carry a badge
   * beside the name - a ticket that is urgent, a sanction that is still on -
   * because that badge belongs on the name's line and nowhere else.
   */
  label: ReactNode
  /** One short line. Where it would take two, it wants its own page. */
  note?: ReactNode
  /** What it is set to right now, for a row that is showing rather than asking. */
  value?: ReactNode
  icon?: IconDefinition
  to?: string
  onClick?: () => void
  /** A button, a switch, a badge: whatever changes this one. */
  action?: ReactNode
  danger?: boolean
  className?: string
}) {
  const leads = !!to || !!onClick

  const inside = (
    <>
      {icon && (
        <Glyph
          icon={icon}
          className={cn('mt-0.5 w-4 shrink-0 text-sm', danger ? 'text-danger' : 'text-brand-bright')}
        />
      )}

      <span className="min-w-0 flex-1">
        {/* Wraps rather than truncates: a row's name is the thing it is, and
            on a phone "I cannot sig…" beside a badge is a row nobody can
            tell from the one under it. Two lines, then it gives up. */}
        <span className={cn('block line-clamp-2 text-sm font-bold', danger && 'text-danger')}>
          {label}
        </span>
        {/* What it is set to, then why - in that order. The other way
            round, a row reads as an explanation that happens to end in an
            answer, and the answer is the thing somebody came for. */}
        {value !== undefined && (
          <span className="mt-0.5 block truncate text-sm text-white/70">{value}</span>
        )}
        {note && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{note}</span>}
      </span>

      {action && <span className="ml-auto shrink-0 pl-2">{action}</span>}
      {leads && !action && (
        <Glyph icon={faChevronRight} className="ml-auto shrink-0 pl-2 text-xs text-muted" />
      )}
    </>
  )

  /*
   * One row at every width, rather than stacking the control under the
   * name on a phone. Stacked, the chevron on a row that leads somewhere
   * ends up on a line of its own under the words, pointing at nothing -
   * and the control that was meant to be reachable with a thumb is the
   * furthest thing down the card. A name truncates, a note wraps, and the
   * control keeps its corner.
   */
  const shape = cn(
    'flex w-full items-center gap-4 px-5 py-4 text-left',
    leads && 'transition-colors hover:bg-ink-hover',
    className,
  )

  if (to) return <Link to={to} className={shape}>{inside}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={shape}>{inside}</button>
  return <div className={shape}>{inside}</div>
}

/**
 * One option among a few, drawn as a tile you can see the answer in.
 *
 * Mode and the theme appearances were two separate copies of this tile and
 * had already drifted by a border radius and a hover colour. They are one
 * thing: a swatch, a name, a line about it, and a tick when it is the one
 * you are on.
 *
 * `swatch` is a drawing rather than an icon on purpose - a moon on black and
 * a mark on its own bar colour both say what you are picking far better than
 * a word does, and that is the whole reason this is a tile and not a list.
 */
export function Choice({ on, onClick, swatch, title, note, disabled }: {
  on: boolean
  onClick: () => void
  swatch: ReactNode
  title: string
  note?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors disabled:opacity-60',
        on
          ? 'border-brand-bright bg-brand/15'
          : 'border-ink-line bg-ink-card hover:bg-ink-hover',
      )}
    >
      <span className="shrink-0">{swatch}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        {note && <span className="block text-xs leading-snug text-muted">{note}</span>}
      </span>
      {on && (
        <span
          aria-hidden="true"
          className="ml-auto h-2 w-2 shrink-0 rounded-full bg-brand-bright"
        />
      )}
    </button>
  )
}

/**
 * The top of a page in this family: a name, one line, and whatever the page
 * is for on the right.
 *
 * Settings, Account standing and Support are one journey - somebody who is
 * in trouble goes through all three in a sitting - and they used to open
 * three different ways: an avatar and a gradient, a kicker over a 48px
 * heading with an icon, and the same again in another colour. Staw: "i want
 * these pages to be redesigned to be compatible and coherent with the
 * settings page".
 *
 * So one opening for all three. No kicker: a word in small caps above a
 * heading repeats what the heading already says, and the rail or the back
 * link says where you are better than it ever did.
 */
export function PageTop({ title, note, aside, action }: {
  title: string
  note?: string
  /** A face, where the page is about one person's account. */
  aside?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-center gap-3">
      {aside}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
