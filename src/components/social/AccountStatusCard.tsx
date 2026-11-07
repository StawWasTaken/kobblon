import { useState } from 'react'
import type { ReactNode } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { Button } from '@/components/ui/Button'
import {
  faBan, faLock, faCircleMinus, faTriangleExclamation, faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'
import type { AccountLock } from '@/types/db'

/**
 * What a decision about this account looks like to the person it was made
 * about, wherever they happen to be standing.
 *
 * Staw asked for one thing above all the rest and it is the thing the old
 * arrangement got backwards: **nobody is signed out for this.** A warning,
 * a suspension and a closure all leave the session alone, because the
 * three places somebody needs after a decision - their record, the appeal
 * on it, and support - are all behind a sign-in. Signing them out was
 * punishing them by taking away the only doors they had.
 *
 * Four states, and they differ in exactly one thing, which is what the
 * person is allowed to do about it:
 *
 *   warned     answerable now. Saying you have read it puts the account
 *              straight back to normal standing; that is the whole
 *              sanction, and a warning nobody has to read is a note.
 *   limited    some things are off and the rest of the account is normal.
 *              Nothing to serve and nothing to lift, so the only button
 *              is the one that puts the card away for good.
 *   suspended  the same box as a warning, but it does nothing until the
 *              time is spent. Before then it is a notice with a date.
 *   banned     no box at all. An account does not let itself back in, and
 *              a control that looks like it might is worse than none.
 *
 * **The redesign.** Staw: "i dont like their design, second off its not
 * uniformized, third off its too wordy". It was a big tinted band with
 * the server's headline, a subtitle restating it, a prose paragraph, four
 * doors in a row and a closing reassurance - and the band changed shape
 * between the four, so they did not read as one thing. Now every one of
 * them is the same card: a mark and a word, one sentence, the facts in a
 * panel, one button. Only the colour, the word, the sentence and the
 * button change.
 *
 * No router, no provider, no session of its own: the Workspace mounts
 * this beside its own sign-in, and everything it needs arrives as a prop.
 */

/*
 * Four decisions, four colours, four words. Staw: a warning is yellow and
 * says "Warning", a suspension is magenta and says "Suspension", a
 * closure is red and says "Banned"; a feature block is a Restriction and
 * not a louder warning, which is what it used to come out as.
 */
const tones = {
  warned: { word: 'Warning', icon: faTriangleExclamation, text: 'text-yellow-300' },
  limited: { word: 'Restriction', icon: faCircleMinus, text: 'text-orange-300' },
  suspended: { word: 'Suspension', icon: faLock, text: 'text-fuchsia-300' },
  banned: { word: 'Banned', icon: faBan, text: 'text-danger' },
}

/** The sentence, as Staw wrote it. It is a promise, so it is not paraphrased. */
export const theUndertaking =
  'I acknowledge that my actions violated the ToS/Community Guidelines and '
  + 'I agree to respect them moving forward.'

const day = (value: string) => new Date(value).toLocaleDateString(undefined, {
  day: 'numeric', month: 'long', year: 'numeric',
})

const dayAndTime = (value: Date) => value.toLocaleString(undefined, {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export function AccountStatusCard({
  standing, onAcknowledge, busy, onClose, onSignOut,
  appealHref, standingHref = '/standing', supportHref = '/support',
  onOpen, compact, className,
}: {
  standing: AccountLock
  /** Ticked and sent. Absent means the card is a notice and nothing else. */
  onAcknowledge?: () => void
  busy?: boolean
  /** Putting a restriction away once it has been read. */
  onClose?: () => void
  /** The only thing a closed account can still do. */
  onSignOut?: () => void
  appealHref?: string
  standingHref?: string
  supportHref?: string
  /**
   * Where a door goes, when it may not go through the window itself.
   *
   * The Launcher's round 56: this is Electron, so an `<a href>` navigates
   * the only window there is out of the application and there is no way
   * back. Given, the doors stop being links and become buttons that hand
   * the address over - `shell.openExternal`, or whatever the bridge calls
   * it - and the application passes absolute `https://kobblon.com`
   * addresses as the hrefs.
   */
  onOpen?: (href: string) => void
  /** Narrow: the card inside a canvas rather than on a page. */
  compact?: boolean
  className?: string
}) {
  const [ticked, setTicked] = useState(false)

  /* One door, drawn once: a link when nothing is listening and a button
     when something is, rather than three copies of that choice. */
  const Door = ({ href, children }: { href: string; children: ReactNode }) => {
    const look = 'text-xs font-bold text-link hover:underline'
    return onOpen
      ? <button type="button" onClick={() => onOpen(href)} className={look}>{children}</button>
      : <a href={href} className={look}>{children}</a>
  }

  const which = standing.level === 'banned'
    ? 'banned'
    : standing.level === 'suspended'
      ? 'suspended'
      : standing.level === 'limited' ? 'limited' : 'warned'
  const tone = tones[which]

  const until = standing.until ? new Date(standing.until) : null
  const over = !!until && until.getTime() <= Date.now()
  const answerable = standing.can_acknowledge && !!onAcknowledge

  /*
   * One sentence, and it is ours rather than the server's.
   *
   * `headline` says the same thing in the same place and the card used to
   * print both, one under the other. The one case where the server knows
   * something this does not is a suspension whose time is spent, so that
   * one is said here too.
   */
  const line = which === 'banned'
    ? 'We closed this account for repeated or serious rule-breaking.'
    : which === 'suspended'
      ? (over
        ? 'Your suspension has run out. Say you have read this and you are back.'
        : 'We suspended this account. It comes back by itself when the time is up.')
      : which === 'limited'
        ? 'Some things are switched off. The rest of the account is normal.'
        : 'We gave this account a warning. Nothing is switched off.'

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-ink-line bg-ink-card shadow-pop',
        className,
      )}
    >
      <div className={cn('flex flex-1 flex-col', compact ? 'gap-3 p-4' : 'gap-4 p-5')}>
        {/* The mark and the word, on one line. No tinted band: the band was
            a different shape and a different height in each of the four,
            which is most of why they did not read as one thing. */}
        <div className="flex items-center gap-2.5">
          <Glyph icon={tone.icon} className={cn(tone.text, compact ? 'text-lg' : 'text-xl')} />
          <h2 className={cn(
            'font-display font-extrabold leading-none',
            tone.text,
            compact ? 'text-base' : 'text-lg',
          )}>
            {tone.word}
          </h2>
        </div>

        <p className="text-sm leading-relaxed text-white/85">{line}</p>

        {/* The facts, in the order somebody asks for them. */}
        <dl className="space-y-3 rounded-xl border border-ink-line bg-ink-raised p-3 text-sm">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Reason</dt>
            <dd className="mt-0.5 capitalize text-white/85">{standing.rule || 'Other'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Note</dt>
            <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed text-white/85">
              {standing.why?.trim() || 'No reason was recorded, which is itself worth appealing.'}
            </dd>
          </div>
          {standing.decided_at && (
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Decided</dt>
              <dd className="mt-0.5 text-white/85">{day(standing.decided_at)}</dd>
            </div>
          )}
          {until && !over && (
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Until</dt>
              <dd className="mt-0.5 text-white/85">{dayAndTime(until)}</dd>
            </div>
          )}
        </dl>

        {/* The box, only where ticking it does something: a suspension still
            running shows the date above and no control, because a checkbox
            that refuses is a door painted on a wall. */}
        {answerable && (
          <label className="flex cursor-pointer items-start gap-3">
            <span
              className={cn(
                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition-colors',
                ticked ? 'border-brand-bright bg-brand-bright text-white' : 'border-ink-line bg-ink',
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
            <span className="text-xs leading-relaxed text-white/85">{theUndertaking}</span>
          </label>
        )}

        {/* The foot: the two doors that matter on the left, the one thing
            to press on the right. `mt-auto` so a card given a height ends
            here rather than huddling at the top of an empty box. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-ink-line pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {standing.appeal_status ? (
              <span className="text-xs font-semibold text-muted">
                Appeal {standing.appeal_status}
              </span>
            ) : standing.can_appeal && (
              <Door
                href={appealHref ?? (standing.violation_id
                  ? `${standingHref}/${standing.violation_id}`
                  : standingHref)}
              >
                Appeal it
              </Door>
            )}
            <Door href={supportHref}>Support</Door>
            <Door href={standingHref}>Your record</Door>
          </div>

          {answerable ? (
            <Button
              variant="primary"
              disabled={!ticked}
              loading={busy}
              onClick={onAcknowledge}
            >
              {busy ? 'Sending' : which === 'suspended' ? 'Come back' : 'I understand'}
            </Button>
          ) : onClose ? (
            <Button variant="primary" loading={busy} onClick={onClose}>
              {busy ? 'Sending' : 'Got it'}
            </Button>
          ) : onSignOut ? (
            <Button variant="subtle" onClick={onSignOut}>
              Log out
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
