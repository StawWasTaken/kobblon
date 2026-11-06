import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

/*
 * One panel of a side rail, and the one drawing of it for the whole site.
 *
 * A World, a Community and the Creator Hub all have the same shape now -
 * the thing itself down the middle, the standing facts down the side - and
 * all three had written their own copy of this box. Three copies of a
 * border radius is how two pages end up looking like two products.
 *
 * Nothing here asks who is signed in, so a rail built out of it mounts
 * outside the website.
 */

/** A standing fact: enough of it shown to be worth reading, and the door to the rest. */
export function SidePanel({ icon, title, to, all, children, className }: {
  icon: IconDefinition
  title: string
  /** Where all of it is. Left out for a panel that is already all of itself. */
  to?: string
  all?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-2xl border border-ink-line bg-ink-card p-4', className)}>
      <h2 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-muted">
        <Glyph icon={icon} className="text-[11px]" />
        {title}
      </h2>
      {children}
      {to && all && (
        <Link
          to={to}
          className="mt-3 flex items-center gap-1.5 text-xs font-bold text-link hover:underline"
        >
          {all}
          <Glyph icon={faArrowRight} className="text-[10px]" />
        </Link>
      )}
    </section>
  )
}

/** One number and what it is of, for a panel that is a list of them. */
export function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xs font-bold tabular-nums text-white/90">{value}</dd>
    </div>
  )
}
