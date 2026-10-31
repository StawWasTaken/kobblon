import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Inner Stock: what one is worth, and nothing else.
 *
 * `inner_stock` is a table of marks - a moment and a price in euro cents -
 * written by hand in Supabase and readable by anybody. There are no
 * holders in it, no balances and no payouts, which is deliberate rather
 * than unfinished: see `0318`.
 *
 * Everything here reads. Nothing in the website can write a mark, and if
 * one day something should, it will not be a function in a bundle the
 * public can read.
 */

export type Mark = {
  /** The moment, ISO. */
  at: string
  /** What one was worth then, in euro cents. */
  cents: number
  /** Staw's own line about that mark, where he wrote one. */
  note: string | null
}

/** How many marks a page will draw. A year of daily marks fits inside it. */
const MOST = 500

export async function loadMarks(): Promise<Mark[]> {
  /*
   * Newest first out of the database, because that is the half of the
   * table anybody wants and the index is in that order - then turned
   * round, because a chart is drawn oldest to newest. Asking for them
   * ascending with a limit would hand back the oldest 500 and drop
   * whatever happened this week, which is the one row the page is for.
   */
  const { data, error } = await supabase
    .from('inner_stock')
    .select('at, cents, note')
    .order('at', { ascending: false })
    .limit(MOST)

  if (error) throw error
  return ((data as Mark[] | null) ?? []).slice().reverse()
}

/**
 * The marks, re-read every minute.
 *
 * Staw asked for the page to update every minute. A poll rather than a
 * realtime subscription on purpose: the row arrives when he types it into
 * Supabase, which is a few times a week at most, and a socket held open on
 * every visitor's browser to hear about that is a cost with nothing on the
 * other end of it. A minute late on a number that moves weekly is not
 * late.
 *
 * It also re-reads the moment the tab is looked at again, so somebody
 * coming back to a page left open overnight does not read yesterday's
 * number while they wait for the next minute.
 */
export function useMarks() {
  const [marks, setMarks] = useState<Mark[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [read, setRead] = useState<Date | null>(null)

  useEffect(() => {
    let live = true

    const ask = () => {
      loadMarks()
        .then((rows) => {
          if (!live) return
          setMarks(rows)
          setFailed(false)
          setRead(new Date())
        })
        .catch(() => {
          if (!live) return
          /*
           * The marks already on screen stay on screen. A network hiccup
           * is not news about the price, and blanking the number because
           * one request failed says something untrue about Kobblon.
           */
          setFailed(true)
        })
    }

    ask()
    const every = window.setInterval(ask, 60_000)
    const woken = () => { if (document.visibilityState === 'visible') ask() }
    document.addEventListener('visibilitychange', woken)

    return () => {
      live = false
      window.clearInterval(every)
      document.removeEventListener('visibilitychange', woken)
    }
  }, [])

  return { marks, failed, read }
}

/* ----------------------------------------------------------------- saying it */

/*
 * French formatting, because Kobblon SAS is French and the number is in
 * euro: a comma for the decimal, a space before the sign. `fr-FR` does all
 * of that, including the non-breaking space, which is why this is not a
 * `toFixed` and a string concatenation.
 */
const money = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
})

export const euros = (cents: number) => money.format(cents / 100)

/** The change between two marks, as a signed percentage. Null if there is no earlier one. */
export function movement(now: number, before: number | undefined): number | null {
  if (before === undefined || before === 0) return null
  return ((now - before) / before) * 100
}

/** A change in money, signed, for the figure beside a percentage. */
export const change = (cents: number) =>
  `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${money.format(Math.abs(cents) / 100)}`

export const percent = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Math.abs(n))} %`

/* ------------------------------------------------------------------- ranges */

export type Range = { key: string; label: string; days: number | null }

/**
 * The spans down the top of the chart.
 *
 * `days: null` is everything there is. They are offered only where the
 * marks can answer them - a "1Y" tab on a table whose oldest row is from
 * Tuesday draws the same line as "1M" and tells somebody this has been
 * running for a year, which it has not.
 */
export const RANGES: Range[] = [
  { key: 'w', label: '1W', days: 7 },
  { key: 'm', label: '1M', days: 30 },
  { key: 'q', label: '3M', days: 90 },
  { key: 'y', label: '1Y', days: 365 },
  { key: 'all', label: 'Max', days: null },
]

/** The spans this many marks can honestly answer, always including Max. */
export function rangesFor(marks: Mark[]): Range[] {
  if (marks.length < 2) return []
  const oldest = new Date(marks[0].at).getTime()
  const span = (Date.now() - oldest) / 86_400_000
  return RANGES.filter((one) => one.days === null || one.days < span)
}

export function marksIn(marks: Mark[], range: Range): Mark[] {
  if (range.days === null) return marks
  const from = Date.now() - range.days * 86_400_000
  const inside = marks.filter((one) => new Date(one.at).getTime() >= from)
  /*
   * One point is not a line. Where a span holds a single mark, the mark
   * before it is pulled in so the chart has something to draw from -
   * otherwise "1W" on a quiet week is a dot in the middle of an empty box.
   */
  if (inside.length >= 2) return inside
  return marks.slice(Math.max(0, marks.length - 2))
}
