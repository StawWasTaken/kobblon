import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

/*
 * Picking one of a few things.
 *
 * There were two dozen of these written by hand across the site: sorts on
 * People, kinds in the Style shop, categories in Discover, what a block is in
 * the builder. Each had its own height, its own idea of what "chosen" looks
 * like and its own hover. One control now, in two sizes and two weights, so
 * choosing something looks the same wherever you are choosing it.
 */
export type Choice<T extends string> = {
  value: T
  label: string
  icon?: IconDefinition
}

const sizes = {
  sm: 'h-7 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3.5 text-sm',
}

export function Choices<T extends string>({
  value, options, onChange, size = 'md', tone = 'solid', className, label,
}: {
  value: T | null
  options: Choice<T>[]
  onChange: (next: T) => void
  size?: keyof typeof sizes
  /**
   * How the chosen one reads: `solid` fills with the brand colour and is for
   * a choice that changes what the page is showing; `soft` tints and is for a
   * filter sitting over the thing it filters.
   */
  tone?: 'solid' | 'soft'
  className?: string
  /** What the group is for, when the page has not already said. */
  label?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              'inline-flex shrink-0 items-center rounded-xl border font-bold transition-colors',
              sizes[size],
              active
                ? tone === 'solid'
                  ? 'border-brand-bright bg-brand text-onbrand'
                  : 'border-brand-bright bg-brand/15 text-white'
                : 'border-ink-line bg-ink-card text-white/60 hover:bg-ink-hover hover:text-white',
            )}
          >
            {option.icon && <Glyph icon={option.icon} className="text-[0.85em]" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
