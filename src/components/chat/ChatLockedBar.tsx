import { useEffect, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import {
  faComments, faMicrophoneSlash, faCommentSlash, faCircleInfo,
} from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/*
 * The box, while somebody is not allowed to talk.
 *
 * It replaces the composer rather than disabling it. A greyed-out input with
 * a line of red above it reads as something that went wrong; a solid panel
 * with a lock on it reads as a decision, which is what it is.
 *
 * It used to be a grey pill saying "Chat suspended" and a clock, and that
 * was the whole of it. The full card - `ChatSuspended` - is shown once, when
 * the suspension lands, and then never again; the pill is what somebody
 * actually lives with for the next hour, and it could not say what was taken
 * away, why, or which rule. Somebody who closed the card and came back had
 * no way to read any of it a second time. So the panel carries the same
 * facts the card does, in the composer's footprint, and offers the card
 * again rather than being the only thing left.
 *
 * Everything it shows is a prop. No provider, no router, no session: the
 * Launcher mounts it under its own chat with nothing around it. The way back
 * to the full account is `onDetails` rather than a link, because a `<Link>`
 * outside a router takes the panel down - which it has, three times.
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
  /**
   * Which ways of talking this took away: `['chat']`, or `['chat','voice']`.
   * Read rather than assumed. A panel that says "chat suspended" to somebody
   * whose microphone is also dead has told them something untrue.
   */
  channels,
  /**
   * `kind` is the older way of saying the same thing and is still read, so
   * an existing mount keeps working. `channels` wins where both are given.
   */
  kind = 'chat',
  /** Which numbered rule, so the panel points at one rather than at a page. */
  ruleOrd,
  ruleTitle,
  /** Why, in the words the decision was stored with. */
  reason,
  /** `'kobby'`, `'filter'` or `'staff'`, and `'machine'` on the old rows. */
  source,
  /** Shows the full card again. Left out and the panel offers nothing. */
  onDetails,
  className,
}: {
  until: string
  onOver?: () => void
  channels?: string[] | null
  kind?: 'chat' | 'voice'
  ruleOrd?: number | null
  ruleTitle?: string | null
  reason?: string | null
  source?: string | null
  onDetails?: () => void
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

  const ways = channels?.length ? channels : [kind]
  const voice = ways.includes('voice')
  const chat = ways.includes('chat')
  const what = voice ? (chat ? 'Chat and voice' : 'Voice chat') : 'Chat'
  const mark = over ? faComments : voice && !chat ? faMicrophoneSlash : faCommentSlash

  if (over) {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-xl border border-space/40 bg-space/10 px-3.5 py-2.5',
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <Glyph icon={faComments} className="shrink-0 text-space-bright" />
        <span className="truncate text-sm font-bold text-space-bright">
          {what} is back.
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-danger/35 bg-danger/[0.07] px-3.5 py-3',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-danger/15 text-danger">
          <Glyph icon={mark} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 truncate font-display text-sm font-extrabold text-white">
              {what} suspended
            </p>
            <span className="ml-auto shrink-0 font-mono text-sm font-extrabold tabular-nums text-danger">
              {remaining(left)}
            </span>
          </div>

          {!!ruleTitle && (
            <p className="mt-0.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              {ruleOrd ? `Rule ${ruleOrd} - ` : ''}{ruleTitle}
            </p>
          )}

          <p className="mt-1 text-xs leading-relaxed text-muted">
            {reason
              ? reason
              : `${what} is off for a while because of language that goes against the Kobblon guidelines.`}
          </p>

          {!!source && (
            <p className="mt-1 text-[11px] text-muted/80">
              {source === 'kobby' ? 'Decided by Kobby, reading what was said.'
                : source === 'filter' ? 'Given by the word filter.'
                : source === 'staff' ? 'Given by a moderator.'
                : 'Given automatically.'}
            </p>
          )}

          {onDetails && (
            <button
              type="button"
              onClick={onDetails}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-white underline underline-offset-2 transition-colors hover:text-brand-bright"
            >
              <Glyph icon={faCircleInfo} className="text-[11px]" />
              What happened, and how to appeal
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
