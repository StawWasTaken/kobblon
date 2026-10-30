import { useEffect, useState } from 'react'

/** One unit, rounded down. `now` under five seconds, stopping at days. */
function said(at: number): string {
  const by = Math.max(0, Date.now() - at)
  if (by < 5_000) return 'now'
  const secs = Math.floor(by / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/**
 * When something was said, written `- 5m`.
 *
 * The dash is Staw's, asked for twice. It redraws itself on a timer that
 * slows as the number does - every five seconds for the first minute, then
 * every minute - because a time written once is a clock that stopped, and
 * a chat window somebody leaves open all evening is where that shows.
 *
 * The exact time is the `title`, which `TitleTips` draws in Kobblon's own
 * bubble rather than the browser's grey box.
 */
export function Ago({ at, className }: { at: string; className?: string }) {
  const when = new Date(at).getTime()
  const [, tick] = useState(0)

  useEffect(() => {
    const young = Date.now() - when < 60_000
    const timer = window.setInterval(() => tick((n) => n + 1), young ? 5_000 : 60_000)
    return () => window.clearInterval(timer)
    // Re-armed as it ages: the first minute wants five seconds, the hours
    // after it do not.
  }, [when, Math.floor((Date.now() - when) / 60_000) > 0])

  return (
    <span className={className} title={new Date(at).toLocaleString()}>
      - {said(when)}
    </span>
  )
}
