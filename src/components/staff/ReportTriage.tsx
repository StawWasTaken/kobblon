import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare, faBan, faCommentSlash, faFlag, faGavel,
  faTrashCan, faTriangleExclamation, faUserSlash, faXmark,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/format'
import type { ReportAction, ReportTicket, StaffRank } from '@/lib/api'

/*
 * The card a report opens into, and the one action on the end of it.
 *
 * No provider, no router, no session: it takes a ticket and a rank and hands
 * back what was chosen. The staff console mounts it over the queue and the
 * Workspace can mount it in a panel, which is the whole reason it reads a
 * `rank` prop rather than asking who is signed in.
 *
 * What it will not do is decide anything. The rank hides the button that a
 * moderator may not press, and `take_report` refuses it again on the server -
 * so this is about not showing somebody a door that will not open, never
 * about being the lock.
 */

type Deed = {
  value: ReportAction
  label: string
  blurb: string
  icon: IconDefinition
  /** The lowest rank the server will accept this from. */
  needs: StaffRank
  danger?: boolean
}

const DEEDS: Deed[] = [
  {
    value: 'nothing',
    label: 'Nothing in it',
    blurb: 'Looked at it and there is nothing to answer. Recorded, so the same report does not come back for ever.',
    icon: faXmark,
    needs: 'moderator',
  },
  {
    value: 'content_removed',
    label: 'Take it down',
    blurb: 'The thing comes down and whoever made it is told why. The account is untouched.',
    icon: faTrashCan,
    needs: 'moderator',
  },
  {
    value: 'warning',
    label: 'Warn them',
    blurb: 'Said to them and put on their standing. Nothing is taken away.',
    icon: faTriangleExclamation,
    needs: 'moderator',
  },
  {
    value: 'chat_suspension',
    label: 'Suspend chat',
    blurb: 'They cannot talk for a while. The length is the ladder - five minutes, then six, then longer - and Kobblon picks it, not you.',
    icon: faCommentSlash,
    needs: 'moderator',
  },
  {
    value: 'suspension',
    label: 'Suspend the account',
    blurb: 'They cannot sign in. Give it an end date unless you mean it to last until somebody lifts it.',
    icon: faUserSlash,
    needs: 'moderator',
    danger: true,
  },
  {
    value: 'termination',
    label: 'Delete the account',
    blurb: 'Gone, and there is no way back. A superadmin by hand - the AI is refused this.',
    icon: faBan,
    needs: 'superadmin',
    danger: true,
  },
]

/** The ledger's words, said the way a person says them. */
const SAID: Record<string, string> = {
  none: 'nothing in it',
  warning: 'a warning',
  content_removed: 'the thing taken down',
  chat_suspension: 'chat suspended',
  suspension: 'the account suspended',
  termination: 'the account deleted',
}

const ORDER: Record<StaffRank, number> = {
  none: 0, moderator: 1, admin: 2, superadmin: 3,
}

/** The house rules a decision can be filed under, in the ledger's own words. */
const RULES = [
  'harassment', 'spam', 'sexual', 'violence', 'impersonation',
  'illegal', 'hate', 'cheating', 'copyright', 'age', 'other',
] as const

const DAYS = [
  { value: '1', label: 'One day' },
  { value: '3', label: 'Three days' },
  { value: '7', label: 'A week' },
  { value: '30', label: 'A month' },
  { value: '', label: 'Until somebody lifts it' },
]

function History({ ticket }: { ticket: ReportTicket }) {
  const muted = ticket.about_muted_until && new Date(ticket.about_muted_until) > new Date()
  const bits: { label: string; value: string; loud?: boolean }[] = [
    { label: 'Warnings', value: String(ticket.past_warnings) },
    { label: 'Heavier', value: String(ticket.past_heavy), loud: ticket.past_heavy > 0 },
    { label: 'Times quietened', value: String(ticket.past_mutes) },
    { label: 'Other reports open', value: String(ticket.other_open), loud: ticket.other_open > 0 },
  ]
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {bits.map((bit) => (
          <div key={bit.label} className="rounded-lg border border-ink-line bg-ink-hover p-2">
            <p className={cn('text-lg font-black', bit.loud ? 'text-amber-300' : 'text-white')}>
              {bit.value}
            </p>
            <p className="text-[0.7rem] uppercase tracking-wide text-muted">{bit.label}</p>
          </div>
        ))}
      </div>
      {(ticket.about_suspended || muted) && (
        <p className="flex flex-wrap items-center gap-2 text-xs">
          {ticket.about_suspended && (
            <Badge tone="danger">
              Suspended{ticket.about_suspended_until
                ? ` until ${new Date(ticket.about_suspended_until).toLocaleDateString()}`
                : ', with no end date'}
            </Badge>
          )}
          {muted && <Badge tone="warm">Chat is suspended</Badge>}
        </p>
      )}
    </div>
  )
}

export function ReportTriage({
  ticket,
  rank,
  onTake,
  onClose,
  className,
}: {
  ticket: ReportTicket
  rank: StaffRank
  /** Does it. Throwing is how a refusal gets shown, so the message survives. */
  onTake: (input: {
    action: ReportAction; why: string; rule: string; days: number | null
  }) => Promise<void>
  onClose?: () => void
  className?: string
}) {
  const [chosen, setChosen] = useState<ReportAction | null>(null)
  const [why, setWhy] = useState('')
  const [rule, setRule] = useState<string>(
    (RULES as readonly string[]).includes(ticket.reason) ? ticket.reason : 'other',
  )
  const [days, setDays] = useState('7')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)

  const allowed = useMemo(
    () => DEEDS.filter((deed) => ORDER[rank] >= ORDER[deed.needs]),
    [rank],
  )
  const deed = DEEDS.find((d) => d.value === chosen) ?? null
  const settled = ticket.status !== 'open'

  /* A profile has nothing to take down, and a message deliberately stays. */
  const canRemove = ticket.target_type !== 'profile' && ticket.target_type !== 'message'

  const go = async () => {
    if (!deed) return
    setWrong(null)
    if (deed.value !== 'nothing' && why.trim().length < 3) {
      setWrong('Say why. A sanction with no reason cannot be appealed.')
      return
    }
    setBusy(true)
    try {
      await onTake({
        action: deed.value,
        why: why.trim(),
        rule,
        days: deed.value === 'suspension' ? (days ? Number(days) : null) : null,
      })
    } catch (error) {
      setWrong(error instanceof Error ? error.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* What was reported */}
      <div className="space-y-2">
        <p className="flex flex-wrap items-center gap-2">
          <Badge tone="warm" icon={faFlag}>{ticket.reason}</Badge>
          <span className="text-base font-black">
            {ticket.subject_label ?? ticket.target_type}
          </span>
          {ticket.subject_gone && <Badge tone="neutral">Already gone</Badge>}
          <span className="text-xs text-muted">{timeAgo(ticket.created_at)}</span>
        </p>

        <p className="text-xs text-muted">
          {ticket.about_username ? <>About <span className="font-bold text-white/80">@{ticket.about_username}</span> · </> : null}
          Reported by{' '}
          <span className="font-bold text-white/80">
            {ticket.reporter_username ? `@${ticket.reporter_username}` : 'somebody'}
          </span>
          {ticket.subject_link && (
            <>
              {' · '}
              <a
                href={ticket.subject_link}
                className="font-bold text-link hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Open it <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-[0.65em]" />
              </a>
            </>
          )}
        </p>

        {ticket.details && (
          <p className="whitespace-pre-wrap rounded-lg border border-ink-line bg-ink-hover p-3 text-sm text-white/80">
            {ticket.details}
          </p>
        )}
      </div>

      {/* Who they are, so the tenth offence is not handled like the first */}
      <History ticket={ticket} />

      {settled ? (
        <p className="rounded-lg border border-ink-line bg-ink-hover p-3 text-sm text-muted">
          Already settled as{' '}
          <span className="font-bold text-white/80">
            {SAID[ticket.outcome ?? ''] ?? ticket.outcome}
          </span>
          {ticket.handled_by_username ? <> by @{ticket.handled_by_username}</> : null}
          {ticket.handled_at ? <> {timeAgo(ticket.handled_at)}</> : null}.
          {ticket.handled_note && <> “{ticket.handled_note}”</>}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-bold">
            <FontAwesomeIcon icon={faGavel} className="text-muted" />
            What happens about it
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {allowed.map((option) => {
              const off = option.value === 'content_removed' && !canRemove
              const on = chosen === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={off}
                  onClick={() => setChosen(on ? null : option.value)}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl border p-3 text-left transition',
                    off && 'cursor-not-allowed opacity-40',
                    on
                      ? option.danger
                        ? 'border-danger/60 bg-danger-soft'
                        : 'border-brand bg-brand/15'
                      : 'border-ink-line bg-ink-hover hover:border-white/25',
                  )}
                >
                  <FontAwesomeIcon
                    icon={option.icon}
                    className={cn('mt-0.5 shrink-0', option.danger ? 'text-danger' : 'text-muted')}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span className="block text-xs leading-snug text-muted">
                      {off
                        ? ticket.target_type === 'message'
                          ? 'A message stays: deleting it is how a harassment report loses its own evidence.'
                          : 'A profile is not a thing that can be taken down.'
                        : option.blurb}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {rank !== 'superadmin' && (
            <p className="text-xs text-muted">
              Deleting an account is a superadmin's, by hand. The AI cannot do it either.
            </p>
          )}

          {deed && (
            <div className="space-y-3 rounded-xl border border-ink-line bg-ink-hover p-3">
              <Textarea
                label={deed.value === 'nothing' ? 'A note, for the record' : 'Why — they are shown this'}
                value={why}
                onChange={(event) => setWhy(event.target.value)}
                rows={3}
                placeholder={
                  deed.value === 'nothing'
                    ? 'Nothing in it — the thing reported is fine.'
                    : 'What they did, in words they are allowed to read.'
                }
              />

              {deed.value !== 'nothing' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    label="Which rule"
                    value={rule}
                    onChange={setRule}
                    options={RULES.map((name) => ({ value: name, label: name }))}
                  />
                  {deed.value === 'suspension' && (
                    <Select
                      label="For how long"
                      value={days}
                      onChange={setDays}
                      options={DAYS}
                    />
                  )}
                </div>
              )}

              {wrong && (
                <p className="text-sm font-bold text-danger">{wrong}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={deed.danger ? 'danger' : 'yes'}
                  loading={busy}
                  icon={deed.icon}
                  onClick={() => void go()}
                >
                  {deed.label}
                </Button>
                <Button variant="ghost" onClick={() => setChosen(null)}>Back</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {onClose && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      )}
    </div>
  )
}
