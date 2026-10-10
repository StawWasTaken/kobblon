/*
 * The appeals queue.
 *
 * `decide_appeal` has existed since 0072 and nothing has ever called it.
 * Every appeal written from the standing page is a row sitting at `open`,
 * and the person who wrote it was told, in those words, that a human
 * reads every one. This is the screen that makes that true.
 *
 * Laid out as two sides because that is the decision: what was done, and
 * what they say about it. The left is the decision in full - the rule, the
 * evidence it was based on, which rank decided it, and how their bar
 * stands now. The right is their own words, untouched.
 *
 * Which rank, never who. The status page has followed that rule since
 * 0203 and so does this: handing a browser the id of the moderator who
 * suspended somebody is how a moderator gets harassed.
 */
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGavel, faCircleCheck, faBan, faClock, faScaleBalanced, faQuoteLeft,
  faHourglassHalf, faInbox, faThumbsUp, faThumbsDown,
} from '@fortawesome/free-solid-svg-icons'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Drawer } from '@/components/ui/Drawer'
import { StatTile } from '@/components/ui/StatTile'
import { Tabs } from '@/components/ui/Tabs'
import { Skeleton, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import {
  BehaviourBar, ByBadge, bandTone, bandWord, historyWord,
} from '@/components/social/standing'
import { appealQueue, appealCounts, decideAppeal } from '@/lib/api'
import type { AppealRow } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'

/** "a suspension", not "suspended": the title reads as a sentence. */
const againstWord: Record<string, string> = {
  warning: 'a warning',
  content_removed: 'a takedown',
  feature_block: 'something being switched off',
  suspension: 'a suspension',
  termination: 'an account being closed',
  chat_timeout: 'a chat suspension',
}

const waited = (hours: number) => {
  if (hours < 1) return 'just now'
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${Math.round(hours / 24)} days`
}

export function AppealsQueue() {
  const [which, setWhich] = useState<'open' | 'answered' | 'all'>('open')
  const [open, setOpen] = useState<AppealRow | null>(null)

  const queue = useAsync(async () => appealQueue(which), [which])
  const counts = useAsync(async () => appealCounts(), [])

  const after = () => { queue.reload(); counts.reload(); setOpen(null) }
  const sums = counts.data

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Somebody disagreeing with a decision. They were told a person who was not part of it
        reads this, so that is the job: read what was done, read what they say, and either put
        it back or leave it. Upholding one voids the decision, lifts its weight off their
        behaviour bar, and lets a suspension go if nothing else is holding it.
      </p>

      <div className="grid gap-2 sm:grid-cols-4">
        <StatTile icon={faInbox} value={sums?.waiting ?? null} label="Waiting" />
        <StatTile
          icon={faHourglassHalf}
          value={sums ? waited(sums.oldest_hours) : null}
          label="Oldest one"
          className={sums && sums.oldest_hours > 72 ? 'border-amber-400/40 bg-amber-400/[0.07]' : undefined}
        />
        <StatTile icon={faThumbsUp} value={sums?.upheld_30d ?? null} label="Upheld, 30 days" />
        <StatTile icon={faThumbsDown} value={sums?.declined_30d ?? null} label="Declined, 30 days" />
      </div>

      <Tabs
        label="Which appeals"
        value={which}
        onChange={(next) => setWhich(next as typeof which)}
        options={[
          { value: 'open', label: 'Waiting' },
          { value: 'answered', label: 'Answered' },
          { value: 'all', label: 'Everything' },
        ]}
      />

      {queue.loading ? <Skeleton className="h-40" />
        : queue.error ? <ErrorState message={queue.error} onRetry={queue.reload} />
        : !queue.data?.length ? (
          <p className="py-10 text-center text-sm text-muted">
            {which === 'open' ? 'Nobody is waiting on an answer.' : 'Nothing here.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.data.map((one, i) => (
              <li
                key={one.id}
                className="animate-row-in"
                style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
              >
                <AppealLine one={one} onOpen={() => setOpen(one)} />
              </li>
            ))}
          </ul>
        )}

      {open && <AppealDrawer one={open} onClose={() => setOpen(null)} onDecided={after} />}
    </div>
  )
}

export function AppealLine({ one, onOpen }: { one: AppealRow; onOpen: () => void }) {
  const slow = one.status === 'open' && one.waiting_hours > 72

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-left transition-colors',
        slow
          ? 'border-amber-400/40 bg-amber-400/[0.06] hover:border-amber-400/70'
          : 'border-ink-line bg-ink-raised hover:border-white/25',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{historyWord[one.action] ?? one.action}</span>
          <ByBadge rank={one.by_rank} />
          <span className="text-xs text-muted">@{one.username ?? 'somebody'}</span>
          {one.status === 'open' ? (
            <Badge tone={slow ? 'warm' : 'brand'}>Waiting {waited(one.waiting_hours)}</Badge>
          ) : (
            <Badge tone={one.status === 'upheld' ? 'space' : 'neutral'}>
              {one.status === 'upheld' ? 'Upheld' : 'Declined'}
            </Badge>
          )}
          {one.rule_ord && <span className="text-xs text-muted">Rule {one.rule_ord}</span>}
        </span>
        <span className="mt-1 block truncate text-xs text-white/60">{one.body}</span>
      </span>

      <span className="shrink-0 text-right">
        <span className={cn('block font-display text-lg font-extrabold tabular-nums', bandTone[one.band])}>
          {one.score}
        </span>
        <span className="block text-[11px] text-muted">their bar</span>
      </span>
    </button>
  )
}

/* ------------------------------------------------------------ one appeal */

export function AppealDrawer({ one, onClose, onDecided }: {
  one: AppealRow
  onClose: () => void
  onDecided: () => void
}) {
  const say = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'upheld' | 'declined' | null>(null)

  const decide = async (upheld: boolean) => {
    const said = note.trim()
    if (said.length < 10) {
      say('Say why. They are sent this, word for word.', 'error')
      return
    }
    setBusy(upheld ? 'upheld' : 'declined')
    try {
      await decideAppeal(one.id, upheld, said)
      say(upheld ? 'Upheld. The decision has been voided.' : 'Declined. They have been told.', 'success')
      onDecided()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title={`Appeal against ${againstWord[one.action] ?? 'a decision'}`}
      badge={
        one.status === 'open'
          ? <Badge tone="brand">Waiting {waited(one.waiting_hours)}</Badge>
          : <Badge tone={one.status === 'upheld' ? 'space' : 'neutral'}>
              {one.status === 'upheld' ? 'Upheld' : 'Declined'}
            </Badge>
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>@{one.username ?? 'somebody'}</span>
          <span>sent {timeAgo(one.created_at)}</span>
          <span>decision made {timeAgo(one.decided_on)}</span>
        </span>
      }
      footer={one.status === 'open' ? (
        <>
          <Button
            size="sm"
            variant="subtle"
            icon={faCircleCheck}
            loading={busy === 'upheld'}
            disabled={!!busy}
            onClick={() => decide(true)}
            className="border-space/50 text-space-bright"
          >
            Put it back
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={faBan}
            loading={busy === 'declined'}
            disabled={!!busy}
            onClick={() => decide(false)}
          >
            It stands
          </Button>
          <p className="ml-auto text-xs text-muted">
            They are sent what you write, as you write it.
          </p>
        </>
      ) : undefined}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ------------------------------------------- what was decided */}
        <div className="space-y-3">
          <p className="flex items-center gap-2 font-display text-xs uppercase tracking-wider text-muted">
            <FontAwesomeIcon icon={faGavel} />
            What was decided
          </p>

          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-extrabold">
                {historyWord[one.action] ?? one.action}
              </span>
              <ByBadge rank={one.by_rank} />
              {one.is_void && <Badge tone="space">Already void</Badge>}
            </div>

            <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <FontAwesomeIcon icon={faClock} />
              {timeAgo(one.decided_on)}
              {one.expires_at && <span>· until {new Date(one.expires_at).toLocaleDateString()}</span>}
            </p>

            {one.rule_title && (
              <p className="flex items-start gap-2 rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm">
                <FontAwesomeIcon icon={faScaleBalanced} className="mt-0.5 text-brand-bright" />
                <span>
                  <span className="font-bold">
                    {one.rule_ord ? `Rule ${one.rule_ord} — ` : ''}{one.rule_title}
                  </span>
                </span>
              </p>
            )}

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
              {one.reason}
            </p>

            {one.evidence && (
              <div>
                <p className="mb-1.5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  <FontAwesomeIcon icon={faQuoteLeft} />
                  What it was based on
                </p>
                <blockquote className="rounded-xl rounded-tl-md border border-amber-400/30 bg-amber-400/[0.07] px-3 py-2">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
                    {one.evidence}
                  </p>
                </blockquote>
              </div>
            )}

            {!one.evidence && (
              <p className="text-xs text-muted">
                Nothing was kept with this decision. Anything decided before the evidence
                column existed has none, which is a reason to be careful rather than a
                reason to decline.
              </p>
            )}
          </Card>

          {/* ------------------------------------------- how they stand */}
          <Card className="space-y-2 p-4">
            <div className="flex items-end justify-between gap-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
                Their bar now
              </p>
              <p className={cn('font-display text-lg font-extrabold tabular-nums', bandTone[one.band])}>
                {one.score}<span className="text-xs text-muted">/100</span>
              </p>
            </div>
            <BehaviourBar score={one.score} band={one.band} />
            <p className={cn('text-sm font-bold', bandTone[one.band])}>{bandWord[one.band]}</p>
          </Card>
        </div>

        {/* ------------------------------------------------ what they say */}
        <div className="space-y-3">
          <p className="flex items-center gap-2 font-display text-xs uppercase tracking-wider text-muted">
            <FontAwesomeIcon icon={faQuoteLeft} />
            What they say
          </p>

          <Card className="p-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
              {one.body}
            </p>
          </Card>

          {one.status === 'open' ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-muted">
                What they are told
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={7}
                maxLength={1000}
                placeholder="Why it stands, or why it does not. They are sent this word for word, so write it to them."
                className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
              />
              <span className="mt-1 block text-xs text-muted">
                {note.trim().length < 10
                  ? `At least ${10 - note.trim().length} more characters.`
                  : `${1000 - note.length} left.`}
              </span>
            </label>
          ) : (
            <Card className="space-y-2 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
                What they were told
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                {one.decision_note ?? '—'}
              </p>
              <p className="text-xs text-muted">
                Answered {one.decided_at ? timeAgo(one.decided_at) : ''}
                {one.decided_rank ? ` by a ${one.decided_rank}` : ''}.
              </p>
            </Card>
          )}
        </div>
      </div>
    </Drawer>
  )
}
