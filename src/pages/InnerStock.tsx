import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowDown, faArrowUp, faCircleInfo, faHandHoldingDollar, faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons'
import { Icon } from '@/components/brand/Icon'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band, Lane } from '@/components/about/Band'
import { BandHead } from '@/components/about/Type'
import { StockChart } from '@/components/about/StockChart'
import { Tooltip } from '@/components/ui/Tooltip'
import { Confirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { useMaybeAuth } from '@/hooks/useAuth'
import { asset } from '@/lib/asset'
import { useAtTitle, useSocialCard } from '@/hooks/useTitle'
import {
  euros, change, movement, percent, marksIn, rangesFor, useMarks, RANGES,
  brix, leaveInnerStock, monthName, myInnerStock, standingWords, stockMonths,
} from '@/lib/innerstock'
import { cn } from '@/lib/cn'

/**
 * Inner Stock.
 *
 * Staw asked for this to be simple: the graphic, and the footer under it.
 * Then, looking at it: stats and infos down the side, "nerd stats". Both
 * hold at once, and the way they hold together is the split below - the
 * left column is the one thing somebody came for, and the right column is
 * everything that is true about it, set small enough that nobody reading
 * the number has to go past it.
 *
 * Nothing here asks for money. There is no amount box, no card field and
 * no "invest" button, because none of that exists and a control implying
 * something the runtime does not do is worse than no control.
 *
 * Every figure in the rail is derived from the marks on screen. There is
 * no second source and no number typed in by hand, which is the only way
 * a panel like this does not quietly go stale: a stat that cannot be
 * computed is not drawn.
 *
 * The marks come from `inner_stock`, which Staw writes by hand in
 * Supabase. The page re-reads every minute.
 */

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function InnerStock() {
  useAtTitle('Inner Stock')
  useSocialCard({
    title: 'Kobblon Inner Stock',
    description: 'What one Inner Stock in Kobblon SAS is worth.',
    image: null,
  })

  const { marks, failed, read } = useMarks()
  const [span, setSpan] = useState('all')

  /*
   * Your own share, where you have one. Asked of the database rather than
   * worked out from the profile in hand: a share is what `0319` says it is,
   * and a page that decides "you look like a moderator, so 50%" would be a
   * second answer to a question the database already answers - which this
   * project has been bitten by twice.
   */
  /*
   * `useMaybeAuth`, not `useAuth`: the bare page under `tools/site/` mounts
   * this with nothing around it, and a page that throws there cannot be
   * looked at - which is the third time that exact throw has cost this
   * project an afternoon. No provider means nobody told us, so the panel
   * is simply not drawn.
   */
  const session = useMaybeAuth()?.session ?? null
  const mine = useAsync(async () => (session ? myInnerStock() : null), [session?.user?.id])
  const paid = useAsync(async () => stockMonths(12), [])

  const spans = useMemo(() => (marks ? rangesFor(marks) : []), [marks])
  const range = spans.find((one) => one.key === span) ?? RANGES[RANGES.length - 1]
  const shown = useMemo(() => (marks ? marksIn(marks, range) : []), [marks, range])

  const now = marks?.length ? marks[marks.length - 1] : null

  /*
   * Today's move, which is what the big percentage beside the price is.
   *
   * It used to be the move across whatever span was on screen, and that
   * is a percentage that changes when somebody presses 1W - fine in the
   * chart, wrong next to the price, where it reads as "the number" and
   * has no span written on it. Staw asked for the figure every price
   * anywhere else gives: today.
   *
   * Today is measured from the last mark written *before* midnight, not
   * from the mark before this one: two marks written this afternoon are
   * one day's move between them, not two. And when nothing has been
   * written today that baseline is the newest mark itself, so the move
   * is zero - which is the truth, and is said as "No change today"
   * rather than drawn as a flat arrow.
   */
  /*
   * What the span on screen did, end to end. It belongs to the chart and
   * is drawn on the chart's own header, beside the buttons that change
   * it: Staw pressed 1W and then 1M and the only number on the page
   * stayed put, which reads as broken even though that number was never
   * about the chart. Now pressing a span moves a figure that sits on it.
   */
  const over = shown.length > 1 ? movement(shown[shown.length - 1].cents, shown[0].cents) : null

  const today = useMemo(() => {
    if (!marks?.length) return null
    const latest = marks[marks.length - 1]
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    let before: typeof latest | null = null
    for (let i = marks.length - 1; i >= 0; i -= 1) {
      if (new Date(marks[i].at).getTime() < midnight.getTime()) { before = marks[i]; break }
    }
    // Every mark there is was written today: nothing to measure against.
    if (!before) return null
    return { cents: latest.cents - before.cents, pc: movement(latest.cents, before.cents) }
  }, [marks])

  /*
   * The rail. Computed over every mark rather than the span on screen,
   * because "highest ever" that changes when somebody presses 1W is not
   * the highest ever.
   */
  const stats = useMemo(() => {
    if (!marks?.length) return null
    const values = marks.map((one) => one.cents)
    const high = Math.max(...values)
    const low = Math.min(...values)
    return {
      first: marks[0],
      high: marks.find((one) => one.cents === high)!,
      low: marks.find((one) => one.cents === low)!,
      sinceStart: movement(values[values.length - 1], values[0]),
    }
  }, [marks])

  return (
    <AboutShell>
      <Band tone="night">
        <Lane>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
            <div>
              {/*
                * The wordmark alone. Staw: do not put the logomark and the
                * wordmark next to each other - they are two drawings of the
                * same name, and side by side they make the page say it
                * twice. SAS after it, small and quiet, because it is the
                * legal half of the name and not the half anybody reads.
                */}
              <h1 className="flex items-center gap-2.5">
                <img
                  src={asset('/brand/wordmark2.png')}
                  alt="Kobblon"
                  className="h-6 w-auto sm:h-7"
                />
                <span className="text-sm font-bold uppercase tracking-[0.22em] text-white/40">
                  SAS
                </span>
              </h1>

              <div className="mt-7 flex flex-wrap items-end gap-x-4 gap-y-2">
                <p
                  className={cn(
                    'font-display text-6xl font-extrabold leading-none tabular-nums tracking-tight sm:text-7xl',
                    !now && 'text-white/25',
                  )}
                >
                  {now ? euros(now.cents) : '—'}
                </p>

                {today && today.pc !== null && (
                  /*
                    * The pill and the money beside it, which is the pair
                    * every price anywhere else shows: how far it moved as
                    * a share, and how far it moved in euros. Both are
                    * today's, and both say so.
                    */
                  <span className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-extrabold tabular-nums',
                        today.cents > 0 && 'bg-space-bright/15 text-space-bright',
                        today.cents < 0 && 'bg-danger-bright/15 text-danger-bright',
                        today.cents === 0 && 'bg-white/[0.06] text-white/50',
                      )}
                    >
                      {today.cents !== 0 && (
                        <FontAwesomeIcon
                          icon={today.cents > 0 ? faArrowUp : faArrowDown}
                          className="h-3 w-3"
                        />
                      )}
                      {percent(today.pc)}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-bold tabular-nums',
                        today.cents > 0 && 'text-space-bright',
                        today.cents < 0 && 'text-danger-bright',
                        today.cents === 0 && 'text-muted',
                      )}
                    >
                      {today.cents === 0 ? 'No change today' : `${change(today.cents)} today`}
                    </span>
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
                {/*
                  * The same worth in Brix. 100 Brix is a euro, so the Brix
                  * figure is the cents figure - which is why there is no
                  * rate constant here to drift out of step with the one the
                  * rest of the platform uses.
                  */}
                {now && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 font-bold tabular-nums text-white">
                    <Icon name="brix" className="h-4 w-4 text-amber-300" />
                    {now.cents.toLocaleString('fr-FR')}
                    <span className="font-semibold text-muted">Brix</span>
                  </span>
                )}
                <span>One Inner Stock</span>
                {/*
                  * What the page used to say in three cards and a band, in
                  * one bubble. A `button` rather than a span, so a keyboard
                  * reaches it and a phone can tap it.
                  */}
                <Tooltip
                  side="bottom"
                  label={
                    <span className="block text-left">
                      Inner Stock is funded by Kobblon investors: people who put money
                      into Kobblon SAS while it is being built. It is not a share - it
                      cannot be sold on and carries no vote. An investor with a Kobblon
                      account can receive Brix income depending on how the Inner Stock
                      is doing.
                    </span>
                  }
                >
                  <button
                    type="button"
                    aria-label="What Inner Stock is"
                    className="rounded-full text-white/35 transition-colors hover:text-white focus-visible:text-white"
                  >
                    <FontAwesomeIcon icon={faCircleInfo} className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>

              {/*
                * The chart in its own frame, with the spans on the frame's
                * own header rather than floating above it. Before this the
                * line sat loose on the page and the tabs belonged to
                * nothing; a frame is what says these two are one thing.
                */}
              <div className="mt-7 overflow-hidden rounded-2xl border border-ink-line bg-ink-raised/40">
                {spans.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1 border-b border-ink-line px-3 py-2.5">
                    {spans.map((one) => (
                      <button
                        key={one.key}
                        type="button"
                        onClick={() => setSpan(one.key)}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-sm font-extrabold transition-colors',
                          one.key === range.key
                            ? 'bg-white/10 text-white'
                            : 'text-muted hover:bg-white/5 hover:text-white',
                        )}
                      >
                        {one.label}
                      </button>
                    ))}

                    {/* What that span did, end to end, in the span's own words. */}
                    {over !== null && (
                      <span className="ml-auto flex items-baseline gap-2 pl-2 pr-1 text-sm">
                        <span className="text-muted">{range.label}</span>
                        <span
                          className={cn(
                            'font-extrabold tabular-nums',
                            over > 0 && 'text-space-bright',
                            over < 0 && 'text-danger-bright',
                            over === 0 && 'text-white/50',
                          )}
                        >
                          {percent(over)}
                        </span>
                      </span>
                    )}
                  </div>
                )}

                <div className="p-3 sm:p-4">
                  {marks === null && (
                    <div className="h-64 animate-pulse rounded-xl bg-ink-raised/60 sm:h-72" />
                  )}
                  {marks !== null && shown.length >= 2 && <StockChart marks={shown} />}
                  {marks !== null && shown.length < 2 && (
                    /*
                     * One mark is not a line, and a flat one across an empty
                     * box would be a chart of a history that has not
                     * happened.
                     */
                    <div className="grid h-64 place-items-center px-6 text-center sm:h-72">
                      <p className="text-sm text-muted">
                        {shown.length ? 'One mark so far.' : 'No marks yet.'}
                        {' '}The line starts the day there are two.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-3 text-xs text-muted">
                {failed
                  ? 'The last read did not come back. The number above is the last one that did.'
                  : read
                    ? `Updated ${read.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, and again every minute.`
                    : 'Reading…'}
              </p>
            </div>

            {/*
              * The rail. Two panels: what the company is, which never
              * changes, and what the marks say, which changes every time
              * Staw writes one. They are separate because a reader treats
              * a panel as one kind of fact, and "Île-de-France" sitting in
              * a list of prices reads as a price.
              */}
            <aside className="space-y-4 lg:pt-1">
              {mine.data && now && (
                <YourShare
                  mine={mine.data}
                  price={now.cents}
                  onLeft={() => mine.reload()}
                />
              )}

              <Facts
                head="Kobblon SAS"
                rows={[
                  ['Legal form', 'SAS'],
                  ['Headquarters', 'Île-de-France, France'],
                  ['Traded', 'Not publicly'],
                  ['Currency', 'EUR'],
                ]}
              />

              {stats && now && (
                <Facts
                  head="The marks"
                  rows={[
                    ['One Inner Stock', euros(now.cents)],
                    ['In Brix', `${now.cents.toLocaleString('fr-FR')} Brix`],
                    ['Marks written', `${marks?.length ?? 0}`],
                    ['First mark', `${euros(stats.first.cents)} · ${day(stats.first.at)}`],
                    ['Highest', `${euros(stats.high.cents)} · ${day(stats.high.at)}`],
                    ['Lowest', `${euros(stats.low.cents)} · ${day(stats.low.at)}`],
                    [
                      'Since the first',
                      stats.sinceStart === null ? '—' : percent(stats.sinceStart),
                    ],
                    [
                      'Today',
                      today && today.pc !== null
                        ? `${change(today.cents)} · ${percent(today.pc)}`
                        : '—',
                    ],
                    ['Last updated', day(now.at)],
                  ]}
                />
              )}

              <p className="px-1 text-xs leading-relaxed text-white/35">
                Inner Stock is a non-registered, unlisted asset. All investments are
                made at your sole discretion and carried out entirely at your own risk.
              </p>
            </aside>
          </div>
        </Lane>
      </Band>

      {/*
        * Who the Inner Stock pays, and on what. Said in public rather than
        * kept in the staff console: a share that is a salary is a rule, and
        * a rule nobody outside can read is the kind of thing a platform gets
        * asked about once and cannot answer twice the same way.
        */}
      <Band tone="raised" edge>
        <Lane>
          <BandHead
            eyebrow="Every month"
            title="What the Inner Stock pays"
            lead={
              <>
                Kobblon staff are paid from the Inner Stock - it is their
                salary - and so is anybody with an investor's deal. Once a
                month, each account receives its share of what one Inner
                Stock is worth. Nothing stacks: one account is paid at its
                highest standing and that one only.
              </>
            }
          />

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {LADDER.map((rung) => (
              <div
                key={rung.who}
                className={cn(
                  'rounded-2xl border p-4',
                  rung.full
                    ? 'border-brand/30 bg-brand/[0.07]'
                    : 'border-ink-line bg-ink-raised/40',
                )}
              >
                <p className="font-display text-3xl font-extrabold leading-none tabular-nums text-white">
                  {rung.share}
                  <span className="text-lg text-white/40">%</span>
                </p>
                <p className="mt-2 text-sm font-bold text-white">{rung.who}</p>
                <p className="mt-1 text-xs leading-snug text-muted">{rung.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-ink-line bg-ink-raised/40 p-5">
              <h3 className="font-display text-lg font-extrabold text-white">
                A month that rises, or holds
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Each account receives its share of the closing price, in Brix.
                100 Brix is a euro, so at{' '}
                <span className="font-bold text-white">{now ? euros(now.cents) : '10,00 €'}</span>{' '}
                a full share is{' '}
                <span className="font-bold text-white">
                  {(now?.cents ?? 1000).toLocaleString('fr-FR')} Brix
                </span>
                , and a 50% share is half of that.
              </p>
            </div>
            <div className="rounded-2xl border border-danger/25 bg-danger/[0.06] p-5">
              <h3 className="font-display text-lg font-extrabold text-white">
                A month that falls
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Nobody is paid: if the Inner Stock was not profitable, neither
                is the month. Investors carry it further - Kobblon repays the
                deficit, so an investor's share of the fall is taken off their
                Brix and goes to the Kobblon account. A staff salary is never
                taken back; it simply is not paid.
              </p>
            </div>
          </div>

          {!!paid.data?.length && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-ink-line bg-ink-raised/40">
              <h3 className="border-b border-ink-line px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/40">
                The months paid so far
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="px-4 pb-2 pt-3 font-bold">Month</th>
                      <th className="px-4 pb-2 pt-3 font-bold">Opened</th>
                      <th className="px-4 pb-2 pt-3 font-bold">Closed</th>
                      <th className="px-4 pb-2 pt-3 text-right font-bold">Accounts</th>
                      <th className="px-4 pb-2 pt-3 text-right font-bold">Paid out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paid.data.map((one) => (
                      <tr key={one.month} className="border-t border-ink-line">
                        <td className="px-4 py-2.5 font-bold text-white">{monthName(one.month)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-muted">{euros(one.opened)}</td>
                        <td className={cn(
                          'px-4 py-2.5 font-bold tabular-nums',
                          one.closed > one.opened && 'text-space-bright',
                          one.closed < one.opened && 'text-danger-bright',
                          one.closed === one.opened && 'text-white/70',
                        )}>
                          {euros(one.closed)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-white/80">
                          {one.paid_accounts}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                          {one.taken_brix > 0
                            ? <span className="text-danger-bright">−{one.taken_brix.toLocaleString('fr-FR')} Brix</span>
                            : <span className="text-space-bright">+{one.paid_brix.toLocaleString('fr-FR')} Brix</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Lane>
      </Band>
    </AboutShell>
  )
}

/** The ladder, said once, in the order anybody reads it. */
const LADDER: { who: string; share: number; note: string; full?: boolean }[] = [
  { who: 'Kobblon', share: 100, note: 'The house account, and Staw', full: true },
  { who: 'Investors', share: 100, note: 'A deal made with Kobblon SAS', full: true },
  { who: 'Superadmins', share: 90, note: 'The top staff rank' },
  { who: 'Admins', share: 70, note: 'Staff who set the rules' },
  { who: 'Moderators', share: 50, note: 'Staff who work the queues' },
]

/**
 * Your own share, in the rail.
 *
 * It is the first panel rather than the last because somebody who is paid
 * by this page opens it to see one thing. The button underneath is only
 * ever drawn for an investor: a staff share ends when the rank does, and
 * the database refuses it from here, so drawing it for a moderator would
 * be a control that does nothing.
 */
function YourShare({ mine, price, onLeft }: {
  mine: NonNullable<Awaited<ReturnType<typeof myInnerStock>>>
  price: number
  onLeft: () => void
}) {
  const toast = useToast()
  const [asking, setAsking] = useState(false)

  const next = Math.round((price * mine.share) / 100)

  return (
    <section className="overflow-hidden rounded-2xl border border-brand/30 bg-brand/[0.07]">
      <h2 className="flex items-center gap-2 border-b border-brand/20 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-bright">
        <FontAwesomeIcon icon={faHandHoldingDollar} className="h-3.5 w-3.5" />
        Your share
      </h2>

      <div className="px-4 py-3.5">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-4xl font-extrabold leading-none tabular-nums text-white">
            {mine.share}<span className="text-xl text-white/40">%</span>
          </span>
          <span className="text-sm font-bold text-white/70">
            as {standingWords[mine.standing]}
          </span>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          At today's price a full month pays you{' '}
          <span className="font-bold text-white">{next.toLocaleString('fr-FR')} Brix</span>,
          and a month the price falls pays nothing.
        </p>
      </div>

      <dl className="divide-y divide-white/[0.06] border-t border-brand/20">
        <Row label="Months paid" value={`${mine.months}`} />
        <Row label="Received" value={`${mine.earned.toLocaleString('fr-FR')} Brix`} />
        {mine.repaid > 0 && (
          <Row label="Repaid" value={`−${mine.repaid.toLocaleString('fr-FR')} Brix`} tone="bad" />
        )}
        {mine.last_month && mine.last_brix !== null && (
          <Row
            label={monthName(mine.last_month)}
            value={`${brix(mine.last_brix)} Brix`}
            tone={mine.last_brix < 0 ? 'bad' : 'good'}
          />
        )}
      </dl>

      {mine.can_leave && (
        <div className="border-t border-brand/20 px-4 py-3">
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="inline-flex items-center gap-2 text-xs font-bold text-white/45 transition-colors hover:text-danger-bright"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="h-3 w-3" />
            Stop being an investor
          </button>
        </div>
      )}

      <Confirm
        open={asking}
        onClose={() => setAsking(false)}
        title="Stop being an investor?"
        lead="Your Inner Stock share ends. You keep every Brix you have already been paid."
        points={[
          'You stop receiving a monthly share from the next month on.',
          'A month that falls can no longer take Brix off you.',
          'Only Kobblon can make you an investor again - this is not a switch you can turn back on.',
        ]}
        confirmText="Stop being an investor"
        onConfirm={async () => {
          try {
            await leaveInnerStock()
            toast('You are no longer an investor.')
            onLeft()
          } catch (err) {
            toast(err instanceof Error ? err.message : 'That did not go through.')
          }
        }}
      />
    </section>
  )
}

/** One line of the share panel. */
function Row({ label, value, tone }: {
  label: string
  value: string
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className={cn(
        'text-right text-[13px] font-bold tabular-nums',
        tone === 'good' && 'text-space-bright',
        tone === 'bad' && 'text-danger-bright',
        !tone && 'text-white/90',
      )}>
        {value}
      </dd>
    </div>
  )
}

/** One panel of the rail: a quiet heading and a list of facts under it. */
function Facts({ head, rows }: { head: string; rows: [string, string][] }) {
  return (
    <section className="rounded-2xl border border-ink-line bg-ink-raised/40">
      <h2 className="border-b border-ink-line px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/40">
        {head}
      </h2>
      <dl className="divide-y divide-white/[0.05]">
        {rows.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-4 px-4 py-2">
            <dt className="shrink-0 text-[13px] text-muted">{key}</dt>
            <dd className="text-right text-[13px] font-bold tabular-nums text-white/90">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
