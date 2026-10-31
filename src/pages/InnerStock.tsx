import { useMemo, useState } from 'react'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band, Lane } from '@/components/about/Band'
import { Title, Lead, Eyebrow } from '@/components/about/Type'
import { StockChart } from '@/components/about/StockChart'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/brand/Icon'
import { asset } from '@/lib/asset'
import { useAtTitle, useSocialCard } from '@/hooks/useTitle'
import {
  euros, movement, percent, marksIn, rangesFor, useMarks, RANGES,
} from '@/lib/innerstock'
import { cn } from '@/lib/cn'

/**
 * Inner Stock.
 *
 * Staw: Kobblon is not a publicly traded company, so there are no
 * investors and no shares - but Kobblon SAS runs something called Inner
 * Stock, which people can put money into, which "is like donating kind
 * of, so they shouldnt expect to get something out of it", and which can
 * pay Brix income to a holder who also has a Kobblon account, depending on
 * how the Inner Stock is doing.
 *
 * Two things follow from that and they are both load-bearing:
 *
 * **The page says what it is not, as loudly as what it is.** A page with a
 * price and a line going up on it looks exactly like a share, and somebody
 * who skims it will believe it is one unless the page says otherwise in
 * the same breath as the number. So the disclaimer is not a footnote at
 * the bottom in grey - it is the band directly under the chart, in the
 * page's own voice, before anything that asks for anything.
 *
 * **Nothing on this page asks for money.** There is no amount box, no
 * card field and no "invest" button, because none of that exists and a
 * control that implies something the runtime does not do is worse than no
 * control. The way in is Contact, which is where Staw already handles
 * business enquiries, and the button says so.
 *
 * The number comes from `inner_stock`, which Staw writes by hand in
 * Supabase. The page re-reads it every minute.
 */
export default function InnerStock() {
  useAtTitle('Inner Stock')
  useSocialCard({
    title: 'Kobblon Inner Stock',
    description: 'What one Inner Stock in Kobblon SAS is worth, and what it is not.',
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
   * A percentage with no span attached is the one number on a page like
   * this that can be read four different ways, so the label underneath
   * always names what it is since.
   */
  const since = shown.length > 1 ? shown[0] : null
  const change = now && since ? movement(now.cents, since.cents) : null

  return (
    <AboutShell>
      <Band tone="raised" tight>
        <Lane>
          {/*
            * The lockup.
            *
            * `Wordmark` draws the name *or* the mark and never both - the
            * mark is what the name becomes when nine letters will not fit.
            * Staw asked for both together here, by name, so this page sets
            * them side by side by hand rather than teaching the shared
            * component a second habit that would then turn up in the bar.
            */}
          <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src={asset('/brand/logomark-darkmode.png')}
              alt=""
              aria-hidden="true"
              className="h-10 w-auto shrink-0 sm:h-14"
            />
            <h1 className="flex items-baseline gap-2.5 sm:gap-3.5">
              <img
                src={asset('/brand/wordmark2.png')}
                alt="Kobblon"
                className="h-7 w-auto sm:h-10"
              />
              <span className="font-display text-2xl font-extrabold tracking-[0.08em] text-white/80 sm:text-4xl">
                SAS
              </span>
            </h1>
          </div>

          <div className="mt-7 flex flex-wrap items-end gap-x-5 gap-y-3">
            <p
              className={cn(
                'font-display text-5xl font-extrabold tabular-nums tracking-tight sm:text-7xl',
                !now && 'text-white/25',
              )}
            >
              {now ? euros(now.cents) : '—'}
            </p>

            {change !== null && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-sm font-extrabold tabular-nums',
                  change > 0 && 'bg-space/20 text-space-bright',
                  change < 0 && 'bg-danger/20 text-danger-bright',
                  change === 0 && 'bg-white/10 text-white/70',
                )}
              >
                {percent(change)}
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-muted">
            One Inner Stock
            {since && ` · since ${new Date(since.at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}`}
          </p>
          </div>

          {/*
            * The facts beside the number.
            *
            * Half of what somebody wants off a page like this is not the
            * price: it is who is behind it, how often it moves and who
            * decides. Four lines rather than a paragraph, because they
            * are four separate questions and nobody reads a paragraph to
            * find out which country a company is in.
            */}
          <dl className="w-full max-w-xs shrink-0 divide-y divide-ink-line rounded-2xl border border-ink-line bg-ink-raised/50 text-sm sm:w-auto">
            {[
              ['Company', 'Kobblon SAS, France'],
              ['Marks', marks === null ? '—' : `${marks.length}`],
              [
                'Last written',
                now
                  ? new Date(now.at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })
                  : '—',
              ],
              ['Set by', 'Kobblon, by hand'],
            ].map(([head, body]) => (
              <div key={head} className="flex items-baseline justify-between gap-6 px-4 py-2.5">
                <dt className="text-muted">{head}</dt>
                <dd className="text-right font-bold text-white">{body}</dd>
              </div>
            ))}
            {now?.note && (
              <p className="px-4 py-2.5 text-[13px] italic text-white/55">“{now.note}”</p>
            )}
          </dl>
          </div>

          {/*
            * The spans, drawn only where the marks can answer them. A
            * "1Y" tab over a table whose oldest row is from Tuesday draws
            * the same line as every other tab and tells somebody this has
            * been running for a year.
            */}
          {spans.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-1 border-b border-ink-line">
              {spans.map((one) => (
                <button
                  key={one.key}
                  type="button"
                  onClick={() => setSpan(one.key)}
                  className={cn(
                    '-mb-px border-b-2 px-3.5 py-2 text-sm font-extrabold transition-colors',
                    one.key === range.key
                      ? 'border-brand text-brand-bright'
                      : 'border-transparent text-muted hover:text-white',
                  )}
                >
                  {one.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5">
            {marks === null && (
              <div className="h-56 animate-pulse rounded-xl bg-ink-raised/60 sm:h-72" />
            )}
            {marks !== null && shown.length >= 2 && <StockChart marks={shown} />}
            {marks !== null && shown.length < 2 && (
              /*
               * One mark is not a line, and drawing a flat one across an
               * empty box would be a chart of a history that has not
               * happened. It says what it has instead.
               */
              <div className="grid h-56 place-items-center rounded-xl border border-ink-line bg-ink-raised/40 px-6 text-center sm:h-72">
                <div>
                  <Icon name="brix" className="mx-auto h-8 w-8 opacity-40" />
                  <p className="mt-3 text-sm font-bold text-white/70">
                    {shown.length ? 'One mark so far.' : 'No marks yet.'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    The line starts the day there are two.
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-muted">
            {failed
              ? 'The last read did not come back. The number above is the last one that did.'
              : read
                ? `Read at ${read.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, and again every minute.`
                : 'Reading…'}
          </p>
        </Lane>
      </Band>

      {/*
        * Directly under the chart, not at the foot of the page. Somebody
        * who reads the number and leaves has still read this.
        */}
      <Band>
        <Lane>
          <Eyebrow>What this is</Eyebrow>
          <Title>Inner Stock is not a share</Title>
          <Lead>
            Kobblon SAS is not a publicly traded company. Inner Stock is not a security,
            it is not listed anywhere, it cannot be sold on, and holding one gives you no
            part of the company and no vote in it.
          </Lead>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                head: 'It is closer to a donation',
                body:
                  'Putting money into Inner Stock is backing Kobblon while it is being built. '
                  + 'Nobody should expect to get it back, and nothing on this page is a promise that they will.',
              },
              {
                head: 'Brix, where there are Brix',
                body:
                  'A holder who also has a Kobblon account can receive Brix income depending on how the '
                  + 'Inner Stock is doing. Brix are spent inside Kobblon; they are not money and do not come back out.',
              },
              {
                head: 'The number is what we say it is worth',
                body:
                  'There is no market here. The value above is set by Kobblon SAS and written by hand, '
                  + 'which is why every change is dated and most weeks it does not move.',
              },
            ].map((card) => (
              <div key={card.head} className="rounded-2xl border border-ink-line bg-ink-raised/50 p-5">
                <h3 className="font-display text-lg font-extrabold">{card.head}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{card.body}</p>
              </div>
            ))}
          </div>
        </Lane>
      </Band>

      <Band tone="brand">
        <Lane>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <Title>Interested in Inner Stock?</Title>
              <Lead>
                It is handled person to person, not through a form with a card field in it.
                Write to us as a business enquiry and you will get a real answer about what
                it involves.
              </Lead>
            </div>
            {/*
              * Contact, because that is where this actually happens. No
              * amount box and no "invest" button: neither exists, and a
              * control that implies one does is worse than no control.
              */}
            <Button to="/contact" size="lg" variant="yes">
              Talk to Kobblon
            </Button>
          </div>
        </Lane>
      </Band>
    </AboutShell>
  )
}
