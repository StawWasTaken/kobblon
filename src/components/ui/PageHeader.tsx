import type { ReactNode } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

/**
 * The top of a page: what it is, a line about it, and whatever you do from
 * here.
 *
 * Every page had its own, which is why the title was a different size on
 * People than on Friends and the buttons sat somewhere else again. The size
 * changes with the weight of the page, not with who wrote it: `plain` for a
 * list you came to use, `panel` for a page that opens with a statement.
 */
export function PageHeader({
  title, lead, kicker, icon, actions, aside, tone = 'plain', className,
}: {
  title: ReactNode
  lead?: ReactNode
  /** Small words above the title, for a page inside something bigger. */
  kicker?: string
  icon?: IconDefinition
  actions?: ReactNode
  /** Something that belongs at the far end: a face, a balance, a number. */
  aside?: ReactNode
  tone?: 'plain' | 'panel'
  className?: string
}) {
  const inner = (
    <div className="relative flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker && (
          <p className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-[0.3em] text-white/40">
            {icon && <Glyph icon={icon} className="text-brand-bright" />}
            {kicker}
          </p>
        )}
        <h1
          className={cn(
            'font-display font-extrabold leading-[0.95]',
            tone === 'panel' ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl',
            kicker && 'mt-3',
          )}
        >
          {title}
        </h1>
        {lead && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{lead}</p>
        )}
        {actions && <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {aside}
    </div>
  )

  if (tone === 'plain') return <header className={className}>{inner}</header>

  return (
    <header
      className={cn(
        'relative overflow-hidden rounded-3xl border border-ink-line bg-ink-card p-5 sm:p-8',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-brand/20 blur-3xl"
      />
      {inner}
    </header>
  )
}
