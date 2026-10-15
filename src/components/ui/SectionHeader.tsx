import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

/** A row of things has a name, and often somewhere to see the rest of them. */
export function SectionHeader({
  title, icon, count, more, children, className,
}: {
  title: ReactNode
  icon?: IconDefinition
  count?: number | null
  more?: { to: string; label: string }
  /** Anything that belongs on the right besides a link. */
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-center gap-3', className)}>
      <h2 className="flex items-center gap-2 font-display text-xl font-extrabold sm:text-2xl">
        {icon && <Glyph icon={icon} className="text-base text-muted" />}
        {title}
        {typeof count === 'number' && <span className="text-white/40">({count})</span>}
      </h2>

      {children}

      {more && (
        <Link
          to={more.to}
          className="ml-auto text-xs font-bold text-link hover:underline"
        >
          {more.label}
        </Link>
      )}
    </div>
  )
}
