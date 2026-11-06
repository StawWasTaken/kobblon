import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Link } from 'react-router-dom'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * One part of a page, with its name, how much of it there is, and the rule
 * that carries the heading out to the edge.
 *
 * This is the one drawing of a section heading on the site. A page built out
 * of these reads as one page rather than as a stack of cards, and a heading
 * that says "Badges 4" means you can see what is there by reading rather
 * than by pressing things to find out.
 *
 * Left out entirely when `hide` - a heading over nothing is worse than no
 * heading, and this is the only way to get rid of both at once.
 *
 * Nothing in it asks who is signed in. `to` wants a router; leave it out and
 * the band mounts anywhere, so the Workspace can use it.
 */
export function Band({ id, icon, title, count, to, all, hide, right, children }: {
  id?: string
  icon?: IconDefinition
  title: string
  count?: number
  /** Where all of it is, when the band is showing a part of something. */
  to?: string
  all?: string
  hide?: boolean
  /** Anything the page wants on the far side of the rule. */
  right?: React.ReactNode
  children: React.ReactNode
}) {
  if (hide) return null

  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="flex shrink-0 items-center gap-2 font-display text-lg font-extrabold">
          {icon && <Glyph icon={icon} className="text-sm text-brand-bright" />}
          {title}
          {!!count && (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold tabular-nums text-muted">
              {formatCount(count)}
            </span>
          )}
        </h2>

        <span className="h-px flex-1 bg-ink-line" />

        {right}
        {to && all && (
          <Link to={to} className="shrink-0 text-xs font-bold text-link hover:underline">
            {all}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/**
 * The numbers about a thing, in a row across the page rather than a table
 * down the side of it.
 *
 * A specification sheet goes down the side; a scoreboard goes across. A
 * World and a Community both have a scoreboard, so this is the drawing of
 * one: the number first and big, what it is underneath and small, because
 * the number is the thing being read.
 */
export function Ribbon({ children, className }: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-stretch rounded-2xl border border-ink-line bg-ink-card',
        'divide-ink-line sm:flex-nowrap sm:divide-x',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** One cell of a `Ribbon`. */
export function Stat({ label, value, tone }: {
  label: string
  value: React.ReactNode
  /** For a number that is true only this minute. */
  tone?: 'live'
}) {
  return (
    <div className="min-w-0 flex-1 px-3 py-3 text-center sm:px-4">
      <p
        className={cn(
          'truncate font-display text-xl font-extrabold leading-none tabular-nums',
          tone === 'live' ? 'text-space-bright' : 'text-white',
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
    </div>
  )
}
