import type { ReactNode } from 'react'
import { useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/**
 * The top of a page you came to look through.
 *
 * Communities, Discover and the Catalog are the same activity - a search, a
 * few ways to narrow it, and a grid underneath - and each of them had grown
 * its own version of that: one led with a panel and a tall field, one with a
 * bare heading and a thin input, one with a header and the search buried in
 * a card three controls down. Staw asked for the three to look like one
 * place, so the shape they share is a component and the parts that differ
 * stay theirs.
 *
 * What it owns: the panel, the title, the line under it, the one big field,
 * and whatever the page wants beside the heading. What it does not own: the
 * filters and the grid, because those are what makes each of the three the
 * page it is.
 */
export function BrowseHero({
  title, lead, icon, actions, value, onChange, placeholder, children, className,
}: {
  title: ReactNode
  lead?: ReactNode
  icon?: IconDefinition
  /** Buttons at the far end of the heading row. */
  actions?: ReactNode
  value: string
  onChange: (next: string) => void
  placeholder: string
  /** Anything that belongs under the field: a row of chips, a count. */
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl border border-ink-line bg-ink-card px-5 py-7 sm:px-8 sm:py-9',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-brand/20 blur-3xl"
      />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold sm:text-4xl">
              {icon && <FontAwesomeIcon icon={icon} className="text-brand-bright" />}
              {title}
            </h1>
            {lead && <p className="mt-1.5 max-w-xl text-sm text-muted">{lead}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        <div className="relative mt-5">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/35"
          />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-14 w-full rounded-2xl border border-ink-line bg-ink-raised pl-12 pr-12 text-base font-semibold shadow-card transition-colors placeholder:font-normal placeholder:text-white/30 focus:border-brand-bright focus:outline-none"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Clear the search"
              className="absolute right-4 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
        </div>

        {children}
      </div>
    </section>
  )
}

/**
 * A row of words you can press, which scrolls sideways when there are more
 * than fit.
 *
 * It is the row Staw pointed at in the Roblox marketplace screenshot, and
 * the reason it is worth copying is that it answers "what is in here" before
 * you have thought of a word yourself. Pressing one is a search, not a
 * filter - it puts the word in the field, so the back button and a link work
 * the same as if it had been typed.
 */
export function ChipRail({ words, value, onPick, className }: {
  words: string[]
  /** Whichever is currently searched for, so it reads as pressed. */
  value?: string
  onPick: (word: string) => void
  className?: string
}) {
  const rail = useRef<HTMLDivElement>(null)
  if (!words.length) return null

  return (
    <div
      ref={rail}
      className={cn('-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 kob-scroll', className)}
    >
      {words.map((word) => {
        const on = !!value && value.toLowerCase() === word.toLowerCase()
        return (
          <button
            key={word}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? '' : word)}
            className={cn(
              'h-8 shrink-0 rounded-full border px-3.5 text-xs font-bold capitalize transition-colors',
              on
                ? 'border-brand bg-brand text-onbrand'
                : 'border-ink-line bg-ink-raised text-white/65 hover:border-brand/60 hover:text-white',
            )}
          >
            {word}
          </button>
        )
      })}
    </div>
  )
}
