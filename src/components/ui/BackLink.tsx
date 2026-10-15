import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/**
 * The way out of a page that sits inside something else: an event belongs to
 * a Community, a Space's settings belong to the Space. It names where it
 * goes rather than saying "back", so it is obvious before you click it.
 */
export function BackLink({
  to, children, className,
}: {
  to: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-2 text-sm font-bold text-white/55 transition-colors hover:text-white',
        className,
      )}
    >
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-ink-hover text-[11px]">
        <Glyph icon={faChevronLeft} />
      </span>
      {children}
    </Link>
  )
}
