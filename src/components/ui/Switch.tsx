import { cn } from '@/lib/cn'

/*
 * On or off.
 *
 * The console said "May warn" and "May not warn" on the same button, which
 * reads as a label half the time and as a thing you are about to do the
 * other half. A switch has one label and a position, so there is nothing
 * to read twice.
 *
 * Green for on, because green is yes here.
 */
export function Switch({ on, onChange, label, note, busy, disabled, className }: {
  on: boolean
  onChange: (next: boolean) => void
  label: React.ReactNode
  /** One short line under the label, when the label alone is not enough. */
  note?: React.ReactNode
  busy?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled || busy}
      onClick={() => onChange(!on)}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        on ? 'border-space/50 bg-space/10' : 'border-ink-line bg-ink-raised hover:bg-ink-hover',
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{label}</span>
        {note && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{note}</span>}
      </span>
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
          on ? 'border-space bg-space' : 'border-ink-line bg-ink-line/60',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] h-4 w-4 rounded-full bg-white transition-[left] duration-150',
            on ? 'left-[25px]' : 'left-[3px]',
            busy && 'animate-pulse',
          )}
        />
      </span>
    </button>
  )
}
