import { useEffect, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faShirt } from '@fortawesome/free-solid-svg-icons'
import { AvatarStage } from '@/components/avatar/AvatarStage'
import { lookOfOutfit } from '@/lib/api'
import type { AvatarLook } from '@/components/avatar/AvatarStage'
import { Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'

/**
 * A saved outfit, standing up.
 *
 * Staw: "for outfits, i want to see each outfit in 3d". The same
 * `AvatarStage` a profile and the editor use, handed the outfit's own look
 * instead of a person's - so an outfit on a card and the same outfit on a
 * body are drawn by one piece of code and cannot disagree.
 *
 * Fetched per card rather than in a batch above, which is the honest cost of
 * it: an outfit's pieces each need a signed address and the signing is a
 * request. Not turning and not draggable, because this sits in a grid where
 * a drag is the page being scrolled.
 */
export function OutfitStage({ outfitId, className }: {
  outfitId: string
  className?: string
}) {
  const [look, setLook] = useState<AvatarLook | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

  /*
   * `wanted` rather than trusting what this pass captured. A grid of these
   * mounts and unmounts as folders open, and a signing that lands after the
   * card has gone is the oldest bug in this repository.
   */
  useEffect(() => {
    let wanted = true
    setState('loading')
    lookOfOutfit(outfitId)
      .then((got) => {
        if (!wanted) return
        /*
         * `kind` is optional on what the reader hands back and required by
         * the stage, because a piece with no kind is a row the wardrobe
         * could not match to an item - a thing that was taken down since
         * the outfit was saved. It draws as nothing, which is correct, and
         * it must not stop the rest of the outfit drawing.
         */
        setLook({
          body: got.body,
          pieces: got.pieces.map((piece) => ({ ...piece, kind: piece.kind ?? '' })),
        })
        setState('ready')
      })
      .catch(() => { if (wanted) setState('failed') })
    return () => { wanted = false }
  }, [outfitId])

  return (
    <div className={cn('relative overflow-hidden bg-media', className)}>
      {state === 'loading' && <Skeleton className="h-full w-full" />}
      {state === 'failed' && (
        <span className="grid h-full w-full place-items-center">
          <Glyph icon={faShirt} className="text-2xl text-white/25" />
        </span>
      )}
      {state === 'ready' && look && (
        <AvatarStage look={look} turning={false} className="h-full w-full" />
      )}
    </div>
  )
}
