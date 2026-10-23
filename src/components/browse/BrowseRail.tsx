import type { ReactNode } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { KobIcon } from '@/components/brand/Icon'
import { cn } from '@/lib/cn'

/*
 * The shape the five browsing pages share, taken from what My Avatar ended
 * up as rather than invented again.
 *
 * Staw, on the Catalog, Communities, Discover, People and Settings: "i would
 * like to redesign all of these pages cuz theyre not.. original enough and
 * they feel messy and i want to put order into these pages, the same way we
 * did put order into the my avatar page".
 *
 * What that page actually settled on, and what this holds to:
 *
 * - **One subject, as big as the page allows.** Whatever somebody came for
 *   gets the body. Nothing else is allowed to take a column off it, which is
 *   why the advert slot lives at the foot of the rail now and not cut into
 *   the middle of the grid.
 * - **Navigation down the side, not across the top of a grid.** Tabs over a
 *   grid push the grid down and read as somebody else's page. A rail with
 *   counts on it costs nothing and is ours.
 * - **Good ratios.** The rail is a fixed width and the body takes the slack,
 *   so one column cannot end up twice the other.
 *
 * It is a component rather than five copies because the five drifted apart
 * the last time they were written one at a time: one led with a panel, one
 * with a bare heading, one with the search buried three controls down.
 */

export type RailItem<T extends string> = {
  value: T
  label: string
  /**
   * Left out where the thing has no drawing of its own. Discover's genres
   * are the case: six rows of the same compass is six icons that say
   * nothing, and an icon that means nothing is worse than none, because the
   * reader spends a moment working out it means nothing.
   */
  icon?: IconDefinition
  /** Our own glyph, where one exists for this thing. */
  art?: KobIcon
  /** Shown beside the label. Null while it is still being counted. */
  count?: number | null
}

/**
 * The rail: a column of names with counts on them, a scrolling row of the
 * same thing on a phone.
 *
 * The count is on the label's line rather than pinned to a corner. Pinned,
 * it reads as an unread badge, which is the thing My Avatar had to undo.
 */
export function BrowseRail<T extends string>({
  label, heading, items, value, onChange, foot, className,
}: {
  /** What the rail is for, for anybody not looking at it. */
  label: string
  /**
   * Small words over the column, for a page whose rail has two of them.
   * Discover is the case: how to sort and what kind of World are two
   * questions, and one unbroken column of eleven buttons reads as one.
   */
  heading?: string
  items: RailItem<T>[]
  value: T
  onChange: (next: T) => void
  /** Anything under the column: an advert, a note, somewhere to go next. */
  foot?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('lg:space-y-2', className)}>
      {heading && (
        <p className="hidden px-1 pb-1 font-display text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/35 lg:block">
          {heading}
        </p>
      )}
      <nav
        aria-label={label}
        className={cn(
          /* No negative margin. `-mx-1` to let the scrolling row bleed
             into the gutter made the column eight pixels wider than its
             grid track, and on a phone that is the whole page scrolling
             sideways with every card clipped at the right. */
          'flex gap-1.5 overflow-x-auto pb-1 kob-scroll',
          'lg:block lg:space-y-1 lg:overflow-visible lg:rounded-2xl',
          'lg:border lg:border-ink-line lg:bg-ink-card lg:p-2 lg:pb-2',
        )}
      >
        {items.map((one) => {
          const on = one.value === value
          return (
            <button
              key={one.value}
              type="button"
              onClick={() => onChange(one.value)}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex h-10 shrink-0 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-bold transition-colors',
                'lg:w-full lg:border-transparent lg:px-3',
                on
                  ? 'border-brand bg-brand/15 text-white lg:border-brand/50'
                  : 'border-ink-line text-white/60 hover:text-white lg:hover:bg-ink-hover',
              )}
            >
              {one.icon ? (
                <Glyph
                  icon={one.icon}
                  name={one.art}
                  className={cn('w-4 shrink-0 text-xs', on ? 'text-brand-bright' : 'opacity-60')}
                />
              ) : (
                /* The same four of indent, so a column with no drawings
                   still lines its words up with one that has them. */
                <span
                  aria-hidden="true"
                  className={cn(
                    'ml-1 h-1.5 w-1.5 shrink-0 rounded-full',
                    on ? 'bg-brand-bright' : 'bg-white/20',
                  )}
                />
              )}
              <span className="truncate">{one.label}</span>
              {typeof one.count === 'number' && (
                <span
                  className={cn(
                    'ml-auto shrink-0 text-xs font-bold tabular-nums',
                    on ? 'text-white/70' : 'text-white/30',
                  )}
                >
                  {one.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {foot && <div className="hidden lg:block">{foot}</div>}
    </div>
  )
}

/**
 * The rail beside the body, with the body getting the slack.
 *
 * `13rem` and not a fraction: a rail that grows with the window ends up
 * holding six words of air beside a grid that wanted the room, and a grid
 * measured in fractions loses a column on the way past a breakpoint for no
 * reason anybody watching can name.
 */
export function BrowseFrame({ rail, children, className }: {
  rail: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      /*
       * `grid-cols-[minmax(0,1fr)]` and not a bare `grid`.
       *
       * A single-column grid track is `auto`, which sizes to its widest
       * child - and the rail on a phone is a scrolling row whose content is
       * wider than the screen by design. So the track grew to the row's full
       * width, and the whole page scrolled sideways with every card clipped
       * at the right edge. The explicit minmax caps the track at the column
       * and lets the row scroll inside it, which is what it was for.
       */
      className={cn(
        'grid grid-cols-[minmax(0,1fr)] items-start gap-5',
        'lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-7',
        className,
      )}
    >
      <div className="min-w-0 lg:sticky lg:top-20 lg:space-y-5">{rail}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/**
 * The name of what is on screen, with what it came to on the same line.
 *
 * A grid under a rail still needs to say which drawer is open, because the
 * rail is off to the side and a phone has scrolled past it. One line, and
 * the count is the answer to "did my filter do anything".
 */
export function BrowseHeading({ title, note, children, className }: {
  title: ReactNode
  /** The count, or "Looking…", or what the search came to. */
  note?: ReactNode
  /** Controls that belong to this body rather than to the whole page. */
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <h2 className="font-display text-xl font-extrabold sm:text-2xl">{title}</h2>
      {note && <span className="text-xs font-semibold text-muted">{note}</span>}
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
