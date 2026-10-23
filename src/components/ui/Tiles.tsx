import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

/**
 * Pick one of a handful, drawn as tiles rather than a list of radios.
 *
 * It lived in `@/pages/Support` and the report card had its own copy made of
 * native radio inputs with a hex colour typed into it. Two pickers for one
 * job, and the older one was the one a person uses when something has gone
 * wrong. One of them now, here, where a component can import it without
 * importing a page.
 */
export function Tiles<T extends string>({ value, onChange, options, label, columns = 3 }: {
  value: T | null
  onChange: (value: T) => void
  options: { value: T; label: string; icon: IconDefinition }[]
  label: string
  /** How many across from `sm` up. Two, where the words are sentences. */
  columns?: 2 | 3
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid gap-2', columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}
    >
      {options.map((one) => {
        const picked = one.value === value
        return (
          <button
            key={one.value}
            type="button"
            aria-pressed={picked}
            onClick={() => onChange(one.value)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-colors',
              picked
                ? 'border-brand-bright bg-brand/20 text-white'
                : 'border-ink-line bg-ink-raised text-white/70 hover:bg-ink-hover',
            )}
          >
            <Glyph
              icon={one.icon}
              className={cn('shrink-0 text-base', picked ? 'text-brand-bright' : 'text-white/40')}
            />
            <span className="min-w-0 flex-1">{one.label}</span>
          </button>
        )
      })}
    </div>
  )
}
