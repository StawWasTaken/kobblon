import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShieldHalved, faComments, faArrowRight, faRobot, faClock,
  faCircleCheck, faGavel, faArrowUpRightFromSquare, faWandMagicSparkles,
  faMicrophoneSlash,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Note } from '@/components/ui/Note'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import {
  BehaviourBar, ByBadge, Evidence, RuleCard, bandLine, bandTone, bandWord, byWord,
  blockWord, channelsLine, day, gravityWord, heldFor, historyIcon, historyWord,
  inDays, kobbyLine, levelWord, ruleWord, rowTitle, stamp, stillOn,
} from '@/components/social/standing'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  fileAppeal, fileAppealForTimeout, getBehaviour, getStanding, iDidNotSayThat,
  moderationHistory,
} from '@/lib/api'
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

/**
 * The one line that says what the bar bought, and when it climbs back.
 *
 * Two boxes, which is one too many: the only thing anybody wants off this
 * part of the page is how long a suspension would be today and when the
 * number moves.
 */
export function Bought({ minutes, next }: { minutes: number; next?: string | null }) {
  const said = minutes < 60
    ? `${minutes} minutes`
    : minutes < 1440
      ? `${Math.round(minutes / 60)} hours`
      : `${Math.round(minutes / 1440)} day`

  return (
    <Note icon={faClock}>
      A chat suspension today would last <span className="font-bold text-white">{said}</span>
      {next && <>, and the bar climbs again <span className="font-bold text-white">{next}</span></>}.
    </Note>
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

/*
 * Redrawn to match the suspension card the Launcher shows.
 *
 * Staw asked for them to be the same thing, and they should have been from
 * the start: a person who has just been quieted in a World sees one of
 * these, taps through to their standing, and sees the other about the same
 * sanction. Two layouts for one event reads as two systems.
 *
 * So this takes the suspension card's shape - the icon in a disc, the one
 * line that says what happened, a hairline, then the facts - rather than
 * the stack of bordered rows it was. What it keeps that the small card
 * cannot carry: the rule in full, the appeal and its answer, and the bar.
 */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

/** The disc at the top: the action's own icon, tinted by how it ended. */
function Crest({ one }: { one: ModerationRow }) {
  const tone = one.is_void
    ? 'border-space/40 bg-space/10 text-space-bright'
    : stillOn(one)
      ? 'border-danger/40 bg-danger/10 text-danger'
      : 'border-ink-line bg-ink-raised text-white/70'

  return (
    <span className={cn(
      'mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border',
      tone,
    )}>
      <FontAwesomeIcon icon={historyIcon[one.action] ?? faShieldHalved} className="text-xl" />
    </span>
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
    setSending(true)
    try {
      if (one.timeout_id) await fileAppealForTimeout(one.timeout_id, words.trim())
      else if (one.violation_id) await fileAppeal(one.violation_id, words.trim())
      else return
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

  /*
   * The one tap, for a sanction that came out of a transcript. Speech to
   * text is a guess and a worse one for a child or an accent, so the
   * person whose words were misheard should not have to write an essay
   * about it. The database writes the appeal; this only asks for it.
   */
  const spoken = one.target_type === 'voice'
  const [tapping, setTapping] = useState(false)

  const didNotSay = async () => {
    if (!one.timeout_id) return
    setTapping(true)
    try {
      await iDidNotSayThat(one.timeout_id)
      toast('Sent. A person will read what was heard against the rule.', 'success')
      onAppealed()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not send.', 'error')
    } finally {
      setTapping(false)
    }
  }

  const over = !!one.until && new Date(one.until) < new Date()
  const live = stillOn(one)

  return (
    <Dialog open onClose={onClose} title={rowTitle(one)} size="lg">
      <div className="space-y-5">
        {/* ------------------------------------------------- the head */}
        <div className="text-center">
          <Crest one={one} />

          <p className="mt-3 font-display text-xl font-extrabold leading-tight">
            {/* The row's own channels, not the action's name: a timeout
                stored as `chat_timeout` that took voice as well is called
                "Chat suspended" by the word list, and the person whose
                microphone is dead has been told something untrue. */}
            {one.action === 'chat_timeout' && one.channels.includes('voice')
              ? 'Chat and voice suspended'
              : historyWord[one.action] ?? one.action}
          </p>

          <p className="mt-1 text-sm text-muted">
            {stamp(one.at)}
            {heldFor(one) && <> · {heldFor(one)}</>}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
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
            {spoken && (
              <span className="rounded-full border border-ink-line bg-ink-raised px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                Heard in voice
              </span>
            )}
          </div>
        </div>

        <hr className="border-ink-line" />

        {/* --------------------------------------------- what and why */}
        <p className="whitespace-pre-wrap text-center text-sm leading-relaxed text-white/75">
          {one.reason}
        </p>

        {one.evidence && <Evidence said={one.evidence} />}

        {spoken && (
          <Note icon={faMicrophoneSlash}>
            This was transcribed from voice chat. A transcript is a guess, and we would
            rather hear about it than be right by default.
          </Note>
        )}

        <RuleCard
          ord={one.rule_ord}
          title={one.rule_title}
          body={one.rule_body}
          gravity={one.gravity}
        />

        {one.by_rank === 'kobby' && (
          <Note icon={faRobot}>{kobbyLine}</Note>
        )}

        {/* ------------------------------------------------- the facts */}
        <Card className="grid gap-4 p-4 sm:grid-cols-2">
          <Fact label="Who decided it">
            <span className="font-bold">{byWord[one.by_rank]}</span>
          </Fact>

          {heldFor(one) && (
            <Fact label="For how long">
              <span className="font-bold">{heldFor(one)}</span>
              {one.until && (
                <span className="text-white/60">
                  {over ? `, ended ${day(one.until)}` : `, until ${day(one.until)}`}
                </span>
              )}
            </Fact>
          )}

          <Fact label="What it was about">
            <span className="font-bold">
              {one.rule_ord ? `Rule ${one.rule_ord}, ` : ''}
              {one.rule_title ?? ruleWord[one.rule] ?? one.rule}
            </span>
            {!!one.gravity && (
              <span className="text-white/60">
                {' '}· {(gravityWord[one.gravity] ?? '').toLowerCase()}.
              </span>
            )}
          </Fact>

          {(one.kind === 'chat' || !!one.channels.length || !!one.blocks.length) && (
            <Fact label="What it switched off">
              <span className="font-bold">
                {one.blocks.length
                  ? one.blocks.map((b) => blockWord[b] ?? b).join(', ')
                  : channelsLine(one.channels)}
              </span>
            </Fact>
          )}

          <Fact label="On your behaviour bar">
            {one.counts && one.weight >= 1 ? (
              <span className="font-bold">
                {Math.round(one.weight)} points, fading as it ages.
              </span>
            ) : (
              <span className="font-bold text-space-bright">
                Nothing. Faded, taken back, or cleared.
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

        {/* ------------------------------------------------- the appeal */}
        {one.appeal_status && (
          <Card className="space-y-3 p-4">
            <p className="flex items-center gap-2 font-display text-base font-extrabold">
              <FontAwesomeIcon
                icon={one.appeal_status === 'upheld' ? faCircleCheck : faGavel}
                className={cn(
                  'text-sm',
                  one.appeal_status === 'upheld' ? 'text-space-bright'
                    : one.appeal_status === 'worsened' ? 'text-danger'
                      : one.appeal_status === 'declined' ? 'text-muted' : 'text-brand-bright',
                )}
              />
              {one.appeal_status === 'upheld' ? 'Your appeal was upheld'
                : one.appeal_status === 'worsened' ? 'We looked again, and it went the other way'
                  : one.appeal_status === 'declined' ? 'Your appeal was declined'
                    : 'Your appeal is being looked at'}
              {one.appeals_used > 1 && (
                <span className="text-sm font-bold text-muted">· second go</span>
              )}
            </p>
            <p className="text-sm leading-relaxed text-muted">
              {one.appeal_status === 'open'
                ? 'It is with somebody who was not part of the decision. You will be told either way, here and in your inbox.'
                : `Answered ${one.appeal_decided_at ? stamp(one.appeal_decided_at) : ''}.`}
            </p>
            {one.appeal_body && (
              <div>
                <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  What you sent
                </p>
                <p className="whitespace-pre-wrap rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-sm leading-relaxed text-white/75">
                  {one.appeal_body}
                </p>
              </div>
            )}
            {one.appeal_note && (
              <div>
                <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  What we said
                </p>
                <p className="whitespace-pre-wrap rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-sm leading-relaxed text-white/75">
                  {one.appeal_note}
                </p>
              </div>
            )}
          </Card>
        )}

        {writing && (
          <Card className="space-y-3 p-4">
            <p className="font-display text-base font-extrabold">
              {one.appeals_used ? 'Your second and last appeal' : 'Send an appeal'}
            </p>
            <Note icon={faGavel}>
              We look at what you were sanctioned for again, so it can be lifted, softened,
              or - if what we find is worse than what was acted on - made heavier.
            </Note>
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
          </Card>
        )}

        {one.appealable && !writing && (
          <p className="text-center text-sm text-muted">
            {one.appeals_used ? 'You have one more go at this' : 'You can appeal this'}
            {one.appeal_closes_at && <> until <span className="font-bold text-white">{day(one.appeal_closes_at)}</span></>}.
            {spoken && one.timeout_id && (
              <>
                {' '}Or{' '}
                <button
                  type="button"
                  onClick={() => void didNotSay()}
                  disabled={tapping}
                  className="font-bold text-link underline underline-offset-2 hover:text-brand-bright disabled:opacity-60"
                >
                  tell us you did not say that
                </button>
                {' '}and we will write it for you.
              </>
            )}
          </p>
        )}

        {/* ------------------------------------------------- the footer */}
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-line pt-4">
          {one.violation_id && (
            <Link
              to={`/standing/${one.violation_id}`}
              className="flex items-center gap-2 text-sm font-bold text-link hover:underline"
            >
              Open this on its own page
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-xs" />
            </Link>
          )}
          <div className="ml-auto flex items-center gap-3">
            {one.appealable && !writing && (
              <Button variant="subtle" onClick={() => setWriting(true)}>Appeal this</Button>
            )}
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
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
        lead="Where your behaviour stands, and everything ever decided about this account."
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

          <Bought
            minutes={me.timeout_minutes}
            next={me.score < 100 && !me.permanent && me.next_at ? inDays(me.next_at) : null}
          />

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

      <Note
        icon={faComments}
        side={
          <Link
            to="/support"
            className="flex items-center gap-2 text-sm font-bold text-link hover:underline"
          >
            Open a ticket
            <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
          </Link>
        }
      >
        Appeals go on the decision itself, in its card above.
      </Note>

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
