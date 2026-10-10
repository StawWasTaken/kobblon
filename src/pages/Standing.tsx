import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShieldHalved, faComments, faArrowRight, faRobot, faClock,
  faCircleCheck, faGavel, faArrowUpRightFromSquare, faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import {
  BehaviourBar, ByBadge, bandLine, bandTone, bandWord, byWord, blockWord, day,
  heldFor, historyIcon, historyWord, inDays, kobbyLine, levelWord, ruleWord,
  rowTitle, stamp, stillOn,
} from '@/components/social/standing'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { fileAppeal, getBehaviour, getStanding, moderationHistory } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { ModerationRow } from '@/types/db'

/*
 * Account standing.
 *
 * Staw asked for three things on this page and they are in this order,
 * because it is the order somebody in trouble reads them in:
 *
 *   the bar      "how your behaviour was", and what it buys - a better bar
 *                means a gentler version of every rule, and the page says
 *                which rule and by how much rather than implying it.
 *   the climb    low on it, "it gets back up slowly in days or weeks
 *                sometimes months", so the page names the day, not "slowly".
 *   the history  "all the previous moderation action", each one a bar with
 *                the basics, opening into a popup card with everything:
 *                who decided it - Mod, Admin, Superadmin or Kobby - when,
 *                against what, for how long, why, and the appeal.
 *
 * Nothing here is worked out in the browser. The score, the band, the weight
 * each row still presses and the rank that decided it all come from the
 * server, because a number a page could compute is a number a page could
 * compute differently from the thing enforcing it.
 */

/** The one line that says what the bar bought, which is the point of it. */
export function Bought({ minutes }: { minutes: number }) {
  const said = minutes < 60
    ? `${minutes} minutes`
    : minutes < 1440
      ? `${Math.round(minutes / 60)} hours`
      : `${Math.round(minutes / 1440)} day`

  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-line bg-ink-raised px-4 py-3">
      <FontAwesomeIcon icon={faClock} className="mt-0.5 text-sm text-brand-bright" />
      <p className="min-w-0 text-sm leading-relaxed text-white/70">
        What this buys you right now: if your chat were suspended today it would last{' '}
        <span className="font-bold text-white">{said}</span>. A better bar makes that
        shorter, a worse one makes it longer.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------- one row */

export function HistoryRow({ one, onOpen }: { one: ModerationRow; onOpen: () => void }) {
  const live = stillOn(one)
  const press = Math.min(100, Math.round(one.weight))

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-ink-hover"
      >
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl border',
            one.is_void
              ? 'border-space/40 bg-space/10 text-space-bright'
              : live
                ? 'border-danger/40 bg-danger/10 text-danger'
                : 'border-ink-line bg-ink-raised text-white/50',
          )}
        >
          <FontAwesomeIcon icon={historyIcon[one.action] ?? faGavel} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={cn('font-bold', one.is_void && 'text-white/60 line-through')}>
              {historyWord[one.action] ?? one.action}
            </span>
            <ByBadge rank={one.by_rank} />
            {live && (
              <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-danger">
                Still on
              </span>
            )}
            {one.is_void && (
              <span className="rounded-full border border-space/40 bg-space/10 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-space-bright">
                Taken back
              </span>
            )}
            {one.appeal_status === 'open' && (
              <span className="rounded-full border border-brand-bright/50 bg-brand/20 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
                Appeal open
              </span>
            )}
          </span>

          <span className="mt-1 block truncate text-sm text-muted">
            {stamp(one.at)}{heldFor(one) && ` · ${heldFor(one)}`}
          </span>

          {/* What it still presses on the bar, which is why it is a bar. */}
          <span className="mt-2 flex items-center gap-2">
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-line">
              <span
                className={cn(
                  'block h-full rounded-full',
                  press === 0 ? 'bg-space' : press >= 40 ? 'bg-danger' : 'bg-amber-400',
                )}
                style={{ width: `${Math.max(press, press === 0 ? 0 : 4)}%` }}
              />
            </span>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted">
              {one.counts && press > 0 ? `−${press} on the bar` : 'counts for nothing'}
            </span>
          </span>
        </span>

        <FontAwesomeIcon icon={faArrowRight} className="shrink-0 text-xs text-muted" />
      </button>
    </li>
  )
}

/* --------------------------------------------------------- the popup card */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ink-line px-4 py-3 last:border-0">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 leading-relaxed">{children}</div>
    </div>
  )
}

export function RowCard({ one, onClose, onAppealed }: {
  one: ModerationRow
  onClose: () => void
  onAppealed: () => void
}) {
  const toast = useToast()
  const [writing, setWriting] = useState(false)
  const [words, setWords] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!one.violation_id) return
    setSending(true)
    try {
      await fileAppeal(one.violation_id, words.trim())
      toast('Sent. Somebody who was not part of the decision will look at it.', 'success')
      setWords('')
      setWriting(false)
      onAppealed()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not send.', 'error')
    } finally {
      setSending(false)
    }
  }

  const over = !!one.until && new Date(one.until) < new Date()

  return (
    <Dialog open onClose={onClose} title={rowTitle(one)} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ByBadge rank={one.by_rank} />
          <span className="text-sm text-muted">{stamp(one.at)}</span>
        </div>

        {one.by_rank === 'kobby' && (
          <p className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm leading-relaxed text-white/75">
            <FontAwesomeIcon icon={faRobot} className="mt-0.5 text-brand-bright" />
            {kobbyLine}
          </p>
        )}

        <Card className="p-0">
          <Fact label="Who decided it">
            <span className="font-bold">{byWord[one.by_rank]}</span>
          </Fact>

          <Fact label="What we did">
            <span className="font-bold">{historyWord[one.action] ?? one.action}</span>
          </Fact>

          {heldFor(one) && (
            <Fact label="For how long">
              <span className="font-bold">{heldFor(one)}</span>
              {one.until && (
                <span className="text-white/60">
                  {over ? `, which ended ${day(one.until)}` : `, until ${day(one.until)}`}
                </span>
              )}
            </Fact>
          )}

          {one.kind === 'decision' && (
            <Fact label="What it was about">
              <span className="font-bold">{ruleWord[one.rule] ?? one.rule}</span>
            </Fact>
          )}

          {!!one.blocks.length && (
            <Fact label="What it switched off">
              <span className="font-bold">
                {one.blocks.map((b) => blockWord[b] ?? b).join(', ')}
              </span>
            </Fact>
          )}

          <Fact label="Why">
            <p className="whitespace-pre-wrap text-white/75">{one.reason}</p>
          </Fact>

          <Fact label="On your behaviour bar">
            {one.counts && one.weight >= 1 ? (
              <span className="font-bold">
                It is costing you {Math.round(one.weight)} points, and fades as it ages.
              </span>
            ) : (
              <span className="font-bold text-space-bright">
                Nothing. It has either faded, been taken back, or been cleared.
              </span>
            )}
          </Fact>

          {one.is_void && (
            <Fact label="This was taken back">
              <p className="text-space-bright">
                {one.void_reason ?? 'An appeal was upheld, so this no longer counts against you.'}
              </p>
            </Fact>
          )}
        </Card>

        {/* ------------------------------------------------------- the appeal */}
        {one.appeal_status && (
          <Card className="space-y-3 p-4">
            <p className="flex items-center gap-2 font-display text-lg font-extrabold">
              <FontAwesomeIcon
                icon={one.appeal_status === 'upheld' ? faCircleCheck : faGavel}
                className={cn(
                  'text-sm',
                  one.appeal_status === 'upheld' ? 'text-space-bright'
                    : one.appeal_status === 'declined' ? 'text-muted' : 'text-brand-bright',
                )}
              />
              {one.appeal_status === 'upheld' ? 'Your appeal was upheld'
                : one.appeal_status === 'declined' ? 'Your appeal was declined'
                : 'Your appeal is being looked at'}
            </p>
            <p className="text-sm leading-relaxed text-muted">
              {one.appeal_status === 'open'
                ? 'It is with somebody who was not part of the decision. You will be told either way, here and in your inbox.'
                : `Answered ${one.appeal_decided_at ? stamp(one.appeal_decided_at) : ''}.`}
            </p>
            {one.appeal_body && (
              <div>
                <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-muted">
                  What you sent
                </p>
                <p className="whitespace-pre-wrap rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-sm leading-relaxed text-white/75">
                  {one.appeal_body}
                </p>
              </div>
            )}
            {one.appeal_note && (
              <div>
                <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-muted">
                  What we said
                </p>
                <p className="whitespace-pre-wrap rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-sm leading-relaxed text-white/75">
                  {one.appeal_note}
                </p>
              </div>
            )}
          </Card>
        )}

        {one.appealable && (
          <Card className="space-y-3 p-4">
            {writing ? (
              <>
                <p className="font-display text-lg font-extrabold">Send an appeal</p>
                <p className="text-sm leading-relaxed text-muted">
                  Say what you think was missed. You get one appeal for each decision, so put
                  everything in it. A person reads it, even where Kobby decided.
                </p>
                <textarea
                  value={words}
                  onChange={(e) => setWords(e.target.value)}
                  rows={6}
                  maxLength={2000}
                  placeholder="What happened, from your side."
                  aria-label="Your appeal"
                  className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <p className="min-w-0 flex-1 text-xs text-muted">
                    {words.trim().length < 20
                      ? `At least ${20 - words.trim().length} more characters.`
                      : `${2000 - words.length} left.`}
                  </p>
                  <Button variant="ghost" onClick={() => setWriting(false)}>Cancel</Button>
                  <Button onClick={send} loading={sending} disabled={words.trim().length < 20}>
                    Send appeal
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <FontAwesomeIcon icon={faGavel} className="text-brand-bright" />
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-white/65">
                  Think this is wrong? Appeal it once and somebody who was not part of it reads it.
                </p>
                <Button variant="subtle" onClick={() => setWriting(true)}>Appeal this</Button>
              </div>
            )}
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {one.violation_id && (
            <Link
              to={`/standing/${one.violation_id}`}
              className="flex items-center gap-2 text-sm font-bold text-link hover:underline"
            >
              Open this on its own page
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-xs" />
            </Link>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  )
}

/* ------------------------------------------------------------- the page */

export default function Standing() {
  useTitle('Account standing')
  const { profile } = useAuth()

  const bar = useAsync(async () => (profile ? getBehaviour() : null), [profile?.id])
  const standing = useAsync(async () => (profile ? getStanding() : null), [profile?.id])
  const history = useAsync(async () => (profile ? moderationHistory() : []), [profile?.id])

  const [open, setOpen] = useState<string | null>(null)
  const showing = history.data?.find((one) => one.key === open) ?? null

  const live = standing.data
  const level = live?.level ?? 'clear'
  const me = bar.data

  return (
    <Page width="narrow" className="space-y-6">
      <PageHeader
        kicker="Your account"
        icon={faShieldHalved}
        title="Account standing"
        lead="How your behaviour stands with Kobblon, what that buys you, and everything that has ever been decided about this account."
      />

      {/* ------------------------------------------------------- the bar */}
      {bar.loading && <Skeleton className="h-56 rounded-2xl" />}
      {bar.error && <ErrorState message={bar.error} onRetry={bar.reload} />}

      {!!me && (
        <Card className="space-y-5 p-6 sm:p-7">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
                Behaviour
              </p>
              <h2
                className={cn(
                  'mt-1 font-display text-2xl font-extrabold sm:text-3xl',
                  bandTone[me.band],
                )}
              >
                {bandWord[me.band]}
              </h2>
            </div>
            <p className={cn('shrink-0 font-display text-4xl font-extrabold tabular-nums sm:text-5xl', bandTone[me.band])}>
              {me.score}
              <span className="text-xl text-muted">/100</span>
            </p>
          </div>

          <BehaviourBar score={me.score} band={me.band} tall />

          <p className="leading-relaxed text-white/70">{bandLine[me.band]}</p>

          <Bought minutes={me.timeout_minutes} />

          {/* The climb, as days rather than "slowly". */}
          {me.score < 100 && !me.permanent && (
            <div className="flex items-start gap-3 rounded-xl border border-ink-line bg-ink-raised px-4 py-3">
              <FontAwesomeIcon icon={faClock} className="mt-0.5 text-sm text-space-bright" />
              <p className="min-w-0 text-sm leading-relaxed text-white/70">
                It climbs on its own.
                {me.next_at && <> It moves up again <span className="font-bold text-white">{inDays(me.next_at)}</span>.</>}
                {me.full_at && <> It is back to a hundred <span className="font-bold text-white">{inDays(me.full_at)}</span>.</>}
              </p>
            </div>
          )}

          {me.permanent && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-relaxed text-white/80">
              This account has been closed. That does not fade, and the bar does not climb back.
              The decision and the appeal are still readable below.
            </p>
          )}

          {me.score === 100 && !me.cleared_at && (
            <p className="flex items-center gap-2 text-sm font-semibold text-space-bright">
              <FontAwesomeIcon icon={faCircleCheck} className="text-xs" />
              Nothing is pressing on your bar. Keep it that way and this page stays boring.
            </p>
          )}

          {me.cleared_at && (
            <p className="flex items-start gap-3 rounded-xl border border-space/40 bg-space/10 px-4 py-3 text-sm leading-relaxed text-white/80">
              <FontAwesomeIcon icon={faWandMagicSparkles} className="mt-0.5 text-space-bright" />
              <span>
                A superadmin cleared your record on {day(me.cleared_at)}. Everything before then
                stops counting against you.
                {me.cleared_note && <> They wrote: “{me.cleared_note}”</>}
              </span>
            </p>
          )}
        </Card>
      )}

      {/* --------------------------------------------- what is switched off */}
      {!!live && (level !== 'clear' || !!live.blocks.length) && (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <span className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Account
          </span>
          <span className="font-bold">{levelWord[level]}</span>
          {!!live.blocks.length && (
            <span className="min-w-0 flex-1 text-sm leading-relaxed text-white/70">
              Switched off right now:{' '}
              <span className="font-bold text-white">
                {live.blocks.map((one) => blockWord[one] ?? one).join(', ')}
              </span>
              {live.until && ` until ${day(live.until)}`}.
            </span>
          )}
        </Card>
      )}

      {/* ------------------------------------------------------ the history */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-extrabold">Everything on record</h2>
          {!!history.data?.length && (
            <p className="text-sm text-muted">
              {history.data.length} in total · tap one for the whole story
            </p>
          )}
        </div>

        {history.loading && <Skeleton className="h-32 rounded-2xl" />}
        {history.error && <ErrorState message={history.error} onRetry={history.reload} />}

        {!history.loading && !history.data?.length && (
          <Card>
            <EmptyState
              mood="emptyBox"
              title="Nothing on record"
              body="No decision has ever been made about this account, and your chat has never been suspended."
              action={<Button variant="subtle" to="/policies/guidelines">Read the house rules</Button>}
            />
          </Card>
        )}

        {!!history.data?.length && (
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-ink-line">
              {history.data.map((one) => (
                <HistoryRow key={one.key} one={one} onOpen={() => setOpen(one.key)} />
              ))}
            </ul>
          </Card>
        )}
      </section>

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <FontAwesomeIcon icon={faComments} className="text-lg text-brand-bright" />
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-white/65">
          Appeals go on the decision itself, in its card above. If something here does not match
          what you think happened, write to us instead.
        </p>
        <Link
          to="/support"
          className="flex items-center gap-2 text-sm font-bold text-link hover:underline"
        >
          Open a ticket
          <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
        </Link>
      </Card>

      {showing && (
        <RowCard
          one={showing}
          onClose={() => setOpen(null)}
          onAppealed={() => { history.reload(); bar.reload() }}
        />
      )}
    </Page>
  )
}
