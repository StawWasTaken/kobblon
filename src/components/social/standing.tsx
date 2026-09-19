import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck, faTriangleExclamation, faLock, faBan,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'
import type { StandingLevel, Violation, ViolationAction } from '@/types/db'

/*
 * The words and the reading used by both the status page and one decision's
 * own page. Kept together so the two cannot drift: a decision must not be
 * called one thing in a list and another when you open it.
 */

/** How far along the bar each level sits, out of four. */
export const levelSteps: Record<StandingLevel, number> = {
  clear: 0,
  warned: 1,
  limited: 2,
  suspended: 3,
  terminated: 4,
}

export const levelWord: Record<StandingLevel, string> = {
  clear: 'All good',
  warned: 'Warned',
  limited: 'At risk',
  suspended: 'Suspended',
  terminated: 'Banned',
}

export const levelIcon: Record<StandingLevel, IconDefinition> = {
  clear: faCircleCheck,
  warned: faTriangleExclamation,
  limited: faTriangleExclamation,
  suspended: faLock,
  terminated: faBan,
}

export const levelTone: Record<StandingLevel, string> = {
  clear: 'text-space-bright',
  warned: 'text-amber-300',
  limited: 'text-amber-300',
  suspended: 'text-danger',
  terminated: 'text-danger',
}

/** What the bar means, said once, under it. */
export const levelLine: Record<StandingLevel, string> = {
  clear: 'Nothing is on record against this account. Keep it that way and this page stays boring.',
  warned: 'Something is on record. Nothing is switched off, and another one moves this bar.',
  limited: 'We may switch more off, suspend you for longer, or close the account if this carries on.',
  suspended: 'This account is suspended. What is left of it is here, and so is the way to appeal.',
  terminated: 'This account has been closed. The decision and the appeal are still readable here.',
}

export const actionWord: Record<ViolationAction, string> = {
  warning: 'Warning',
  content_removed: 'Taken down',
  feature_block: 'Switched off',
  suspension: 'Suspended',
  termination: 'Account closed',
}

export const ruleWord: Record<string, string> = {
  harassment: 'Harassment',
  spam: 'Spam',
  sexual: 'Sexual content',
  violence: 'Violence',
  impersonation: 'Impersonation',
  illegal: 'Something illegal',
  hate: 'Hate',
  cheating: 'Cheating the system',
  copyright: 'Somebody else’s work',
  age: 'Age',
  other: 'Something else',
}

/** What a decision was about, which is what somebody scans a list for. */
export const categoryWord: Record<string, string> = {
  message: 'Chat',
  profile: 'Your behaviour',
  space: 'A World of yours',
  asset: 'Something you uploaded',
  style_item: 'A Style item of yours',
  comment: 'A comment you left',
}

export const categoryOf = (one: Violation) =>
  (one.target_type ? categoryWord[one.target_type] : null) ?? ruleWord[one.rule] ?? 'Your account'

/** The line at the top of a decision's own page. */
export const headlineOf = (one: Violation) => {
  if (one.target_type === 'message') return 'Something you sent in chat broke the rules'
  if (one.target_type === 'comment') return 'A comment you left broke the rules'
  if (one.target_type === 'space') return 'A World of yours broke the rules'
  if (one.target_type === 'asset' || one.target_type === 'style_item') {
    return 'Something you uploaded broke the rules'
  }
  if (one.rule === 'copyright') return 'You posted work that was not yours'
  if (one.rule === 'impersonation') return 'You pretended to be somebody else'
  if (one.rule === 'cheating') return 'You worked around how Kobblon is meant to work'
  return 'Your behaviour broke the rules'
}

export const blockWord: Record<string, string> = {
  post: 'posting',
  comment: 'commenting',
  upload: 'uploading',
  sell: 'selling',
  chat: 'chat',
  publish: 'publishing Worlds',
  trade: 'buying and selling',
}

/** "Jul 18, 2026 | 3:14 AM", which reads as a moment rather than a date. */
export const stamp = (iso: string) => {
  const at = new Date(iso)
  return `${at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} | ${
    at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * How close this account is to being closed, as four steps rather than a
 * number. It fills from the wrong end on purpose: the bar is a distance left,
 * not a score going up.
 */
export function StandingBar({ level, className }: { level: StandingLevel; className?: string }) {
  const filled = levelSteps[level]
  const heavy = level === 'suspended' || level === 'terminated'

  return (
    <div className={className}>
      <div
        className="flex gap-1.5"
        role="img"
        aria-label={`${levelWord[level]}: ${filled} of 4 steps towards a closed account`}
      >
        {[0, 1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn(
              'h-2 flex-1 rounded-full transition-colors',
              step < filled
                ? heavy ? 'bg-danger' : 'bg-amber-400'
                : 'bg-ink-line',
            )}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-bold text-muted">
        <span>Banned</span>
        <span>All good</span>
      </div>
    </div>
  )
}

/** The badge a decision wears wherever it is shown. */
export function ActionTag({ one }: { one: Violation }) {
  const look = one.is_void
    ? 'border-space/40 bg-space/10 text-space-bright'
    : one.action === 'warning' || one.action === 'feature_block'
      ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
      : one.action === 'content_removed'
        ? 'border-white/15 bg-white/[0.06] text-white/70'
        : 'border-danger/40 bg-danger/10 text-danger'

  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide',
        look,
      )}
    >
      {one.is_void ? 'Voided' : actionWord[one.action]}
    </span>
  )
}

export function LevelMark({ level }: { level: StandingLevel }) {
  return (
    <FontAwesomeIcon icon={levelIcon[level]} className={cn('text-xl', levelTone[level])} />
  )
}
