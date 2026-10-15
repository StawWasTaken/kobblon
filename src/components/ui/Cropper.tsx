import { useEffect, useRef, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faMagnifyingGlassPlus, faRotate } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

/**
 * Cut a picture to the shape it will be shown in, before it is uploaded.
 *
 * A Community emblem is drawn as a square everywhere on Kobblon, so an
 * upload that is not square has to be cut somewhere. Doing it here means the
 * person choosing the picture decides which part survives, rather than the
 * page squashing it or lopping off the top.
 */
export function Cropper({
  file, aspect = 1, open, onCancel, onDone,
}: {
  file: File | null
  /** width divided by height: 1 for an emblem, 16/9 for a cover. */
  aspect?: number
  open: boolean
  onCancel: () => void
  onDone: (cut: File) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    if (!file) { setImage(null); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { setImage(img); setZoom(1); setOffset({ x: 0, y: 0 }) }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Dragging moves the picture under a fixed window.
  useEffect(() => {
    if (!open) return
    const move = (e: PointerEvent) => {
      if (!drag.current) return
      setOffset({
        x: drag.current.ox + (e.clientX - drag.current.x),
        y: drag.current.oy + (e.clientY - drag.current.y),
      })
    }
    const up = () => { drag.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [open])

  const cut = () => {
    const box = frame.current?.getBoundingClientRect()
    if (!image || !box) return

    // The window is `box`; work out what part of the picture sits under it.
    const cover = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight)
    const scale = cover * zoom
    const drawnW = image.naturalWidth * scale
    const drawnH = image.naturalHeight * scale
    const left = (box.width - drawnW) / 2 + offset.x
    const top = (box.height - drawnH) / 2 + offset.y

    // Output at a sensible size for the shape rather than the source size.
    const outW = aspect >= 1 ? 512 : Math.round(512 * aspect)
    const outH = aspect >= 1 ? Math.round(512 / aspect) : 512

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingQuality = 'high'

    const ratio = outW / box.width
    ctx.drawImage(image, left * ratio, top * ratio, drawnW * ratio, drawnH * ratio)

    canvas.toBlob((blob) => {
      if (!blob) return
      onDone(new File([blob], (file?.name ?? 'picture').replace(/\.[^.]+$/, '') + '.png', {
        type: 'image/png',
      }))
    }, 'image/png', 0.95)
  }

  const cover = image ? { width: '100%', height: '100%' } : {}

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Cut it to shape"
      description="Drag the picture and pinch the slider. What is inside the frame is what people see."
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={cut} disabled={!image}>Use this</Button>
        </>
      }
    >
      <div
        ref={frame}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
        }}
        style={{ aspectRatio: String(aspect) }}
        className="relative mx-auto w-full max-w-sm cursor-grab touch-none overflow-hidden rounded-2xl bg-media active:cursor-grabbing"
      >
        {image && (
          <img
            src={image.src}
            alt=""
            draggable={false}
            style={{
              ...cover,
              objectFit: 'cover',
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: 'center',
            }}
            className="pointer-events-none select-none"
          />
        )}

        {/* The frame edge, so it is obvious what is kept. */}
        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-onbrand/70" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Glyph icon={faMagnifyingGlassPlus} className="text-sm" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-hover accent-[#3A50FF]"
        />
        <Button
          size="sm"
          variant="ghost"
          icon={faRotate}
          aria-label="Start again"
          onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }) }}
        />
      </div>
    </Dialog>
  )
}
