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
 * One screen: the name, the number, the line, and nothing under it but the
 * footer. Staw, on the first version of this page: "i just want something
 * simpler ... no blah blah, just the graphic and under it theres the
 * footer".
 *
 * So what Inner Stock *is* lives in one bubble on the info mark beside the
 * number rather than in three cards and a band. Somebody who wants the
 * number gets the number; somebody who wants to know what they are looking
 * at hovers once.
 *
 * Nothing here asks for money. There is no amount box, no card field and
 * no "invest" button, because none of that exists and a control implying
 * something the runtime does not do is worse than no control.
 *
 * The marks come from `inner_stock`, which Staw writes by hand in Supabase.
 * The page re-reads every minute.
 */
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

  return (
    <AboutShell>
      <Band tone="night">
        <Lane>
          {/*
            * The wordmark alone. Staw: do not put the logomark and the
            * wordmark next to each other - and he is right, they are two
            * drawings of the same name and setting them side by side makes
            * the page say it twice. SAS is small and quiet after it,
            * because it is the legal half of the name and not the half
            * anybody reads.
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

          <div className="mt-8 flex flex-wrap items-end gap-x-4 gap-y-3">
            <p
              className={cn(
                'font-display text-6xl font-extrabold leading-none tabular-nums tracking-tight sm:text-8xl',
                !now && 'text-white/25',
              )}
            >
              {now ? euros(now.cents) : '—'}
            </p>

            {change !== null && (
              <span
                className={cn(
                  'mb-1.5 text-xl font-extrabold tabular-nums sm:text-2xl',
                  change > 0 && 'text-space-bright',
                  change < 0 && 'text-danger-bright',
                  change === 0 && 'text-white/50',
                )}
              >
                {percent(change)}
              </span>
            )}
          </div>

          {/*
            * The same worth, in Brix. 100 Brix is a euro, so the Brix
            * figure is the cents figure - which is why there is no rate
            * constant here to drift out of step with the one the rest of
            * the platform uses. Said rather than converted by the reader,
            * because for most of the people on this page Brix is the unit
            * they actually have a feel for.
            */}
          {now && (
            <p className="mt-3 flex items-center gap-2 text-lg font-extrabold tabular-nums text-white/70">
              <Icon name="brix" className="h-5 w-5 text-amber-300" />
              {now.cents.toLocaleString('fr-FR')}
              <span className="text-sm font-bold text-muted">Brix</span>
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 text-sm text-muted">
            <span>One Inner Stock · 100 Brix = 1 €</span>
            {/*
              * Everything the page used to say in three cards and a band,
              * in one bubble: where the money comes from, and what an
              * investor here is. It is a `button` rather than a span so a
              * keyboard reaches it and a phone can tap it.
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
            * The spans, drawn only where the marks can answer them. A "1Y"
            * tab over a table whose oldest row is from Tuesday draws the
            * same line as every other tab and says this has been running
            * for a year.
            */}
          {spans.length > 1 && (
            <div className="mt-7 flex flex-wrap gap-1">
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

          <div className="mt-5">
            {marks === null && (
              <div className="h-64 animate-pulse rounded-xl bg-ink-raised/60 sm:h-80" />
            )}
            {marks !== null && shown.length >= 2 && <StockChart marks={shown} />}
            {marks !== null && shown.length < 2 && (
              /*
               * One mark is not a line, and a flat one across an empty box
               * would be a chart of a history that has not happened.
               */
              <div className="grid h-64 place-items-center rounded-xl border border-ink-line bg-ink-raised/30 px-6 text-center sm:h-80">
                <p className="text-sm text-muted">
                  {shown.length ? 'One mark so far.' : 'No marks yet.'}
                  {' '}The line starts the day there are two.
                </p>
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-muted">
            {failed
              ? 'The last read did not come back. The number above is the last one that did.'
              : read
                ? `Updated ${read.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, and again every minute.`
                : 'Reading…'}
          </p>
        </Lane>
      </Band>
    </AboutShell>
  )
}
