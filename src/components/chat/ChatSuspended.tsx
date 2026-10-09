import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation, faComments } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/**
 * The card somebody sees when their chat has been turned off for a while.
 *
 * One component for the website and the Launcher, for the reason the rest
 * of the shared things exist: this is the worst moment anybody has on
 * Kobblon, and two versions of it drifting apart means two different
 * accounts of what happened depending on which window you are in.
 *
 * It takes no provider, no router and no session — everything it shows is
 * a prop. Mount it anywhere. `tools/site/suspended-preview.html` mounts it
 * with nothing around it, which is how we find out it still does.
 *
 * It is deliberately not dismissible by clicking past it. A suspension is
 * not a notification, and the one button says you have read it rather than
 * making it go away: the clock is on the server and the card can only
 * report it.
 */
export function ChatSuspended({
  minutes, until, over, reason, onUnderstand, onAppeal, className,
}: {
  /** How long it was given for, in minutes. */
  minutes: number
  /** When it ends, so the card can count down without asking again. */
  until: string
  /** Shown after the fact: the same card saying it is over. */
  over?: boolean
  reason?: string
  onUnderstand: () => void
  /** Left out entirely when there is nowhere to appeal to. */
  onAppeal?: () => void
  className?: string
}) {
  const [left, setLeft] = useState(() => remaining(until))

  /*
   * Counted down here rather than asked for again. The server decided
   * when this ends and said so once; a card that polls is a card that
   * disagrees with the server for a second every minute.
   */
  useEffect(() => {
    if (over) return
    const tick = setInterval(() => setLeft(remaining(until)), 1000)
    return () => clearInterval(tick)
  }, [until, over])

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="chat-suspended-title"
      className={cn(
        'w-full max-w-sm rounded-2xl border border-ink-line bg-ink-card p-6 text-center shadow-pop',
        className,
      )}
    >
      <FontAwesomeIcon
        icon={over ? faComments : faTriangleExclamation}
        className={cn('text-3xl', over ? 'text-yes' : 'text-white')}
      />

      <h2 id="chat-suspended-title" className="mt-3 font-display text-lg font-bold text-ink-strong">
        {over ? 'Chat is back' : 'Chat suspended'}
      </h2>

      <hr className="mx-auto my-4 w-full border-ink-line" />

      {over ? (
        <p className="text-sm text-muted">
          Your {minutes}-minute suspension is over. You can talk again.
        </p>
      ) : (
        <>
          <p className="text-sm font-bold text-ink-strong">
            {minutes} minute suspension
          </p>
          <p className="mt-2 text-sm text-muted">
            {reason
              ? `We've turned chat off for a few minutes: ${reason.toLowerCase()}`
              : "We've turned chat off for a few minutes because of language that goes against the Kobblon guidelines."}
          </p>
          <p className="mt-3 text-sm text-muted">
            If this keeps happening, the next one is longer.
          </p>
          <p className="mt-4 font-display text-2xl font-bold tabular-nums text-ink-strong">
            {left}
          </p>
        </>
      )}

      <button
        type="button"
        onClick={onUnderstand}
        className="mt-5 w-full rounded-xl bg-white px-4 py-2.5 font-display text-sm font-bold text-ink shadow-sm transition-colors hover:bg-white/90"
      >
        {over ? 'Thanks' : 'I understand'}
      </button>

      {onAppeal && !over && (
        <p className="mt-4 text-xs text-muted">
          Did we get this wrong?{' '}
          <button
            type="button"
            onClick={onAppeal}
            className="font-bold text-ink-strong underline underline-offset-2 hover:text-brand-bright"
          >
            Let us know
          </button>
        </p>
      )}
    </div>
  )
}

/** "4:38", counted from now, and never a negative number. */
function remaining(until: string): string {
  const left = Math.max(0, new Date(until).getTime() - Date.now())
  const all = Math.ceil(left / 1000)
  return `${Math.floor(all / 60)}:${String(all % 60).padStart(2, '0')}`
}
