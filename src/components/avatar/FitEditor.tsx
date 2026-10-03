/*
 * Placing an accessory: a nudge, a turn and a resize.
 *
 * Three axes behind one control, because they are the same three numbers
 * three times over and three separate panels of sliders would be nine
 * sliders on a card. The shape is the one Staw asked for, down to the dots:
 * X is the red square, Y the green triangle, Z the blue circle - our own
 * shapes and our own colours, the ones the engine already uses for an axis.
 *
 * It adjusts the automatic fit rather than replacing it, which is why every
 * number starts at zero and the resize starts at one: an accessory nobody
 * has touched sits exactly where the measuring put it, and `Reset` is
 * therefore a real answer rather than a guess at a previous state.
 *
 * It owns no data. The page holds the value and decides when to save, so
 * this can be mounted in a dialog, on a card, or in the Workspace.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowsUpDownLeftRight, faRotate, faUpRightAndDownLeftFromCenter,
} from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Choices } from '@/components/ui/Choices'
import type { WornFit } from '@/engine'
import { cn } from '@/lib/cn'

/** Nothing adjusted: where everything starts and what Reset gives back. */
export const PLAIN_FIT: Required<WornFit> = { p: [0, 0, 0], r: [0, 0, 0], s: 1 }

export const asFit = (fit?: WornFit | null): Required<WornFit> => ({
  p: fit?.p ?? PLAIN_FIT.p,
  r: fit?.r ?? PLAIN_FIT.r,
  s: fit?.s ?? PLAIN_FIT.s,
})

/** Whether anything has actually been moved, so a page can skip a save. */
export const fitIsPlain = (fit: Required<WornFit>) =>
  fit.p.every((n) => n === 0) && fit.r.every((n) => n === 0) && fit.s === 1

type Mode = 'move' | 'turn' | 'size'

/*
 * The axis marks. Our shapes, in the engine's own axis colours - and the
 * shape carries the meaning as well as the colour does, so the control still
 * reads for somebody who cannot tell the red from the green.
 */
const AXES = [
  { key: 0, label: 'X', tint: '#f97070', shape: 'square' },
  { key: 1, label: 'Y', tint: '#5ce67e', shape: 'triangle' },
  { key: 2, label: 'Z', tint: '#5cc8f5', shape: 'circle' },
] as const

function AxisMark({ tint, shape }: { tint: string; shape: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-3.5 w-3.5 shrink-0',
        shape === 'circle' && 'rounded-full',
        shape === 'square' && 'rounded-[3px]',
      )}
      style={shape === 'triangle'
        ? {
          backgroundColor: tint,
          clipPath: 'polygon(50% 4%, 96% 92%, 4% 92%)',
          borderRadius: 2,
        }
        : { backgroundColor: tint }}
    />
  )
}

const LIMITS: Record<Mode, { least: number; most: number; step: number; unit: string }> = {
  // Short units: "0.00 stons" wrapped onto two lines in the column beside
  // the slider and made every row twice as tall as it needed to be.
  move: { least: -2, most: 2, step: 0.05, unit: ' st' },
  turn: { least: -180, most: 180, step: 5, unit: '°' },
  size: { least: 0.1, most: 4, step: 0.05, unit: '×' },
}

export function FitEditor({ value, onChange, onReset, className }: {
  value: Required<WornFit>
  onChange: (next: Required<WornFit>) => void
  /** Offered only when a caller has something to put back. */
  onReset?: () => void
  className?: string
}) {
  const [mode, setMode] = useState<Mode>('move')
  const limit = LIMITS[mode]

  const slide = (axis: number, to: number) => {
    if (mode === 'size') { onChange({ ...value, s: to }); return }
    const next = [...(mode === 'move' ? value.p : value.r)] as [number, number, number]
    next[axis] = to
    onChange(mode === 'move' ? { ...value, p: next } : { ...value, r: next })
  }

  const at = (axis: number) =>
    mode === 'size' ? value.s : (mode === 'move' ? value.p : value.r)[axis]

  return (
    <div className={cn('space-y-3 rounded-xl border border-ink-line bg-ink-raised p-3', className)}>
      <Choices
        label="What to adjust"
        size="sm"
        value={mode}
        onChange={(next) => setMode(next as Mode)}
        options={[
          { value: 'move', label: 'Move', icon: faArrowsUpDownLeftRight },
          { value: 'turn', label: 'Turn', icon: faRotate },
          { value: 'size', label: 'Size', icon: faUpRightAndDownLeftFromCenter },
        ]}
      />

      {/*
        * Size is one number, not three. Offering X, Y and Z for it would let
        * somebody squash a hat flat, which is not a thing anybody wants and
        * is a thing somebody would do by accident.
        */}
      {(mode === 'size' ? [AXES[1]] : AXES).map((axis) => (
        <label key={axis.key} className="flex items-center gap-2.5">
          {mode === 'size'
            ? <FontAwesomeIcon
                icon={faUpRightAndDownLeftFromCenter}
                className="h-3.5 w-3.5 shrink-0 text-white/45"
              />
            : <AxisMark tint={axis.tint} shape={axis.shape} />}
          <span className="sr-only">
            {mode === 'size' ? 'Size' : `${axis.label} ${mode === 'move' ? 'position' : 'rotation'}`}
          </span>
          <input
            type="range"
            min={limit.least}
            max={limit.most}
            step={limit.step}
            value={at(axis.key)}
            onChange={(e) => slide(axis.key, Number(e.target.value))}
            className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-ink-hover accent-brand-bright"
          />
          <span className="w-[4.5rem] shrink-0 whitespace-nowrap text-right font-mono text-[11px] tabular-nums text-muted">
            {mode === 'turn' ? Math.round(at(axis.key)) : at(axis.key).toFixed(2)}
            {limit.unit}
          </span>
        </label>
      ))}

      {onReset && (
        <Button size="sm" variant="ghost" block onClick={onReset}>
          Put it back where it was
        </Button>
      )}
    </div>
  )
}
