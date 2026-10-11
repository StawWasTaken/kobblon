import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/*
 * The tick.
 *
 * The square with a check in it that picking a friend, an outfit and a
 * colour all draw by hand. One of them now, so a tick looks like a tick
 * wherever it is.
 */
export function Tick({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'grid h-5 w-5 shrink-0 place-items-center rounded border text-[10px] transition-colors',
        on ? 'border-brand-bright bg-brand text-white' : 'border-ink-line',
        className,
      )}
    >
      {on && <FontAwesomeIcon icon={faCheck} />}
    </span>
  )
}

/** The tick with a label beside it, which is how it is used on a form. */
export function Tickbox({ on, onChange, label, className }: {
  on: boolean
  onChange: (next: boolean) => void
  label: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
        on
          ? 'border-brand-bright bg-brand/15 text-white'
          : 'border-ink-line bg-ink-raised text-white/70 hover:bg-ink-hover',
        className,
      )}
    >
      <Tick on={on} />
      <span className="min-w-0 flex-1 font-bold">{label}</span>
    </button>
  )
}
