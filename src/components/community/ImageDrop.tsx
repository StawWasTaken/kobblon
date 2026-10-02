import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Cropper } from '@/components/ui/Cropper'
import { cn } from '@/lib/cn'

const MAX_BYTES = 4 * 1024 * 1024

/** Drop a file on it, or pick one. Used for a Community's emblem and cover. */
export function ImageDrop({
  label,
  note,
  file,
  existing,
  aspect = 'square',
  required,
  onChange,
}: {
  label: string
  note?: string
  file: File | null
  existing?: string | null
  aspect?: 'square' | 'wide'
  required?: boolean
  onChange: (next: File | null) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropping, setCropping] = useState<File | null>(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  /*
   * Anything chosen goes through the cropper first, so what is stored is
   * already the shape it will be shown in and nothing ends up squashed or
   * cut off at the top by the page.
   *
   * **Except a GIF.** Staw asked for animated banners and thumbnails, and
   * they were already accepted here, already uploaded, and arrived dead: the
   * cropper draws onto a canvas, and a canvas holds one frame. Every GIF
   * anybody had ever used came out as its first frame, which is often the
   * blank one an animation fades in from.
   *
   * So a GIF is kept whole. The shape is then whatever the person made,
   * rather than what the cropper would have forced, and the frame it is
   * shown in covers and centres it - which is the trade worth making, since
   * a still banner that is the right shape is not the thing being asked for.
   */
  const take = (chosen: File | null | undefined) => {
    if (!chosen) return
    if (!chosen.type.startsWith('image/')) {
      setError('Pictures only.')
      return
    }
    if (chosen.size > MAX_BYTES) {
      setError('That image is over 4 MB.')
      return
    }
    setError(null)
    if (chosen.type === 'image/gif') {
      onChange(chosen)
      return
    }
    setCropping(chosen)
  }

  const shown = preview ?? existing ?? null

  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </p>
      {note && <p className="mb-2 text-xs text-muted">{note}</p>}
      {file?.type === 'image/gif' && (
        <p className="mb-2 text-xs text-space-bright">
          A GIF is kept as it is, so it keeps moving. It is not cropped.
        </p>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          take(e.dataTransfer.files?.[0])
        }}
        className={cn(
          'flex flex-col items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-colors sm:flex-row',
          dragging ? 'border-brand-bright bg-brand/10' : 'border-ink-line bg-ink-raised',
        )}
      >
        <div
          className={cn(
            'shrink-0 overflow-hidden rounded-lg bg-ink-hover',
            aspect === 'square' ? 'h-24 w-24' : 'h-20 w-40',
          )}
        >
          {shown ? (
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-white/25">
              <FontAwesomeIcon icon={faImage} className="text-xl" />
            </span>
          )}
        </div>

        <div className="flex-1 text-center sm:text-left">
          <p className="text-sm text-white/70">Drag a file here</p>
          <p className="my-1 text-xs text-white/30">or</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="rounded-lg border border-ink-line bg-ink-card px-3 py-1.5 text-xs font-bold transition-colors hover:bg-ink-hover"
          >
            Select an image from your computer
          </button>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
          {file && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white"
            >
              <FontAwesomeIcon icon={faXmark} /> Remove
            </button>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        onChange={(e) => { take(e.target.files?.[0]); e.target.value = '' }}
      />

      <Cropper
        open={!!cropping}
        file={cropping}
        aspect={aspect === 'wide' ? 16 / 9 : 1}
        onCancel={() => setCropping(null)}
        onDone={(cut) => { setCropping(null); onChange(cut) }}
      />
    </div>
  )
}
