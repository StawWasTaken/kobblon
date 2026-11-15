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
  item, saved: given, className, alt,
}: {
  item: {
    id: string
    kind?: string | null
    slot?: string | null
    preview_path?: string | null
    mesh_preview_path?: string | null
    image_path?: string | null
    image_bucket?: string | null
    /** The sheet as an address, for a caller that has no path to give. */
    imageUrl?: string | null
    /** Which shape in the engine, for a body part. */
    shape?: string | null
  }
  /**
   * The card this caller has already worked out.
   *
   * For anything that resolved it before asking - a profile's worn pieces
   * carry `cardUrl` out of `buildLook` - so the saved card is used rather
   * than worked out a second time from fields this caller does not have.
   * Null is an answer: it means there is no card, and the mannequin is
   * drawn, which is what null means everywhere else here.
   */
  saved?: string | null
  className?: string
  alt?: string
}) {
  const saved = given !== undefined ? given : cardFor(item)
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

  /*
   * Drawing and failing are the same mark now. Staw: "for when an image is
   * loading or doesnt load, use the image we use for image not loading".
   * A quiet square while it drew and the torn mark after were two drawings
   * for one absence, and the swap between them read as something breaking.
   */
  return <Missing why={tried ? undefined : undefined} className={className} />
}
