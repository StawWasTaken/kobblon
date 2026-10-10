import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/*
 * The box, while somebody is not allowed to talk.
 *
 * It replaces the composer rather than disabling it. A greyed-out input with
 * a line of red above it reads as something that went wrong; a solid bar with
 * a lock on it reads as a decision, which is what it is - and it is the same
 * thing somebody sees when they come back in an hour, so it has to say how
 * long is left rather than only that something happened.
 *
 * No provider, no router, no session: it takes a time and counts to it, so
 * the Launcher can mount it under its own chat with nothing around it.
 */

/** How long is left, as a person says it. */
function remaining(ms: number) {
  const all = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(all / 3600)
  const mins = Math.floor((all % 3600) / 60)
  const secs = all % 60
  return hours > 0
    ? `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${mins}:${String(secs).padStart(2, '0')}`
}

export function ChatLockedBar({
  until,
  /** Called the moment the clock runs out, so the box can come back. */
  onOver,
  /** 'chat' today. Voice is coming and wears the same bar. */
  kind = 'chat',
  className,
}: {
  until: string
  onOver?: () => void
  kind?: 'chat' | 'voice'
  className?: string
}) {
  const [left, setLeft] = useState(() => new Date(until).getTime() - Date.now())

  /*
   * The callback is deliberately not in the dependencies. It is written
   * inline at nearly every call site, so depending on it restarts the
   * interval on every render of the parent - which is the same clock
   * re-created once a second, and a countdown that stutters.
   */
  useEffect(() => {
    const ends = new Date(until).getTime()
    let done = false
    const tick = () => {
      const ms = ends - Date.now()
      setLeft(ms)
      if (ms <= 0 && !done) { done = true; onOver?.() }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until])

  const over = left <= 0

  return (
    <div
      className={cn(
        'flex h-9 items-center gap-2.5 rounded-full border px-3.5',
        over
          ? 'border-space/40 bg-space/10 text-space-bright'
          : 'border-ink-line bg-ink-hover text-white/55',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <FontAwesomeIcon
        icon={faLock}
        className={cn('shrink-0 text-xs', over ? 'text-space-bright' : 'text-white/40')}
      />
      {over ? (
        <span className="truncate text-sm font-bold">
          {kind === 'voice' ? 'Voice is back.' : 'Chat is back.'}
        </span>
      ) : (
        <>
          <span className="min-w-0 truncate text-sm">
            {kind === 'voice' ? 'Voice suspended' : 'Chat suspended'}
          </span>
          <span className="ml-auto shrink-0 font-mono text-sm font-bold tabular-nums text-white/80">
            {remaining(left)}
          </span>
        </>
      )}
    </div>
  )
}
