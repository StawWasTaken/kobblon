import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faEyeDropper, faCheck } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/*
 * Colour, picked our way.
 *
 * The browser's own colour control is a different program wearing a small
 * square: it looks like the operating system, not like Kobblon, and it
 * cannot hold a colour that is partly see through, which is most of what a
 * page is actually built out of. So this is ours: a square for how strong and
 * how bright, a bar for which colour, a bar for how solid, the hex if you
 * would rather type it, and the house colours within reach.
 */

export type Rgba = { r: number; g: number; b: number; a: number }

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value))
const hex2 = (value: number) => Math.round(value).toString(16).padStart(2, '0')

export function toHex({ r, g, b, a }: Rgba) {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`
  return a >= 1 ? base : `${base}${hex2(a * 255)}`
}

/** Anything a stylesheet would accept as a hex, read back into numbers. */
export function readColour(value: string): Rgba {
  const raw = String(value ?? '').trim().replace(/^#/, '')
  const grow = (part: string) => parseInt(part + part, 16)

  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return { r: grow(raw[0]), g: grow(raw[1]), b: grow(raw[2]), a: 1 }
  }
  if (/^[0-9a-f]{4}$/i.test(raw)) {
    return { r: grow(raw[0]), g: grow(raw[1]), b: grow(raw[2]), a: grow(raw[3]) / 255 }
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
      a: 1,
    }
  }
  if (/^[0-9a-f]{8}$/i.test(raw)) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
      a: parseInt(raw.slice(6, 8), 16) / 255,
    }
  }
  return { r: 27, g: 52, b: 232, a: 1 }
}

function toHsv({ r, g, b }: Rgba) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const high = Math.max(red, green, blue)
  const low = Math.min(red, green, blue)
  const spread = high - low

  let hue = 0
  if (spread) {
    if (high === red) hue = ((green - blue) / spread) % 6
    else if (high === green) hue = (blue - red) / spread + 2
    else hue = (red - green) / spread + 4
  }
  hue = (hue * 60 + 360) % 360

  return { h: hue, s: high ? spread / high : 0, v: high }
}

function fromHsv(h: number, s: number, v: number, a: number): Rgba {
  const chroma = v * s
  const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const lift = v - chroma
  const [red, green, blue] =
    h < 60 ? [chroma, second, 0]
    : h < 120 ? [second, chroma, 0]
    : h < 180 ? [0, chroma, second]
    : h < 240 ? [0, second, chroma]
    : h < 300 ? [second, 0, chroma]
    : [chroma, 0, second]

  return { r: (red + lift) * 255, g: (green + lift) * 255, b: (blue + lift) * 255, a }
}

/** The house colours, plus the greys a page is usually laid out with. */
const HOUSE = [
  '#1B34E8', '#3A50FF', '#162382', '#1CAE71', '#ff0033', '#FFB020',
  '#101012', '#17171A', '#24242A', '#8A8A94', '#F4F4F6', '#FFFFFF',
  '#00000000', '#FFFFFF12', '#FFFFFF22', '#FFFFFF55', '#00000055', '#000000',
]

/** A drag surface that reports where inside it the pointer is, 0 to 1. */
function useDragArea(onMove: (x: number, y: number) => void) {
  const area = useRef<HTMLDivElement>(null)
  const [down, setDown] = useState(false)

  const report = (clientX: number, clientY: number) => {
    const box = area.current?.getBoundingClientRect()
    if (!box) return
    onMove(clamp((clientX - box.left) / box.width), clamp((clientY - box.top) / box.height))
  }

  useEffect(() => {
    if (!down) return
    const move = (e: PointerEvent) => report(e.clientX, e.clientY)
    const up = () => setDown(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  })

  return {
    ref: area,
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDown(true)
      report(e.clientX, e.clientY)
    },
  }
}

function Panel({
  value, onChange, onClose, anchor,
}: {
  value: string
  onChange: (next: string) => void
  onClose: () => void
  anchor: DOMRect
}) {
  const start = readColour(value)
  const [hsv, setHsv] = useState(() => ({ ...toHsv(start), a: start.a }))
  const [typed, setTyped] = useState(toHex(start))
  const card = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState({ top: anchor.bottom + 8, left: anchor.left })

  const push = (next: { h: number; s: number; v: number; a: number }) => {
    setHsv(next)
    const hex = toHex(fromHsv(next.h, next.s, next.v, next.a))
    setTyped(hex)
    onChange(hex)
  }

  // Kept on screen: flipped above the swatch when there is no room below,
  // and pulled in from the edge rather than hanging off it.
  useLayoutEffect(() => {
    const box = card.current?.getBoundingClientRect()
    if (!box) return
    const below = anchor.bottom + 8 + box.height < window.innerHeight
    setPlace({
      top: below ? anchor.bottom + 8 : Math.max(8, anchor.top - box.height - 8),
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - box.width - 8)),
    })
  }, [anchor])

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!card.current?.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', away)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])

  const field = useDragArea((x, y) => push({ ...hsv, s: x, v: 1 - y }))
  const hueBar = useDragArea((x) => push({ ...hsv, h: x * 360 }))
  const alphaBar = useDragArea((x) => push({ ...hsv, a: x }))

  const solid = toHex(fromHsv(hsv.h, 1, 1, 1))
  const current = toHex(fromHsv(hsv.h, hsv.s, hsv.v, hsv.a))

  return createPortal(
    <div
      ref={card}
      style={{ top: place.top, left: place.left }}
      className="fixed z-[95] w-64 rounded-2xl border border-ink-line bg-ink-card p-3 shadow-pop"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* how strong, how bright */}
      <div
        {...field}
        className="relative h-36 w-full cursor-crosshair touch-none rounded-xl"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${solid})`,
        }}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: current }}
        />
      </div>

      {/* which colour */}
      <div
        {...hueBar}
        className="relative mt-3 h-3 w-full cursor-pointer touch-none rounded-full"
        style={{
          background:
            'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${(hsv.h / 360) * 100}%`, background: solid }}
        />
      </div>

      {/* how solid */}
      <div
        {...alphaBar}
        className="relative mt-3 h-3 w-full cursor-pointer touch-none rounded-full"
        style={{
          backgroundImage:
            `linear-gradient(to right, transparent, ${toHex(fromHsv(hsv.h, hsv.s, hsv.v, 1))}),`
            + 'linear-gradient(45deg, #5a5a62 25%, transparent 25%, transparent 75%, #5a5a62 75%),'
            + 'linear-gradient(45deg, #5a5a62 25%, #2a2a30 25%, #2a2a30 75%, #5a5a62 75%)',
          backgroundSize: '100% 100%, 8px 8px, 8px 8px',
          backgroundPosition: '0 0, 0 0, 4px 4px',
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.a * 100}%` }}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className="h-8 w-8 shrink-0 rounded-lg border border-ink-line"
          style={{ background: current }}
        />
        <input
          value={typed}
          onChange={(e) => {
            const next = e.target.value
            setTyped(next)
            if (/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(next.trim())) {
              const read = readColour(next)
              setHsv({ ...toHsv(read), a: read.a })
              onChange(toHex(read))
            }
          }}
          spellCheck={false}
          aria-label="Colour as hex"
          className="h-8 w-full rounded-lg border border-ink-line bg-ink-raised px-2 text-xs font-bold uppercase tabular-nums focus:border-brand-bright focus:outline-none"
        />
      </div>

      <div className="mt-3 grid grid-cols-9 gap-1.5">
        {HOUSE.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={swatch}
            onClick={() => {
              const read = readColour(swatch)
              setHsv({ ...toHsv(read), a: read.a })
              setTyped(swatch)
              onChange(swatch)
            }}
            className="grid h-5 w-full place-items-center rounded-md border border-white/15"
            style={{ background: swatch }}
          >
            {swatch.toLowerCase() === current.toLowerCase() && (
              <Glyph icon={faCheck} className="text-[8px] mix-blend-difference" />
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

/**
 * The control itself: a swatch you press, and the hex beside it so a colour
 * can be read at a glance without opening anything.
 */
export function ColourPicker({
  value, onChange, className,
}: {
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  const button = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <button
        ref={button}
        type="button"
        aria-label="Pick a colour"
        onClick={() => setAnchor(anchor ? null : (button.current?.getBoundingClientRect() ?? null))}
        className="relative h-9 w-10 shrink-0 overflow-hidden rounded-lg border border-ink-line"
        style={{
          backgroundImage:
            'linear-gradient(45deg, #5a5a62 25%, transparent 25%, transparent 75%, #5a5a62 75%),'
            + 'linear-gradient(45deg, #5a5a62 25%, #2a2a30 25%, #2a2a30 75%, #5a5a62 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 4px 4px',
        }}
      >
        <span className="absolute inset-0" style={{ background: value }} />
        <Glyph
          icon={faEyeDropper}
          className="absolute bottom-0.5 right-0.5 text-[9px] text-white mix-blend-difference"
        />
      </button>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label="Colour"
        placeholder="#1B34E8"
        className="h-9 w-full rounded-lg border border-ink-line bg-ink-raised px-3 text-sm font-semibold uppercase focus:border-brand-bright focus:outline-none"
      />

      {anchor && (
        <Panel
          value={value}
          anchor={anchor}
          onChange={onChange}
          onClose={() => setAnchor(null)}
        />
      )}
    </span>
  )
}
