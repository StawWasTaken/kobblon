import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faLayerGroup, faPenToSquare, faUsers } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useAsync } from '@/hooks/useAsync'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { getPlatformStats } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/** Counts up to the real value once, on first paint. No looping tickers. */
function Counter({ value }: { value: number }) {
  const [shown, setShown] = useState(0)
  const reduced = useReducedMotion()
  const frame = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (reduced || value === 0) {
      setShown(value)
      return
    }
    const start = performance.now()
    const duration = 900
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setShown(Math.round(value * eased))
      if (progress < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [value, reduced])

  return <>{formatCount(shown)}</>
}

function Tile({
  icon, label, value, accent,
}: {
  icon: IconDefinition
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-ink-line bg-ink-card/80 p-4 backdrop-blur">
      <span
        className={cn(
          'grid h-9 w-9 place-items-center rounded-xl text-sm',
          accent ? 'bg-space text-white' : 'bg-brand/25 text-link',
        )}
      >
        <FontAwesomeIcon icon={icon} />
      </span>
      <p className="mt-3 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">
        <Counter value={value} />
      </p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
    </div>
  )
}

export function PlatformStats({ className }: { className?: string }) {
  const { data, error, loading, reload } = useAsync(getPlatformStats, [])

  if (loading) {
    return (
      <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[7.5rem]" />)}
      </div>
    )
  }

  if (error || !data) return <ErrorState message={error ?? 'No numbers to show yet.'} onRetry={reload} />

  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      <Tile icon={faEye} label="Visits to Worlds" value={data.total_visits} />
      <Tile icon={faLayerGroup} label="Published Worlds" value={data.published_spaces} />
      <Tile icon={faPenToSquare} label="Updates made" value={data.total_updates} />
      <Tile icon={faUsers} label="People here" value={data.total_accounts} accent />
    </div>
  )
}
