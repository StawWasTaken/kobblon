import { useMemo, useRef, useState } from 'react'
import type { Mark } from '@/lib/innerstock'
import { euros } from '@/lib/innerstock'
import { cn } from '@/lib/cn'

/**
 * The Inner Stock line.
 *
 * Drawn here rather than brought in. A charting library is two hundred
 * kilobytes and a theme to fight for one line on one page, and this is one
 * line on one page: a path, an area under it, a dot on the end and a
 * crosshair that follows the pointer.
 *
 * It is an SVG in a `viewBox` with `preserveAspectRatio` off, so the chart
 * is laid out in its own flat coordinates and the browser stretches it to
 * whatever the band is wide. That is why nothing here measures the
 * element: a chart that reads its own width needs a resize observer, a
 * first paint with no width and a re-render, and all of that is to arrive
 * at the thing a `viewBox` does for nothing.
 *
 * **Every word on the chart is HTML over the SVG, not text inside it.**
 * The box is stretched horizontally, and text inside a stretched `viewBox`
 * is stretched with it: the prices down the right were wider on a desktop
 * than on a phone and set in a face nothing else on the page uses. They
 * are placed by percentage off the same coordinates the line is drawn in,
 * so they sit exactly on their rule and stay the page's own type at the
 * page's own size.
 *
 * Green up, red down. It is a reading rather than a control, which is the
 * line `docs/neoclassic.md` draws - red belongs to deleting and warning
 * everywhere it is something to press, and here nothing is pressable and
 * red is what down means to anybody who has seen a price before.
 */

const W = 1000
const H = 320
/** The drawing area. The gutters outside it belong to the labels. */
const PAD = { top: 16, right: 12, bottom: 14, left: 12 }
/** Four rules, so the middle of the box is a line rather than a guess. */
const RULES = 4

const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/**
 * A monotone cubic through the points.
 *
 * Straight segments between hand-written marks read as a saw, and the
 * stretch makes each corner a different angle on every screen width. A
 * monotone curve is the one smoothing that cannot invent a high or a low
 * between two marks - it never overshoots a point - so the shape stays
 * true to what was written while the corners stop shouting.
 */
function curve(points: { x: number; y: number }[]) {
  if (points.length < 2) return ''
  const n = points.length
  const slope: number[] = []
  const delta: number[] = []

  for (let i = 0; i < n - 1; i += 1) {
    const dx = points[i + 1].x - points[i].x
    delta[i] = dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx
  }
  slope[0] = delta[0]
  slope[n - 1] = delta[n - 2]
  for (let i = 1; i < n - 1; i += 1) {
    if (delta[i - 1] * delta[i] <= 0) slope[i] = 0
    else slope[i] = (delta[i - 1] + delta[i]) / 2
  }
  // Fritsch-Carlson: pull a tangent back where it would overshoot its segment.
  for (let i = 0; i < n - 1; i += 1) {
    if (delta[i] === 0) { slope[i] = 0; slope[i + 1] = 0; continue }
    const a = slope[i] / delta[i]
    const b = slope[i + 1] / delta[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      slope[i] = t * a * delta[i]
      slope[i + 1] = t * b * delta[i]
    }
  }

  let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i += 1) {
    const dx = (points[i + 1].x - points[i].x) / 3
    d += ` C${(points[i].x + dx).toFixed(2)} ${(points[i].y + dx * slope[i]).toFixed(2)}`
      + ` ${(points[i + 1].x - dx).toFixed(2)} ${(points[i + 1].y - dx * slope[i + 1]).toFixed(2)}`
      + ` ${points[i + 1].x.toFixed(2)} ${points[i + 1].y.toFixed(2)}`
  }
  return d
}

export function StockChart({ marks, className }: { marks: Mark[]; className?: string }) {
  const box = useRef<SVGSVGElement>(null)
  const [at, setAt] = useState<number | null>(null)

  const plot = useMemo(() => {
    const values = marks.map((one) => one.cents)
    const low = Math.min(...values)
    const high = Math.max(...values)
    /*
     * A flat line is centred rather than squashed onto the floor of the
     * box. With one mark, or several at the same price, `high - low` is
     * zero and every point lands on the same y - put that in the middle
     * and it reads as "it has not moved", which is true. On the floor it
     * reads as "it is at the bottom", which is not.
     */
    const flat = high === low
    const span = flat ? 1 : high - low
    const floor = flat ? low - 0.5 : low
    const inner = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom }

    const x = (i: number) =>
      PAD.left + (marks.length < 2 ? inner.w : (i / (marks.length - 1)) * inner.w)
    const y = (cents: number) =>
      PAD.top + inner.h - ((cents - floor) / span) * inner.h

    const points = marks.map((one, i) => ({ x: x(i), y: y(one.cents), mark: one }))
    const line = curve(points)
    const under = points.length
      ? `${line} L${points[points.length - 1].x.toFixed(2)} ${H - PAD.bottom}`
        + ` L${points[0].x.toFixed(2)} ${H - PAD.bottom} Z`
      : ''

    /* The rules, evenly down the box, each with the price it stands at. */
    const rules = Array.from({ length: RULES + 1 }, (_, i) => {
      const part = i / RULES
      return {
        top: (PAD.top + part * inner.h) / H,
        cents: Math.round(floor + span * (1 - part)),
      }
    })

    /*
     * Three dates along the foot - the first mark, the middle one and the
     * newest. More than three on a phone is a row of overlapping months,
     * and the middle one is what says whether the left half or the right
     * half is the long one.
     */
    const dates = marks.length < 2
      ? []
      : [0, Math.floor((marks.length - 1) / 2), marks.length - 1]
        .filter((one, i, all) => all.indexOf(one) === i)
        .map((i) => ({ left: points[i].x / W, at: marks[i].at, i }))

    return { points, line, under, low, high, flat, rules, dates }
  }, [marks])

  const first = marks[0]?.cents ?? 0
  const last = marks[marks.length - 1]?.cents ?? 0
  const up = last > first
  const down = last < first
  const stroke = up ? '#2fb96b' : down ? '#e5484d' : '#3b5bfd'

  /*
   * Which mark the pointer is nearest, in the SVG's own coordinates. The
   * pointer arrives in screen pixels and the chart is stretched, so the
   * ratio has to be taken from the element's real width - this is the one
   * place the drawn size matters, and it is asked for at the moment of
   * use rather than held, which is the trap this project keeps finding.
   */
  const follow = (event: React.PointerEvent<SVGSVGElement>) => {
    const el = box.current
    if (!el || !plot.points.length) return
    const rect = el.getBoundingClientRect()
    const where = ((event.clientX - rect.left) / rect.width) * W
    let near = 0
    for (let i = 1; i < plot.points.length; i += 1) {
      if (Math.abs(plot.points[i].x - where) < Math.abs(plot.points[near].x - where)) near = i
    }
    setAt(near)
  }

  const held = at === null ? null : plot.points[at]

  return (
    /*
     * The gutters are the frame's padding rather than the SVG's: the
     * prices and the dates live in them as ordinary text, and the line
     * gets the whole of the box it is drawn in.
     */
    <div className={cn('relative pb-6 pr-[4.5rem]', className)}>
      <div className="relative">
        {/* The rules and their prices, under the line and behind nothing. */}
        {plot.rules.map((rule, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-x-0"
            style={{ top: `${rule.top * 100}%` }}
          >
            <span
              className={cn(
                'block h-px w-full',
                i === plot.rules.length - 1 ? 'bg-white/[0.12]' : 'bg-white/[0.055]',
              )}
            />
            {(!plot.flat || i === RULES / 2) && (
              <span className="absolute left-full top-0 -translate-y-1/2 pl-2.5 text-[11px] font-semibold tabular-nums leading-none text-white/35">
                {euros(rule.cents)}
              </span>
            )}
          </div>
        ))}

        <svg
          ref={box}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="relative h-64 w-full touch-none sm:h-80"
          onPointerMove={follow}
          onPointerLeave={() => setAt(null)}
          role="img"
          aria-label={`Inner Stock, ${marks.length} marks, now ${euros(last)}`}
        >
          <defs>
            <linearGradient id="inner-stock-under" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
              <stop offset="70%" stopColor={stroke} stopOpacity="0.03" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {plot.under && <path d={plot.under} fill="url(#inner-stock-under)" />}
          <path
            d={plot.line}
            fill="none"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {held && (
            <line
              x1={held.x} x2={held.x} y1={PAD.top} y2={H - PAD.bottom}
              stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/*
          * The two dots are HTML as well. A circle inside a stretched
          * viewBox is an ellipse, and it was a different ellipse at every
          * width; placed by percentage it is a round dot everywhere.
          */}
        {!!plot.points.length && (
          <Dot point={plot.points[plot.points.length - 1]} colour={stroke} pulse />
        )}
        {held && at !== plot.points.length - 1 && <Dot point={held} colour={stroke} />}

        {/*
          * The read-out sits beside the mark it is reading.
          *
          * It was parked in a corner for a while, to keep it off the line
          * and off the newest mark. Staw's note on that is the right one:
          * a number in the corner is a number about nothing - you have to
          * look at the dot, then away, then back. So it rides the dot
          * again, held a little to one side of it, and it is the *side*
          * that does the avoiding: it swaps to the left half once the
          * pointer passes the middle, which is the only place the newest
          * mark ever is, and it rides up or down so it is never hanging
          * off the top or the bottom of the box.
          */}
        {held && (
          <div
            /*
              * `whitespace-nowrap`, because an absolute box near the right
              * edge is only offered the room left between it and that
              * edge: without it the date broke over two lines exactly
              * when the pointer was over the newest mark.
              */
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-xl border-2 border-ink-line bg-ink/95 px-3 py-2 shadow-pop"
            style={{
              left: `${(held.x / W) * 100}%`,
              top: `${(held.y / H) * 100}%`,
              transform: `translate(${held.x > W * 0.55 ? 'calc(-100% - 14px)' : '14px'}, ${
                held.y < H * 0.3 ? '-10%' : held.y > H * 0.7 ? '-90%' : '-50%'
              })`,
            }}
          >
            <p className="font-display text-sm font-extrabold tabular-nums leading-none text-white">
              {euros(held.mark.cents)}
            </p>
            <p className="mt-1 text-[11px] leading-none text-muted">
              {new Date(held.mark.at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
            {held.mark.note && (
              <p className="mt-1.5 max-w-44 whitespace-normal text-[11px] leading-snug text-white/60">
                {held.mark.note}
              </p>
            )}
          </div>
        )}

        {/* The dates, in the foot gutter, each under its own mark. */}
        {plot.dates.map((one) => (
          <span
            key={one.i}
            className="pointer-events-none absolute top-full mt-2 whitespace-nowrap text-[11px] font-semibold leading-none text-white/30"
            style={{
              left: `${one.left * 100}%`,
              transform: one.i === 0
                ? 'translateX(0)'
                : one.i === marks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {dayOf(one.at)}
          </span>
        ))}
      </div>

    </div>
  )
}

/** A mark on the line, round at any width because it is not in the SVG. */
function Dot({ point, colour, pulse }: {
  point: { x: number; y: number }
  colour: string
  pulse?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-ink"
      style={{
        left: `${(point.x / W) * 100}%`,
        top: `${(point.y / H) * 100}%`,
        background: colour,
        boxShadow: pulse ? `0 0 0 5px ${colour}22` : undefined,
      }}
    />
  )
}
