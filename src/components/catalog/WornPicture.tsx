import { useEffect, useState } from 'react'
import { cardFor } from '@/lib/api'
import { wornCard } from '@/lib/wornCard'
import { Missing } from '@/components/brand/Missing'
import { cn } from '@/lib/cn'

/**
 * The picture of a thing to wear.
 *
 * The saved card where there is one. Where there is not, and the thing is a
 * garment, it is drawn on the mannequin in this tab rather than falling back
 * to the template sheet - `cardFor` returns null for exactly that case now,
 * and this is what answers it.
 *
 * Everything else keeps its own picture, because a face is a face and an
 * accessory's model card is already a picture of the thing.
 */
export function WornPicture({
  item, className, alt,
}: {
  item: {
    id: string
    kind?: string | null
    slot?: string | null
    preview_path?: string | null
    mesh_preview_path?: string | null
    image_path?: string | null
    image_bucket?: string | null
    /** Which shape in the engine, for a body part. */
    shape?: string | null
  }
  className?: string
  alt?: string
}) {
  const saved = cardFor(item)
  const [made, setMade] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (saved) return
    let live = true
    void wornCard(item).then((url) => {
      if (!live) return
      setMade(url)
      setTried(true)
    })
    return () => { live = false }
  }, [saved, item.id])

  const picture = saved ?? made
  if (picture) {
    return (
      <img
        src={picture}
        alt={alt ?? ''}
        loading="lazy"
        draggable={false}
        className={cn('h-full w-full object-contain', className)}
      />
    )
  }

  // Still drawing is a quiet square; drawn and come back with nothing is the
  // torn mark, because that one is worth telling somebody about.
  if (!tried) return <span className={cn('block h-full w-full bg-media', className)} />
  return <Missing className={className} />
}
