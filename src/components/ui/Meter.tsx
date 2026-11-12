import { cn } from '@/lib/cn'

/**
 * How far along something is, as blocks rather than as liquid.
 *
 * Every progress bar on Kobblon is this one. The fill is cut into cells by
 * `kob-steps`, which is the whole of the pixel flavour in the system: a
 * quest, a level and a download all fill the same way, a block at a time,
 * and nothing else on the site carries a pixel grid. A bar that filled
 * smoothly read as a loading spinner lying on its side.
 *
 * `tone` is the one decision a caller makes, and it follows the palette's
 * jobs: `gem` for anything earned, `brand` for anything merely happening,
 * `space` for finished. Nothing may pass a colour.
 */
export function Meter({
  done,
  goal,
  tone = 'brand',
  label,
  className,
}: {
  done: number
  goal: number
  tone?: 'brand' | 'gem' | 'space'
  /** What a screen reader says this is measuring. */
  label?: string
  className?: string
}) {
  const part = Math.max(0, Math.min(1, goal > 0 ? done / goal : 0))
  const full = part >= 1
  return (
    <div
      className={cn('h-3.5 overflow-hidden rounded-full border-2 border-ink-line bg-ink-hover', className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(part * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className={cn(
          'kob-steps block h-full transition-[width] duration-500 motion-reduce:transition-none',
          full ? 'bg-space-bright' : tone === 'gem' ? 'bg-gem' : 'bg-brand-bright',
        )}
        style={{ width: `${part * 100}%` }}
      />
    </div>
  )
}
