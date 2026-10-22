import { useId, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * Two small charts, drawn by hand in SVG.
 *
 * No chart library. Everything the console needs is a line over time and a
 * run of bars, and a library for that is 50kB on every page that imports
 * the panel plus a second set of colours to keep in step with
 * `design/preset.js`. These take their colours from the design tokens like
 * everything else does.
 *
 * They are deliberately plain about what they cannot do: no zoom, no
 * legend that filters, no export. A console chart is for seeing a shape and
 * noticing when it changes.
 */

export type Series = {
  label: string
  values: number[]
  /** A Tailwind text colour; the line, the fill and the dot all take it. */
  tone: string
  /**
   * What the readout says when nothing is hovered. A flow (what moved that
   * day) adds up to something worth knowing; a level (what was held) does
   * not - adding thirty daily totals of the same money gives a number that
   * means nothing at all.
   */
  summary?: 'sum' | 'last'
}

const nice = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}

/**
 * A line per series over the same days.
 *
 * The y axis always includes zero, because a currency chart that starts at
 * its own minimum makes a flat month look like a cliff.
 */
export function LineGraph({ series, labels, height = 180, className }: {
  series: Series[]
  /** One per point; only the first, middle and last are drawn. */
  labels: string[]
  height?: number
  className?: string
}) {
  const id = useId()
  const [at, setAt] = useState<number | null>(null)

  const points = Math.max(...series.map((one) => one.values.length), 0)
  const top = useMemo(
    () => Math.max(1, ...series.flatMap((one) => one.values.map((v) => Math.abs(v)))),
    [series],
  )

  if (!points) return null

  const x = (i: number) => (points === 1 ? 50 : (i / (points - 1)) * 100)
  const y = (v: number) => 100 - (v / top) * 100

  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full overflow-visible"
        onMouseLeave={() => setAt(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const share = (e.clientX - box.left) / box.width
          setAt(Math.max(0, Math.min(points - 1, Math.round(share * (points - 1)))))
        }}
      >
        {/* Four lines to read heights against, and nothing else behind the data. */}
        {[0, 25, 50, 75, 100].map((line) => (
          <line
            key={line}
            x1="0" x2="100" y1={line} y2={line}
            className="stroke-ink-line"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {series.map((one, index) => {
          const path = one.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
          return (
            <g key={one.label} className={one.tone}>
              <defs>
                <linearGradient id={`${id}-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`${path} L100,100 L0,100 Z`}
                fill={`url(#${id}-${index})`}
                stroke="none"
              />
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}

        {at !== null && (
          <line
            x1={x(at)} x2={x(at)} y1="0" y2="100"
            className="stroke-white/20"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/*
        * The dots on the hovered day are HTML, not SVG.
        *
        * The chart is drawn in a 100x100 box stretched to whatever width it
        * has, which is what lets a path be written in percentages - and it
        * stretches a circle into an ellipse along with everything else. A
        * span placed at the same percentages is round at any width.
        */}
      {at !== null && (
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height }}>
          {series.map((one) => (
            one.values[at] === undefined ? null : (
              <span
                key={one.label}
                className={cn('absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-ink-card', one.tone)}
                style={{ left: `${x(at)}%`, top: `${y(one.values[at])}%` }}
              />
            )
          ))}
        </div>
      )}

      {/* The readout sits under the chart rather than floating over it: a
          tooltip that follows the pointer covers the line it is about. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-bold text-white/70">
          {at !== null ? labels[at] : `${labels[0]} - ${labels[labels.length - 1]}`}
        </span>
        {series.map((one) => (
          <span key={one.label} className="flex items-center gap-1.5 text-muted">
            <span className={cn('h-2 w-2 rounded-full bg-current', one.tone)} />
            {one.label}
            <span className="font-bold tabular-nums text-white">
              {nice(
                at !== null
                  ? one.values[at] ?? 0
                  : one.summary === 'last'
                    ? one.values[one.values.length - 1] ?? 0
                    : one.values.reduce((a, b) => a + b, 0),
              )}
            </span>
          </span>
        ))}
        <span className="ml-auto text-muted">peak {nice(top)}</span>
      </div>
    </div>
  )
}

/** A row per thing, as long as its share of the biggest one. */
export function BarRows({ rows, className }: {
  rows: { label: string; value: number; note?: string; tone?: string }[]
  className?: string
}) {
  const top = Math.max(1, ...rows.map((one) => Math.abs(one.value)))

  return (
    <div className={cn('space-y-2', className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs font-semibold text-muted">
            {row.label}
          </span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-raised">
            <span
              className={cn('block h-full rounded-full', row.tone ?? 'bg-brand')}
              style={{ width: `${Math.max(2, (Math.abs(row.value) / top) * 100)}%` }}
            />
          </span>
          <span className="w-24 shrink-0 text-right text-xs font-bold tabular-nums">
            {nice(row.value)}
            {row.note && <span className="ml-1 font-normal text-muted">{row.note}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
