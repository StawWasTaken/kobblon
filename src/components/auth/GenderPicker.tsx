import { Glyph } from '@/components/brand/Glyph'
import { faMars, faVenus, faGenderless } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

export type Gender = 'male' | 'female' | 'other' | ''

const options: { value: Exclude<Gender, ''>; label: string; icon: IconDefinition }[] = [
  { value: 'male', label: 'Male', icon: faMars },
  { value: 'female', label: 'Female', icon: faVenus },
  { value: 'other', label: 'Other', icon: faGenderless },
]

export function GenderPicker({
  value,
  onChange,
}: {
  value: Gender
  onChange: (next: Gender) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        Gender <span className="font-medium normal-case text-white/30">optional</span>
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const active = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? '' : option.value)}
              className={cn(
                'flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors',
                active
                  ? 'border-brand-bright bg-brand text-white'
                  : 'border-ink-line bg-ink-raised text-white/60 hover:bg-ink-hover hover:text-white',
              )}
            >
              <Glyph icon={option.icon} />
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
