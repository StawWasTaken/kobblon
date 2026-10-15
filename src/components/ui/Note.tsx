import { Glyph } from '@/components/brand/Glyph'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

/*
 * One line of information, in a box.
 *
 * The same shape the Launcher uses: a rectangle, an icon on the left, one
 * sentence next to it. One per screen. Anything that needs two sentences
 * belongs in the thing it is about, not in a box above it.
 */
export function Note({ tone = 'brand', icon = faCircleInfo, children, side, className }: {
  tone?: 'brand' | 'yes'
  icon?: IconDefinition
  children: React.ReactNode
  /** A link or a button on the right, when the note points somewhere. */
  side?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-ink-line bg-ink-raised px-4 py-3',
        className,
      )}
    >
      <Glyph
        icon={icon}
        className={cn('text-sm', tone === 'yes' ? 'text-space-bright' : 'text-brand-bright')}
      />
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-white/70">{children}</p>
      {side}
    </div>
  )
}
