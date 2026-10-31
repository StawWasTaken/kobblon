import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { Icon } from '@/components/brand/Icon'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band, Lane } from '@/components/about/Band'
import { StockChart } from '@/components/about/StockChart'
import { Tooltip } from '@/components/ui/Tooltip'
import { asset } from '@/lib/asset'
import { useAtTitle, useSocialCard } from '@/hooks/useTitle'
import {
  euros, movement, percent, marksIn, rangesFor, useMarks, RANGES,
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

  const spans = useMemo(() => (marks ? rangesFor(marks) : []), [marks])
  const range = spans.find((one) => one.key === span) ?? RANGES[RANGES.length - 1]
  const shown = useMemo(() => (marks ? marksIn(marks, range) : []), [marks, range])

  const now = marks?.length ? marks[marks.length - 1] : null
  /*
   * Against the first mark of the span on screen, not against yesterday.
   * A percentage with no span attached is the one number here that can be
   * read four different ways.
   */
  const since = shown.length > 1 ? shown[0] : null
  const change = now && since ? movement(now.cents, since.cents) : null

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

                {change !== null && (
                  <span
                    className={cn(
                      'mb-1 text-xl font-extrabold tabular-nums',
                      change > 0 && 'text-space-bright',
                      change < 0 && 'text-danger-bright',
                      change === 0 && 'text-white/50',
                    )}
                  >
                    {percent(change)}
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
                  <div className="flex flex-wrap gap-1 border-b border-ink-line px-3 py-2.5">
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
                    ['Last updated', day(now.at)],
                  ]}
                />
              )}

              <p className="px-1 text-xs leading-relaxed text-white/35">
                Inner Stock is not a security and is not listed anywhere. The value is
                set by Kobblon SAS and written by hand, which is why most weeks it does
                not move.
              </p>
            </aside>
          </div>
        </Lane>
      </Band>
    </AboutShell>
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
