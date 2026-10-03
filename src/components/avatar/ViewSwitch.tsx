/*
 * The pill in the corner of a viewer that says which way you are looking at
 * something: a picture of it, it in three dimensions, it on you.
 *
 * One component because it is one control. It was written on the Catalog
 * item page, and when the profile grew its own 2D/3D switch I drew a second
 * one that looked nearly the same - which Staw spotted immediately: "for the
 * 2d/3d bruh just use the same design we had for the catalog". Two controls
 * that mean the same thing and look different is the thing this project
 * keeps being told off for.
 *
 * It renders nothing when there is only one way to look: a switch with one
 * setting is a label pretending to be a control.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

export type ViewWay<T extends string> = {
  value: T
  icon: IconDefinition
  label: string
}

export function ViewSwitch<T extends string>({ ways, value, onChange, className }: {
  ways: ViewWay<T>[]
  value: T
  onChange: (next: T) => void
  className?: string
}) {
  if (ways.length < 2) return null

  return (
    <div
      className={cn(
        // The corner `MeshView` puts its switch in, so the gesture is in the
        // same place wherever somebody meets it.
        'absolute bottom-2 right-2 z-10 flex items-center gap-0.5 rounded-full border border-white/20 bg-ink/80 p-0.5 backdrop-blur-sm',
        className,
      )}
    >
      {ways.map((way) => (
        <button
          key={way.value}
          type="button"
          aria-pressed={value === way.value}
          onClick={() => onChange(way.value)}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors',
            value === way.value ? 'bg-brand text-white' : 'text-white/65 hover:text-white',
          )}
        >
          <FontAwesomeIcon icon={way.icon} />
          <span>{way.label}</span>
        </button>
      ))}
    </div>
  )
}
