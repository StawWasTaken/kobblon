import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck, faTriangleExclamation, faLock, faBan,
  faRobot, faUserShield, faShieldHalved, faCrown, faCommentSlash,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'
import type {
  BehaviourBand, ModeratedBy, ModerationRow, StandingLevel, Violation, ViolationAction,
} from '@/types/db'

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

/* ---------------------------------------------------------- the behaviour bar
 *
 * Staw asked for "a bar with how your behaviour was", and for the bar to buy
 * something: "the better your behaviour was the less moderated & punished you
 * will be". The number is the server's - `my_behaviour` - and everything here
 * is only how it is read out loud.
 */

export const bandWord: Record<BehaviourBand, string> = {
  exemplary: 'Exemplary',
  good: 'Good',
  mixed: 'Mixed',
  poor: 'Poor',
  critical: 'Very poor',
}

/** What the band buys, said as the thing it actually changes. */
export const bandLine: Record<BehaviourBand, string> = {
  exemplary: 'Nothing is on record. You get the gentlest version of every rule we have.',
  good: 'Something small is on record. You are still treated as a trusted account.',
  mixed: 'Enough is on record that we watch a little closer. The bar climbs on its own.',
  poor: 'A lot is on record. Punishments start a step higher than they would for most people.',
  critical: 'Almost everything is on record. The next thing that happens will be a long one.',
}

export const bandFill: Record<BehaviourBand, string> = {
  exemplary: 'bg-space',
  good: 'bg-space',
  mixed: 'bg-amber-400',
  poor: 'bg-amber-500',
  critical: 'bg-danger',
}

export const bandTone: Record<BehaviourBand, string> = {
  exemplary: 'text-space-bright',
  good: 'text-space-bright',
  mixed: 'text-amber-300',
  poor: 'text-amber-300',
  critical: 'text-danger',
}

export const bandGlow: Record<BehaviourBand, string> = {
  exemplary: 'shadow-[0_0_24px_-6px_rgb(var(--space)/0.75)]',
  good: 'shadow-[0_0_24px_-6px_rgb(var(--space)/0.6)]',
  mixed: 'shadow-[0_0_24px_-8px_rgb(251_191_36/0.6)]',
  poor: 'shadow-[0_0_24px_-8px_rgb(245_158_11/0.6)]',
  critical: 'shadow-[0_0_24px_-6px_rgb(var(--danger)/0.7)]',
}

/**
 * The bar itself: a filled track with the four band edges marked on it, so
 * the number has somewhere to sit rather than floating. The marks are where
 * the server's bands change - 20, 45, 70, 90 - and not decoration.
 */
export function BehaviourBar({ score, band, className, tall }: {
  score: number
  band: BehaviourBand
  className?: string
  tall?: boolean
}) {
  const safe = Math.max(0, Math.min(100, Math.round(score)))

  return (
    <div className={className}>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-ink-line',
          tall ? 'h-4' : 'h-2.5',
        )}
        role="img"
        aria-label={`Behaviour ${safe} out of 100: ${bandWord[band]}`}
      >
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out',
            bandFill[band], bandGlow[band],
          )}
          style={{ width: `${safe}%` }}
        />
        {[20, 45, 70, 90].map((edge) => (
          <span
            key={edge}
            className="absolute inset-y-0 w-px bg-ink/70"
            style={{ left: `${edge}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-bold text-muted">
        <span>Very poor</span>
        <span>Exemplary</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------- who decided it
 *
 * Mod, Admin, Superadmin, or Kobby. The rank and never the id: handing a
 * browser the id of the moderator who suspended somebody is how a moderator
 * gets harassed, so the server returns a word.
 */

export const byWord: Record<ModeratedBy, string> = {
  kobby: 'Kobby',
  moderator: 'A moderator',
  admin: 'An admin',
  superadmin: 'A superadmin',
  staff: 'Kobblon staff',
}

export const byIcon: Record<ModeratedBy, IconDefinition> = {
  kobby: faRobot,
  moderator: faShieldHalved,
  admin: faUserShield,
  superadmin: faCrown,
  staff: faUserShield,
}

/** What Kobby is, said once, wherever its name first appears. */
export const kobbyLine =
  'Kobby is our automated system. It reads what gets sent and acts on the '
  + 'obvious cases on its own. It can warn you and it can suspend you; it '
  + 'cannot close an account, and a person reads every appeal.'

export function ByBadge({ rank, className }: { rank: ModeratedBy; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5',
        'text-[11px] font-extrabold uppercase tracking-wide',
        rank === 'kobby'
          ? 'border-brand/40 bg-brand/10 text-brand-bright'
          : 'border-white/15 bg-white/[0.06] text-white/70',
        className,
      )}
    >
      <FontAwesomeIcon icon={byIcon[rank]} className="text-[10px]" />
      {rank === 'kobby' ? 'Kobby' : rank === 'staff' ? 'Staff' : rank}
    </span>
  )
}

/* --------------------------------------------------------- a history row */

/** Every action's word, the chat suspensions included. */
export const historyWord: Record<string, string> = {
  ...actionWord,
  chat_timeout: 'Chat suspended',
}

export const historyIcon: Record<string, IconDefinition> = {
  warning: faTriangleExclamation,
  content_removed: faBan,
  feature_block: faLock,
  suspension: faLock,
  termination: faBan,
  chat_timeout: faCommentSlash,
}

/** The headline a row wears in the list and at the top of its popup card. */
export const rowTitle = (one: ModerationRow) => {
  if (one.action === 'chat_timeout') return 'Your chat was suspended'
  if (one.action === 'warning') return 'You were warned'
  if (one.action === 'content_removed') return 'Something of yours was taken down'
  if (one.action === 'feature_block') return 'Something was switched off'
  if (one.action === 'suspension') return 'Your account was suspended'
  return 'Your account was closed'
}

/** "5 minutes", "7 days", "For good" - how long it held for. */
export const howLong = (from: string, until: string | null) => {
  if (!until) return 'For good'
  const minutes = Math.max(1, Math.round(
    (new Date(until).getTime() - new Date(from).getTime()) / 60000,
  ))
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  if (minutes < 60 * 48) {
    const hours = Math.round(minutes / 60)
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }
  const days = Math.round(minutes / 1440)
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`
  const months = Math.round(days / 30)
  return `${months} month${months === 1 ? '' : 's'}`
}

/**
 * How long it held, where that means anything.
 *
 * A warning and a takedown have no `until` and are not "for good": they
 * happened once and that was that. Saying "For good" on a warning is the
 * kind of wrong wording that makes somebody write in, so those two answer
 * with nothing and the page leaves the line out.
 */
export const heldFor = (one: Pick<ModerationRow, 'action' | 'at' | 'until'>) =>
  one.action === 'warning' || one.action === 'content_removed'
    ? null
    : howLong(one.at, one.until)

/** Whether a row is still holding right now, which is what somebody scans for. */
export const stillOn = (one: ModerationRow) =>
  !one.is_void
  && (one.action === 'termination'
    || (!!one.until && new Date(one.until) > new Date())
    || (one.until === null && one.action === 'suspension'))

/** Seventeen days, or "today", for the line about when the bar next moves. */
export const inDays = (iso: string) => {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 31) return `in ${days} days`
  const months = Math.round(days / 30)
  return `in about ${months} month${months === 1 ? '' : 's'}`
}
