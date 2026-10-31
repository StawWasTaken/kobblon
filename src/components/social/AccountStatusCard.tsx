import { useState } from 'react'
import type { ReactNode } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import {
  faBan, faClock, faTriangleExclamation, faGavel, faScroll,
  faLifeRing, faCheck, faCircleCheck,
} from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'
import type { AccountLock } from '@/types/db'

/**
 * What a decision about this account looks like to the person it was made
 * about, wherever they happen to be standing.
 *
 * Staw asked for one thing above all the rest and it is the thing the old
 * arrangement got backwards: **nobody is signed out for this.** A warning,
 * a suspension and a closure all leave the session alone, because the three
 * places somebody needs after a decision - their record, the appeal on it,
 * and support - are all behind a sign-in. Signing them out was punishing
 * them by taking away the only doors they had.
 *
 * So there are three states and they differ in exactly one thing, which is
 * what the person is allowed to do about it:
 *
 *   warned     answerable now. Ticking the box and sending it puts the
 *              account straight back to normal standing; that is the whole
 *              sanction, and a warning nobody ever has to read is a note.
 *   suspended  the same box, but it does nothing until the time is spent.
 *              Before then the card is a notice and says the date.
 *   banned     no box at all. An account does not let itself back in, and
 *              a control that looks like it might is worse than none.
 *
 * No router, no provider, no session of its own: the Workspace mounts this
 * beside its own sign-in, and everything it needs arrives as a prop.
 */

const tones = {
  warned: {
    icon: faTriangleExclamation,
    edge: 'border-amber-400/40',
    wash: 'bg-amber-400/10',
    text: 'text-amber-300',
  },
  suspended: {
    icon: faClock,
    edge: 'border-amber-400/40',
    wash: 'bg-amber-400/10',
    text: 'text-amber-300',
  },
  banned: {
    icon: faBan,
    edge: 'border-danger/40',
    wash: 'bg-danger/10',
    text: 'text-danger',
  },
}

/** The sentence, as Staw wrote it. It is a promise, so it is not paraphrased. */
export const theUndertaking =
  'I acknowledge that my actions violated the ToS/Community Guidelines and '
  + 'I agree to respect them moving forward.'

export function AccountStatusCard({
  standing, onAcknowledge, busy, appealHref, standingHref = '/standing',
  supportHref = '/support', rulesHref = '/guidelines', onOpen, compact, className,
}: {
  standing: AccountLock
  /** Ticked and sent. Absent means the card is a notice and nothing else. */
  onAcknowledge?: () => void
  busy?: boolean
  appealHref?: string
  standingHref?: string
  supportHref?: string
  rulesHref?: string
  /**
   * Where a door goes, when it may not go through the window itself.
   *
   * The Launcher's round 56: this is Electron, so an `<a href>` navigates
   * the only window there is out of the application and there is no way
   * back. Given, the four doors stop being links and become buttons that
   * hand the address over - `shell.openExternal`, or whatever the bridge
   * calls it - and the application passes absolute `https://kobblon.com`
   * addresses as the four hrefs.
   *
   * Left out, they are ordinary links, which is what a page wants.
   */
  onOpen?: (href: string) => void
  /**
   * Narrow: the card inside a canvas rather than on a page.
   *
   * Asked for by the Launcher, which has to sit this inside the Escape
   * menu's own bounds. It is spacing and type only - nothing is hidden,
   * because a suspension read in a World and the same one read on
   * `/standing` have to be one decision and not two summaries of it.
   */
  compact?: boolean
  className?: string
}) {
  const [ticked, setTicked] = useState(false)

  /*
   * One door, drawn once. A link when nothing is listening and a button
   * when something is, rather than four copies of that choice.
   */
  const Door = ({ href, children, className: look }: {
    href: string
    children: ReactNode
    className?: string
  }) => (onOpen
    ? (
      <button type="button" onClick={() => onOpen(href)} className={look}>
        {children}
      </button>
    )
    : <a href={href} className={look}>{children}</a>
  )

  const which = standing.level === 'banned'
    ? 'banned'
    : standing.level === 'suspended' ? 'suspended' : 'warned'
  const tone = tones[which]

  const until = standing.until ? new Date(standing.until) : null
  const over = !!until && until.getTime() <= Date.now()
  const answerable = standing.can_acknowledge && !!onAcknowledge

  const when = (value: string) => new Date(value).toLocaleDateString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-ink-line bg-ink-card shadow-pop',
        className,
      )}
    >
      <header className={cn(
        'flex items-start gap-3 border-b',
        compact ? 'px-4 py-3' : 'px-5 py-4',
        tone.edge, tone.wash, tone.text,
      )}>
        <Glyph icon={tone.icon} className={cn('mt-0.5', compact ? 'text-base' : 'text-xl')} />
        <div className="min-w-0">
          <h2 className={cn(
            'font-black leading-tight',
            compact ? 'text-sm' : 'text-base sm:text-lg',
          )}>
            {standing.headline}
          </h2>
          <p className="mt-0.5 text-xs font-semibold opacity-80">
            {which === 'banned'
              ? 'This one is permanent. It stays until an admin lifts it.'
              : which === 'suspended'
                ? (until
                  ? (over
                    ? 'The time on it is spent. Say you have read it and you are back.'
                    : `Until ${until.toLocaleString(undefined, {
                      day: 'numeric', month: 'long', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}`)
                  : 'No end date was set, which is itself worth appealing.')
                : 'Nothing is switched off. Read it, say so, and it is done.'}
          </p>
        </div>
      </header>

      <div className={cn(compact ? 'space-y-4 p-4' : 'space-y-5 p-5')}>
        {/* The reason as it was written. Nobody is told "a violation
            occurred" and left to work out which thing they did. */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted">Why</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">
            {standing.why?.trim() || 'No reason was recorded, which is itself worth appealing.'}
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted">
            {standing.rule && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line bg-ink-raised px-2 py-1">
                <Glyph icon={faGavel} className="text-[10px]" />
                {standing.rule}
              </span>
            )}
            {standing.decided_at && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line bg-ink-raised px-2 py-1">
                <Glyph icon={faClock} className="text-[10px]" />
                {when(standing.decided_at)}
              </span>
            )}
          </div>
        </div>

        {/* The box. Only where ticking it does something: a suspension that
            is still running shows the notice above and no control, because
            a checkbox that refuses is a door painted on a wall. */}
        {answerable && (
          <div className={cn(
            'space-y-3 rounded-xl border border-ink-line bg-ink-raised',
            compact ? 'p-3' : 'p-4',
          )}>
            <label className="flex cursor-pointer items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition-colors',
                  ticked
                    ? 'border-brand-bright bg-brand-bright text-white'
                    : 'border-ink-line bg-ink',
                )}
              >
                {ticked && <Glyph icon={faCheck} className="text-[11px]" />}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={ticked}
                onChange={(event) => setTicked(event.target.checked)}
              />
              <span className="text-sm leading-relaxed text-white/85">{theUndertaking}</span>
            </label>

            <button
              type="button"
              disabled={!ticked || busy}
              onClick={onAcknowledge}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors',
                ticked && !busy
                  ? 'bg-space text-white hover:brightness-110'
                  : 'cursor-not-allowed bg-ink text-muted',
              )}
            >
              <Glyph icon={faCircleCheck} />
              {busy
                ? 'Sending'
                : which === 'suspended' ? 'Unfreeze my account' : 'I understand'}
            </button>
          </div>
        )}

        {/* The doors. Always here, in every one of the three states, which
            is the entire reason the session is left alone. */}
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-line pt-4">
          {standing.appeal_status ? (
            <span className="text-xs font-semibold text-muted">
              Your appeal is {standing.appeal_status}. You will get a letter when it is decided.
            </span>
          ) : standing.can_appeal && (
            <Door
              href={appealHref ?? (standing.violation_id
                ? `${standingHref}/${standing.violation_id}`
                : standingHref)}
              className="inline-flex items-center gap-2 rounded-xl border border-ink-line bg-ink-raised px-3 py-1.5 text-xs font-bold text-white hover:border-white/25"
            >
              <Glyph icon={faScroll} />
              Appeal it
            </Door>
          )}
          <Door
            href={supportHref}
            className="inline-flex items-center gap-2 rounded-xl border border-ink-line bg-ink-raised px-3 py-1.5 text-xs font-bold text-white hover:border-white/25"
          >
            <Glyph icon={faLifeRing} />
            Talk to support
          </Door>
          <Door
            href={standingHref}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold text-muted hover:text-white"
          >
            Your record
          </Door>
          <Door
            href={rulesHref}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold text-muted hover:text-white"
          >
            The rules
          </Door>
        </div>

        <p className="text-xs leading-relaxed text-muted">
          Nothing of yours has been deleted. Your things, your Worlds and your Brix
          are where you left them.
        </p>
      </div>
    </section>
  )
}
