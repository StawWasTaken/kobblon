/*
 * Somebody's behaviour bar, as staff see it.
 *
 * Staw: "the account standing, the staff panels, and the moderation system
 * are all linked together and function as an ecosystem." This is the join.
 * The bar an account reads on its own status page is the same number a
 * moderator reads here, from the same function, and the clear a superadmin
 * does here is the one that account sees the moment it reloads.
 *
 * Two things only a staff reader gets: the history of somebody who is not
 * them, and the clear. Both are decided in the database - `behaviour_of` and
 * `moderation_history_of` check `is_moderator`, `clear_behaviour` checks
 * `require_superadmin` - so what this component draws only decides which
 * buttons are worth showing. It is never the check.
 */
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faWandMagicSparkles, faGavel, faClock, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import {
  BehaviourBar, ByBadge, bandTone, bandWord, heldFor, historyIcon, historyWord, stamp,
} from '@/components/social/standing'
import { useAsync } from '@/hooks/useAsync'
import { behaviourOf, clearBehaviour, moderationHistoryOf } from '@/lib/api'
import type { StaffRank } from '@/lib/api'
import { cn } from '@/lib/cn'

export function BehaviourPanel({ personId, username, rank }: {
  personId: string
  username: string
  rank: StaffRank
}) {
  const say = useToast()
  const bar = useAsync(async () => behaviourOf(personId), [personId])
  const history = useAsync(async () => moderationHistoryOf(personId), [personId])

  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const clear = async () => {
    setBusy(true)
    try {
      const after = await clearBehaviour(personId, note)
      say(`Cleared. @${username} is back to ${after}.`, 'success')
      setAsking(false)
      setNote('')
      bar.reload()
      history.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const me = bar.data

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 font-display text-xs uppercase tracking-wider text-muted">
          <FontAwesomeIcon icon={faGavel} />
          Behaviour and what has been decided
        </p>
        {rank === 'superadmin' && (
          <Button
            size="sm"
            variant="subtle"
            icon={faWandMagicSparkles}
            className="ml-auto"
            disabled={!me || me.score >= 100}
            onClick={() => setAsking(true)}
          >
            Clear the record
          </Button>
        )}
      </div>

      {bar.loading && <Skeleton className="h-20" />}

      {!!me && (
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <p className={cn('font-display text-lg font-extrabold', bandTone[me.band])}>
              {bandWord[me.band]}
            </p>
            <p className={cn('font-display text-2xl font-extrabold tabular-nums', bandTone[me.band])}>
              {me.score}<span className="text-sm text-muted">/100</span>
            </p>
          </div>

          <BehaviourBar score={me.score} band={me.band} />

          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <FontAwesomeIcon icon={faClock} />
            Their next chat suspension would last{' '}
            <span className="font-bold text-white">{me.timeout_minutes} minutes</span>,
            which is the band deciding it.
            {me.cleared_at && (
              <Badge tone="space">Cleared {stamp(me.cleared_at)}</Badge>
            )}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------- the history */}
      {history.loading ? <Skeleton className="h-24" /> : !history.data?.length ? (
        <p className="text-sm text-muted">Nothing has ever been decided about this account.</p>
      ) : (
        <ul className="space-y-1.5">
          {history.data.slice(0, 20).map((one) => (
            <li
              key={one.key}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm"
            >
              <FontAwesomeIcon
                icon={historyIcon[one.action] ?? faGavel}
                className={cn(
                  'shrink-0 text-xs',
                  one.is_void ? 'text-space-bright' : one.counts ? 'text-amber-300' : 'text-white/35',
                )}
              />
              <span className={cn('font-bold', one.is_void && 'text-white/60 line-through')}>
                {historyWord[one.action] ?? one.action}
              </span>
              <ByBadge rank={one.by_rank} />
              <span className="text-xs text-muted">{stamp(one.at)}</span>
              {heldFor(one) && <span className="text-xs text-muted">{heldFor(one)}</span>}
              {one.appeal_status && (
                <Badge tone={one.appeal_status === 'upheld' ? 'space' : 'neutral'}>
                  Appeal {one.appeal_status}
                </Badge>
              )}
              <span className="ml-auto shrink-0 text-xs font-bold tabular-nums text-muted">
                {one.counts && one.weight >= 1 ? `−${Math.round(one.weight)}` : '—'}
              </span>
              <span className="w-full truncate text-xs text-white/60">{one.reason}</span>
            </li>
          ))}
        </ul>
      )}

      {/* -------------------------------------------------------- the clear */}
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title={`Clear @${username}'s record?`}
        description="Everything on record stops counting against them and their bar goes back to a hundred. The decisions stay readable on their status page — this is mercy, not a rewrite of what happened."
      >
        <div className="space-y-3">
          <p className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm leading-relaxed text-white/80">
            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 text-amber-300" />
            It also forgives their place on the chat suspension ladder, so their next one starts
            at five minutes again. They are told, by letter, and it goes in the staff record.
          </p>

          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-muted">
              What they should be told (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={400}
              placeholder="Why you are clearing it."
              className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
            />
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
            <Button onClick={clear} loading={busy} icon={faWandMagicSparkles}>
              Clear it
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  )
}
