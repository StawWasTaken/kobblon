import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

export type Tab<T extends string> = {
  value: T
  label: string
  icon?: IconDefinition
  /** A number beside the name, for a list whose size is worth knowing. */
  count?: number | null
}

/**
 * Two or three ways of looking at the same page.
 *
 * Not the same thing as Choices: a tab changes what the page is, a choice
 * narrows what it shows. Keeping them apart keeps the site readable.
 *
 * Two shapes, for two jobs. A tray sits beside other controls, in a toolbar
 * or a card header. A line runs across the width of a page and divides what
 * is above it from what is below, which is what a profile, a Community and an
 * item page all want.
 */
export function Tabs<T extends string>({
  value, options, onChange, className, label, look = 'tray', accent,
}: {
  value: T
  options: Tab<T>[]
  onChange: (next: T) => void
  className?: string
  label?: string
  look?: 'tray' | 'line'
  /** A colour for the line under the chosen one, where a page has its own. */
  accent?: string
}) {
  if (look === 'line') {
    return (
      <div
        role="tablist"
        aria-label={label}
        className={cn('flex overflow-x-auto border-b border-ink-line kob-scroll', className)}
      >
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex-1 shrink-0 border-b-2 px-6 py-3 text-sm font-bold transition-colors sm:flex-none sm:px-10',
                active
                  ? 'border-white text-white'
                  : 'border-transparent text-white/50 hover:text-white',
              )}
              style={active && accent ? { borderColor: accent } : undefined}
            >
              {option.icon && <Glyph icon={option.icon} className="mr-2 text-xs" />}
              {option.label}
              {typeof option.count === 'number' && (
                <span className="ml-2 text-xs text-white/40 tabular-nums">{option.count}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('inline-flex shrink-0 gap-1 rounded-xl border border-ink-line bg-ink-card p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors',
              active ? 'bg-brand text-onbrand' : 'text-white/60 hover:bg-ink-hover hover:text-white',
            )}
          >
            {option.icon && <Glyph icon={option.icon} className="text-xs" />}
            {option.label}
            {typeof option.count === 'number' && (
              <span
                className={cn(
                  'rounded-md px-1.5 text-xs tabular-nums',
                  active ? 'bg-onbrand/20' : 'bg-ink-raised text-white/50',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
