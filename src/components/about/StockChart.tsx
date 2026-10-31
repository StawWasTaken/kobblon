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
 * Green up, red down. It is a reading rather than a control, which is the
 * line `docs/neoclassic.md` draws - red belongs to deleting and warning
 * everywhere it is something to press, and here nothing is pressable and
 * red is what down means to anybody who has seen a price before.
 */

const W = 1000
const H = 320
/** Room for the prices down the right, and a little air top and bottom. */
const PAD = { top: 18, right: 86, bottom: 26, left: 12 }

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
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
    const under = points.length
      ? `${line} L${points[points.length - 1].x.toFixed(2)} ${H - PAD.bottom} L${points[0].x.toFixed(2)} ${H - PAD.bottom} Z`
      : ''

    return { points, line, under, low, high, flat, y }
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
    <div className={cn('relative', className)}>
      <svg
        ref={box}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-56 w-full touch-none sm:h-72"
        onPointerMove={follow}
        onPointerLeave={() => setAt(null)}
        role="img"
        aria-label={`Inner Stock, ${marks.length} marks, now ${euros(last)}`}
      >
        <defs>
          <linearGradient id="inner-stock-under" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Three rules, at the low, the middle and the high, with the price said. */}
        {[plot.high, (plot.high + plot.low) / 2, plot.low].map((cents, i) => {
          const y = plot.flat && i !== 1 ? null : plot.y(cents)
          if (y === null) return null
          return (
            <g key={i}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke="rgba(255,255,255,0.08)" strokeWidth="1"
              />
              <text
                x={W - PAD.right + 10} y={y + 4}
                /*
                 * `vector-effect` is no use on text, and the SVG is
                 * stretched horizontally, so a label would be stretched
                 * with it. Drawn at a compensating scale: the box is 1000
                 * wide and lands on roughly a third of that, which is why
                 * the glyphs are set small and narrow rather than at a
                 * size that looks right in these coordinates.
                 */
                fill="rgba(255,255,255,0.45)"
                fontSize="15"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {euros(cents)}
              </text>
            </g>
          )
        })}

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

        {/* The newest mark, always marked, because it is the number on the page. */}
        {!!plot.points.length && (
          <circle
            cx={plot.points[plot.points.length - 1].x}
            cy={plot.points[plot.points.length - 1].y}
            r="4"
            fill={stroke}
          />
        )}

        {held && (
          <g>
            <line
              x1={held.x} x2={held.x} y1={PAD.top} y2={H - PAD.bottom}
              stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={held.x} cy={held.y} r="5" fill={stroke} stroke="#0c0c10" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/*
        * The read-out sits in HTML over the SVG rather than inside it, so
        * it is set in the page's own face at the page's own size - text
        * inside a stretched `viewBox` is text that is wider on a desktop
        * than on a phone.
        */}
      {held && (
        <div
          className="pointer-events-none absolute top-1 rounded-lg border border-ink-line bg-ink/95 px-2.5 py-1.5 text-xs shadow-pop"
          style={{
            left: `${(held.x / W) * 100}%`,
            transform: `translateX(${held.x > W * 0.7 ? '-105%' : '5%'})`,
          }}
        >
          <p className="font-extrabold tabular-nums text-white">{euros(held.mark.cents)}</p>
          <p className="text-[11px] text-muted">
            {new Date(held.mark.at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
          {held.mark.note && <p className="mt-0.5 max-w-44 text-[11px] text-white/60">{held.mark.note}</p>}
        </div>
      )}
    </div>
  )
}
