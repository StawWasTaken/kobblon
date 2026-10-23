import { useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import {
  faShieldHalved, faComments, faArrowRight, faRobot, faClock,
  faCircleCheck, faGavel, faArrowUpRightFromSquare, faWandMagicSparkles,
  faMicrophoneSlash, faScaleBalanced, faUserShield, faChartLine,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Page } from '@/components/layout/AppShell'
import { Panel, Group, Line, PageTop } from '@/components/settings/Panel'
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
          <Glyph icon={historyIcon[one.action] ?? faGavel} />
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

        <Glyph icon={faArrowRight} className="shrink-0 text-xs text-muted" />
      </button>
    </li>
  )
}

/* --------------------------------------------------------- the popup card */

/**
 * Everything Kobblon did about one thing, in one card.
 *
 * Staw: "a proper redesign ... of the popup cards for each violation". What
 * it was: a centred crest, a centred verdict, a centred paragraph, then a
 * two-column grid of facts, then the rule, then the appeal. Centred text is
 * right for four words and wrong for forty, and a two-column grid of
 * label-over-value is a shape this product uses nowhere else - so the one
 * card a person reads when they are upset was also the one card that did not
 * look like anything else they had read that day.
 *
 * It is now the same three shapes as Settings, Account standing and Support:
 * a head, groups of rows, and an action bar that does not scroll away. The
 * facts are `Line`s, so "Who decided it / A moderator" is drawn by the same
 * code as "Username / @staw", and the appeal is a panel of its own rather
 * than a card wedged between two others.
 *
 * The verdict, the date and whether it is still on live in the head, which
 * is tinted by how it ended - red while it is on, blue once it has been
 * taken back. That is the first thing somebody wants and it is now the first
 * thing on the card, above the fold on a phone.
 */

/** One fact about the sanction, drawn the way a setting is. */
function Fact({ label, value, icon, danger }: {
  label: string
  value: React.ReactNode
  icon?: IconDefinition
  danger?: boolean
}) {
  return <Line label={label} value={value} icon={icon} danger={danger} />
}

/** The disc in the head: the action's own icon, tinted by how it ended. */
function Crest({ one }: { one: ModerationRow }) {
  const tone = one.is_void
    ? 'border-space/40 bg-space/15 text-space-bright'
    : stillOn(one)
      ? 'border-danger/40 bg-danger/15 text-danger'
      : 'border-ink-line bg-ink-raised text-white/70'

  return (
    <span className={cn(
      'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border',
      tone,
    )}>
      <Glyph icon={historyIcon[one.action] ?? faShieldHalved} className="text-xl" />
    </span>
  )
}

/** A word on the head, for a state worth saying before anything is read. */
function Flag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={cn(
      'rounded-full border px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide',
      tone,
    )}>
      {children}
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

  /* The row's own channels, not the action's name: a timeout stored as
     `chat_timeout` that took voice as well is called "Chat suspended" by the
     word list, and the person whose microphone is dead has been told
     something untrue. */
  const verdict = one.action === 'chat_timeout' && one.channels.includes('voice')
    ? 'Chat and voice suspended'
    : historyWord[one.action] ?? one.action

  const band = one.is_void
    ? 'from-space/20'
    : live
      ? 'from-danger/20'
      : 'from-white/[0.06]'

  return (
    <Dialog
      open
      onClose={onClose}
      title={rowTitle(one)}
      size="lg"
      head={
        <div className={cn('bg-gradient-to-br to-ink-card px-5 py-5', band)}>
          <div className="flex items-start gap-4 pr-10">
            <Crest one={one} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
                {stamp(one.at)}
                {heldFor(one) && <> · {heldFor(one)}</>}
              </p>
              <h2 className="mt-1 font-display text-xl font-extrabold leading-tight sm:text-2xl">
                {verdict}
              </h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <ByBadge rank={one.by_rank} />
                {live && (
                  <Flag tone="border-danger/40 bg-danger/10 text-danger">Still on</Flag>
                )}
                {one.is_void && (
                  <Flag tone="border-space/40 bg-space/10 text-space-bright">Taken back</Flag>
                )}
                {spoken && (
                  <Flag tone="border-ink-line bg-ink-raised text-muted">Heard in voice</Flag>
                )}
              </div>
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-3">
          {/*
            * A plain anchor, not <Link>. This card is mounted by the
            * Workspace's panels, which have no router, and a <Link> outside
            * one throws and takes the panel down - that has already happened
            * three times on this platform, and this was the fourth waiting
            * to be found.
            */}
          {one.violation_id ? (
            <a
              href={`/standing/${one.violation_id}`}
              className="flex min-w-0 items-center gap-2 text-sm font-bold text-link hover:underline"
            >
              <span className="truncate">Open on its own page</span>
              <Glyph icon={faArrowUpRightFromSquare} className="shrink-0 text-xs" />
            </a>
          ) : <span className="flex-1" />}

          <div className="ml-auto flex items-center gap-3">
            {one.appealable && !writing && (
              <Button variant="subtle" icon={faGavel} onClick={() => setWriting(true)}>
                Appeal this
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Why, in the words it was written in. Left-aligned: this runs to a
            paragraph on a bad day, and centred prose is a poster. */}
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/85">
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

        {one.by_rank === 'kobby' && <Note icon={faRobot}>{kobbyLine}</Note>}

        {/* ------------------------------------------------- the facts */}
        <div className="space-y-2.5">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
            The facts of it
          </h3>
          <Group>
            <Fact
              label="Who decided it"
              icon={one.by_rank === 'kobby' ? faRobot : faUserShield}
              value={byWord[one.by_rank]}
            />

            {heldFor(one) && (
              <Fact
                label="For how long"
                icon={faClock}
                value={
                  <>
                    {heldFor(one)}
                    {one.until && (over ? `, ended ${day(one.until)}` : `, until ${day(one.until)}`)}
                  </>
                }
              />
            )}

            <Fact
              label="What it was about"
              icon={faScaleBalanced}
              value={
                <>
                  {one.rule_ord ? `Rule ${one.rule_ord}, ` : ''}
                  {one.rule_title ?? ruleWord[one.rule] ?? one.rule}
                  {!!one.gravity && <> · {(gravityWord[one.gravity] ?? '').toLowerCase()}</>}
                </>
              }
            />

            {(one.kind === 'chat' || !!one.channels.length || !!one.blocks.length) && (
              <Fact
                label="What it switched off"
                icon={faComments}
                value={
                  one.blocks.length
                    ? one.blocks.map((b) => blockWord[b] ?? b).join(', ')
                    : channelsLine(one.channels)
                }
              />
            )}

            <Fact
              label="On your behaviour bar"
              icon={faChartLine}
              value={
                one.counts && one.weight >= 1
                  ? `${Math.round(one.weight)} points, fading as it ages`
                  : 'Nothing. Faded, taken back, or cleared.'
              }
            />

            {one.is_void && (
              <Line
                label="This was taken back"
                icon={faCircleCheck}
                note={one.void_reason
                  ?? 'An appeal was upheld, so this no longer counts against you.'}
              />
            )}
          </Group>
        </div>

        {/* ------------------------------------------------- the appeal */}
        {one.appeal_status && (
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
              Your appeal
            </h3>
            <Card className="space-y-3 p-4">
              <p className="flex flex-wrap items-center gap-2 font-display text-base font-extrabold">
                <Glyph
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
          </div>
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
          <p className="text-sm leading-relaxed text-muted">
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
    /*
     * The site's own column, centred, with nothing capped inside it.
     *
     * It was held to 48rem for a day to sit at the width a settings panel
     * is read at - but a settings panel is narrow because a rail is beside
     * it, and these two have no rail, so the cap was a column pinned to the
     * left of a page with a third of it empty. Staw: "arent center-centered,
     * and too small in my opinion". Right on both counts: without a rail,
     * the page is the column.
     */
    <Page className="space-y-8">
      <PageTop
        title="Account standing"
        note="Where your behaviour stands, and everything ever decided about this account."
      />

      {/* ------------------------------------------------------- the bar */}
      {bar.loading && <Skeleton className="h-56 rounded-2xl" />}
      {bar.error && <ErrorState message={bar.error} onRetry={bar.reload} />}

      {!!me && (
        <Panel
          title="Behaviour"
          note="A better bar is a gentler version of every rule, and it climbs back on its own."
        >
          {/*
           * The one thing on this page that is not a row of settings, and
           * it keeps its own card: a score, its band and the bar itself are
           * a single picture, and cutting them into labelled rows would be
           * coherence doing damage. Everything that follows it is a row.
           */}
          <Card className="space-y-5 p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <h3 className={cn('font-display text-2xl font-extrabold sm:text-3xl', bandTone[me.band])}>
                {bandWord[me.band]}
              </h3>
              <p className={cn('shrink-0 font-display text-3xl font-extrabold tabular-nums sm:text-4xl', bandTone[me.band])}>
                {me.score}
                <span className="text-lg text-muted">/100</span>
              </p>
            </div>

            <BehaviourBar score={me.score} band={me.band} tall />

            <p className="text-sm leading-relaxed text-white/70">{bandLine[me.band]}</p>
          </Card>

          <Group>
            <Line
              label="A chat suspension today"
              note={
                me.score < 100 && !me.permanent && me.next_at
                  ? `The bar climbs again ${inDays(me.next_at)}.`
                  : undefined
              }
              icon={faClock}
              value={
                me.timeout_minutes < 60
                  ? `${me.timeout_minutes} minutes`
                  : me.timeout_minutes < 1440
                    ? `${Math.round(me.timeout_minutes / 60)} hours`
                    : `${Math.round(me.timeout_minutes / 1440)} day`
              }
            />

            {!!live && (level !== 'clear' || !!live.blocks.length) && (
              <Line
                label="This account"
                note={
                  live.blocks.length
                    ? `Switched off right now: ${live.blocks.map((one) => blockWord[one] ?? one).join(', ')}${live.until ? ` until ${day(live.until)}` : ''}.`
                    : undefined
                }
                icon={faGavel}
                value={levelWord[level]}
                danger
              />
            )}

            {me.permanent && (
              <Line
                label="This account has been closed"
                note="That does not fade, and the bar does not climb back. The decision and the appeal are still readable below."
                icon={faGavel}
                danger
              />
            )}

            {me.score === 100 && !me.cleared_at && !me.permanent && (
              <Line
                label="Nothing is pressing on your bar"
                note="Keep it that way and this page stays boring."
                icon={faCircleCheck}
              />
            )}

            {me.cleared_at && (
              <Line
                label={`A superadmin cleared your record on ${day(me.cleared_at)}`}
                note={
                  <>
                    Everything before then stops counting against you.
                    {me.cleared_note && <> They wrote: &ldquo;{me.cleared_note}&rdquo;</>}
                  </>
                }
                icon={faWandMagicSparkles}
              />
            )}
          </Group>
        </Panel>
      )}

      {/* ------------------------------------------------------ the history */}
      <Panel
        title="Everything on record"
        note={
          history.data?.length
            ? `${history.data.length} in total. Open one for the whole story.`
            : undefined
        }
      >
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
          <Group>
            <ul className="divide-y divide-ink-line">
              {history.data.map((one) => (
                <HistoryRow key={one.key} one={one} onOpen={() => setOpen(one.key)} />
              ))}
            </ul>
          </Group>
        )}
      </Panel>

      {/* The way out of this page, in the shape the other two use for it. */}
      <Group>
        <Line
          label="Write to us"
          note="Appeals go on the decision itself, in its card above. Anything else is a ticket."
          icon={faComments}
          to="/support"
        />
      </Group>

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
