import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

/*
 * A titled box.
 *
 * The shape old Roblox used everywhere and the reason those pages felt like
 * a place rather than a product: a strip across the top saying what the box
 * is, the thing itself under it, and the way to the rest of it on the same
 * strip. Everything is on the page and nothing is hidden behind a tab or a
 * bare uppercase label that could be anything.
 *
 * Modern Kobblon paint - our card, our line, our display face - on those
 * bones. Nothing here asks who is signed in, so a box built out of it
 * mounts outside the website.
 */
export function SidePanel({ icon, title, to, all, children, bare, className }: {
  icon?: IconDefinition
  title: string
  /** Where all of it is. Left out for a box that is already all of itself. */
  to?: string
  all?: string
  children: React.ReactNode
  /** No padding inside, for a box whose content is a list that owns its own. */
  bare?: boolean
  className?: string
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-ink-card', className)}>
      <header className="flex items-center gap-2 border-b border-ink-line bg-ink-raised/70 px-4 py-2.5">
        {icon && <Glyph icon={icon} className="text-xs text-muted" />}
        <h2 className="font-display text-sm font-extrabold">{title}</h2>
        {to && all && (
          <Link to={to} className="ml-auto shrink-0 text-xs font-bold text-link hover:underline">
            {all}
          </Link>
        )}
      </header>
      <div className={bare ? '' : 'p-4'}>{children}</div>
    </section>
  )
}

/** One row of a facts table: what it is on the left, the number on the right. */
export function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-line/60 py-1.5 last:border-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xs font-bold tabular-nums text-white/90">{value}</dd>
    </div>
  )
}
