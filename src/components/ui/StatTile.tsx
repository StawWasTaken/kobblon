import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

/**
 * A number that means something, big enough to read across the page.
 *
 * It is a button when pressing it changes the page, a link when it leads
 * somewhere, and neither when it is simply a fact. A number nobody has
 * counted yet shows a dot rather than a zero, because zero is a lie while a
 * list is still loading.
 */
export function StatTile({
  icon, value, label, active, onClick, to, className,
}: {
  icon?: IconDefinition
  value: number | string | null
  label: string
  active?: boolean
  onClick?: () => void
  to?: string
  className?: string
}) {
  const body = (
    <>
      {icon && <Glyph icon={icon} className="text-base" />}
      <span className="min-w-0">
        <span className="block font-display text-xl font-extrabold tabular-nums leading-none">
          {value ?? '·'}
        </span>
        <span className="block text-xs text-muted">{label}</span>
      </span>
    </>
  )

  const shape = cn(
    'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
    active
      ? 'border-brand-bright bg-brand/15'
      : 'border-ink-line bg-ink-card hover:bg-ink-hover',
    className,
  )

  if (to) return <Link to={to} className={shape}>{body}</Link>
  if (onClick) {
    return (
      <button onClick={onClick} aria-pressed={active} className={shape}>{body}</button>
    )
  }
  return <div className={shape}>{body}</div>
}
