import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowsUpDownLeftRight, faRotate, faLeftRight, faLayerGroup, faUpload,
} from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { defaultAvatars } from '@/lib/avatars'
import { currency } from '@/lib/currency'
import { cn } from '@/lib/cn'
import type { Placement, StyleItem } from '@/lib/api'

const slots: { value: StyleItem['slot']; label: string }[] = [
  { value: 'hat', label: 'Hat' },
  { value: 'hair', label: 'Hair' },
  { value: 'face', label: 'Face' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'frame', label: 'Frame' },
]

export const startingPlace: Placement = {
  x: 0.5, y: 0.5, width: 0.6, rotation: 0, flipped: false, layer: 1,
}

/**
 * Putting a thing where it goes.
 *
 * You drag it around a sample picture at the size it will actually be worn,
 * and what you drag it to is what everybody who wears it gets. The numbers
 * underneath are fractions of the picture, never pixels, so the placement
 * holds at any size the picture is drawn.
 */
export function StyleStudio({
  image, place, onPlace, face, className,
}: {
  image: string | null
  place: Placement
  onPlace: (next: Placement) => void
  /** The picture to try it on: your own, or one of the Kobby faces. */
  face?: string | null
  className?: string
}) {
  const board = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const drag = (event: React.PointerEvent) => {
    if (!image) return
    const box = board.current?.getBoundingClientRect()
    if (!box) return

    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)

    const startX = event.clientX
    const startY = event.clientY
    const from = { ...place }

    const move = (e: PointerEvent) => {
      onPlace({
        ...from,
        x: Math.min(1.5, Math.max(-0.5, from.x + (e.clientX - startX) / box.width)),
        y: Math.min(1.5, Math.max(-0.5, from.y + (e.clientY - startY) / box.height)),
      })
    }
    const stop = () => {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  /** Arrow keys for the last little bit, which a mouse is bad at. */
  const nudge = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.05 : 0.01
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    onPlace({ ...place, x: place.x + move[0], y: place.y + move[1] })
  }

  return (
    <div className={cn('grid gap-5 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]', className)}>
      <div>
        <div
          ref={board}
          className="relative mx-auto aspect-square w-full max-w-[18rem] overflow-visible rounded-2xl border border-ink-line bg-ink-raised"
        >
          {/* The same round picture it will be worn on, at a size you can
              actually aim at. */}
          <span className="absolute inset-[12%]">
            <Avatar
              src={face ?? defaultAvatars[0]}
              name="You"
              size="md"
              className="h-full w-full rounded-full"
            />
          </span>

          {image && (
            <img
              src={image}
              alt=""
              draggable={false}
              onPointerDown={drag}
              onKeyDown={nudge}
              tabIndex={0}
              role="button"
              aria-label="Drag to place, arrow keys to nudge"
              className={cn(
                /*
                 * `max-w-none` for the same reason StyleLayer needs it, and
                 * worse here: the studio lays the face into the middle 76%
                 * of this box, so the preflight clamp bit at a different
                 * width than it did everywhere else. A creator could drag
                 * something to 1.2, watch it look right, publish it, and
                 * have every other page on the site draw it at 1.0.
                 */
                'absolute max-w-none select-none outline-none',
                dragging ? 'cursor-grabbing' : 'cursor-grab',
                'ring-offset-2 ring-offset-ink-raised focus-visible:ring-2 focus-visible:ring-brand-bright',
              )}
              style={{
                left: `${12 + place.x * 76}%`,
                top: `${12 + place.y * 76}%`,
                width: `${place.width * 76}%`,
                transform: `translate(-50%, -50%) rotate(${place.rotation}deg)`
                  + (place.flipped ? ' scaleX(-1)' : ''),
                zIndex: place.layer === 0 ? 0 : 5,
              }}
            />
          )}

          {!image && (
            <p className="absolute inset-x-0 bottom-3 text-center text-xs text-muted">
              Upload a picture to place it
            </p>
          )}
        </div>

        <p className="mt-2 text-center text-xs text-muted">
          Drag it about. Arrow keys nudge, with shift for bigger steps.
        </p>
      </div>

      <div className="space-y-4">
        <Field icon={faArrowsUpDownLeftRight} label={`Size · ${Math.round(place.width * 100)}%`}>
          <input
            type="range" min={5} max={200} step={1}
            value={Math.round(place.width * 100)}
            onChange={(e) => onPlace({ ...place, width: Number(e.target.value) / 100 })}
            className="w-full accent-brand-bright"
            aria-label="Size"
          />
        </Field>

        <Field icon={faRotate} label={`Turn · ${Math.round(place.rotation)}°`}>
          <input
            type="range" min={-180} max={180} step={1}
            value={Math.round(place.rotation)}
            onChange={(e) => onPlace({ ...place, rotation: Number(e.target.value) })}
            className="w-full accent-brand-bright"
            aria-label="Turn"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={place.flipped ? 'primary' : 'subtle'}
            size="sm"
            icon={faLeftRight}
            onClick={() => onPlace({ ...place, flipped: !place.flipped })}
          >
            Mirror
          </Button>
          <Button
            variant={place.layer === 0 ? 'primary' : 'subtle'}
            size="sm"
            icon={faLayerGroup}
            onClick={() => onPlace({ ...place, layer: place.layer === 0 ? 1 : 0 })}
          >
            {place.layer === 0 ? 'Behind the picture' : 'In front'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPlace({ ...startingPlace })}
          >
            Start again
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ icon, label, children }: {
  icon: typeof faRotate
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        <FontAwesomeIcon icon={icon} />
        {label}
      </span>
      {children}
    </label>
  )
}

/** The rest of what a thing needs before it can go up. */
export function StyleDetails({
  name, description, slot, price, onChange,
}: {
  name: string
  description: string
  slot: StyleItem['slot']
  price: string
  onChange: (patch: Partial<{
    name: string; description: string; slot: StyleItem['slot']; price: string
  }>) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Name</span>
        <Input
          value={name}
          maxLength={40}
          placeholder="Spark Visor"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>

      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
          What it is
        </span>
        <textarea
          value={description}
          maxLength={300}
          rows={2}
          placeholder="A red visor, worn at a slight angle."
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm transition-colors placeholder:text-white/30 focus:border-brand-bright focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Kind</span>
        <Select
          label="Kind"
          value={slot}
          onChange={(next) => onChange({ slot: next as StyleItem['slot'] })}
          options={slots}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
          Price {currency.inWord}
        </span>
        <Input
          value={price}
          inputMode="numeric"
          placeholder="0 for free"
          onChange={(e) => onChange({ price: e.target.value.replace(/[^0-9]/g, '') })}
        />
      </label>
    </div>
  )
}

export const uploadIcon = faUpload
