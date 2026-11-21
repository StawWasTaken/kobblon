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
        'divide-y divide-ink-line overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card',
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
        'kob-press flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left disabled:opacity-60',
        on
          ? 'kob-chosen border-brand-bright bg-brand/15'
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
        <h1 className="truncate font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {note && <p className="mt-1 text-sm text-muted sm:text-base">{note}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

/*
 * ---------------------------------------------------------------------
 * The settings page's own shapes, approved from a preview.
 *
 * `Panel`, `Group` and `Line` above are still Support's and Standing's -
 * those two are lists of cards and read correctly as cards. The settings
 * page is a long column with rules in it, which is what a console's
 * settings are, and Staw approved that shape from
 * `tools/site/settings-preview`. These are the four it is built from.
 */

/** The name of the room, with its mark, once at the top. */
export function Title({ icon, children }: { icon: IconDefinition; children: ReactNode }) {
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
export function Head({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pb-1 pt-6 first:pt-1">
      <h3 className="shrink-0 font-display text-tiny font-extrabold uppercase tracking-[0.18em] text-white/40">
        {children}
      </h3>
      <span className="h-px flex-1 bg-ink-line" />
    </div>
  )
}

/**
 * One setting: what it is, what it is set to, and the way to change it.
 *
 * No card round it: the rule under it is what separates it from the next
 * one. A mark only where the row is about a state somebody checks at a
 * glance - a standing, a link - never on every line.
 */
export function SettingRow({
  label, note, value, action, to, onClick, danger,
}: {
  label: ReactNode
  note?: ReactNode
  value?: ReactNode
  action?: ReactNode
  to?: string
  onClick?: () => void
  danger?: boolean
}) {
  const leads = !!to || !!onClick
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
      {leads && <Glyph icon={faChevronRight} className="shrink-0 text-xs text-muted" />}
    </>
  )
  const shape = cn(
    'flex w-full items-center gap-4 border-b border-ink-line px-1 py-3.5 text-left last:border-0',
    leads && 'transition-colors hover:bg-ink-hover',
  )
  if (to) return <Link to={to} className={shape}>{inside}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={shape}>{inside}</button>
  return <div className={shape}>{inside}</div>
}

/** A row whose right-hand side is a control rather than an answer. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-ink-line px-1 py-3.5 last:border-0">
      <span className="w-40 shrink-0 text-sm font-bold">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/**
 * A choice, with the lip.
 *
 * The avatar page's drawers are the shape - two-pixel border, four under
 * it, the one you are on in Kobblon blue with a deeper lip - and the one
 * that is off keeps the same thickness in a quiet colour, so the row does
 * not jump by three pixels when it is pressed. Staw: "the selectors look
 * a bit too flat you could do like we did in the avatar page".
 */
export function Pick({ on, icon, swatch, title, note, onClick, disabled, stack }: {
  on: boolean
  icon?: IconDefinition
  swatch?: ReactNode
  title: string
  note?: string
  onClick: () => void
  disabled?: boolean
  /** The art over the name rather than beside it, for a shelf of many. */
  stack?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      disabled={disabled}
      className={cn(
        'kob-press flex rounded-2xl border-2 transition-colors disabled:opacity-60',
        stack
          ? 'w-full flex-col items-center gap-2 px-2 py-3'
          : 'items-center gap-3 px-3.5 py-3 text-left',
        on
          ? 'border-brand-deep border-b-[6px] bg-brand text-on-art'
          : 'border-ink-line border-b-4 bg-ink-card text-white/75 hover:border-brand/50 hover:text-white',
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
      <span className={cn('min-w-0', stack && 'w-full text-center')}>
        <span className={cn(
          'block font-display font-extrabold leading-tight',
          stack ? 'truncate text-xs' : 'text-sm',
        )}>
          {title}
        </span>
        {note && !stack && (
          <span className={cn('mt-0.5 block text-xs leading-snug', on ? 'text-on-art/75' : 'text-muted')}>
            {note}
          </span>
        )}
      </span>
    </button>
  )
}

/**
 * The rail: one card with a row for each room, ending where the rooms do.
 *
 * Staw asked for both halves of that - "make this into a common card
 * thingy instead of multiple ones", and then that the card stop at the
 * last row rather than running down the page.
 */
export function SettingsRail<T extends string>({ label, items, value, onChange }: {
  label: string
  items: { value: T; label: string; icon: IconDefinition }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'flex gap-1 overflow-x-auto pb-1 kob-scroll',
        'lg:block lg:h-fit lg:space-y-1 lg:overflow-visible lg:rounded-2xl',
        'lg:border-2 lg:border-b-4 lg:border-ink-line lg:bg-ink-card lg:p-2',
      )}
    >
      {items.map((one) => {
        const on = one.value === value
        return (
          <button
            key={one.value}
            type="button"
            onClick={() => onChange(one.value)}
            aria-current={on}
            className={cn(
              'kob-press flex shrink-0 items-center gap-2.5 rounded-xl border-2 border-b-[5px] px-3 py-2 text-left text-sm font-bold transition-colors lg:w-full',
              on
                ? 'border-brand-deep bg-brand text-on-art'
                : 'border-transparent text-white/65 hover:bg-ink-hover hover:text-white',
            )}
          >
            <Glyph icon={one.icon} className={cn('w-4 text-xs', !on && 'text-brand-bright')} />
            {one.label}
          </button>
        )
      })}
    </nav>
  )
}
