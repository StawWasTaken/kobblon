import { useEffect, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faShirt } from '@fortawesome/free-solid-svg-icons'
import { AvatarStage } from '@/components/avatar/AvatarStage'
import { lookOfOutfit } from '@/lib/api'
import type { AvatarLook } from '@/components/avatar/AvatarStage'
import { Skeleton } from '@/components/ui/States'
import { useFlatPicture } from '@/components/avatar/useFlatPicture'
import type { PortraitLook } from '@/lib/portrait'
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
export function OutfitStage({ outfitId, flat, turning = false, className }: {
  outfitId: string
  /**
   * Flat, when somebody presses 2D.
   *
   * The same two ways everything else in the Catalog offers, because Staw
   * asked for the asset pages to be one thing: "i want them to be
   * uniformized, like same thing for every asset, outfits, faces, etc, so
   * it means theres 2d & 3d for outfits too". The flat one is drawn from
   * the same look the stage is given, so the two are the same outfit.
   */
  flat?: boolean
  /** Slowly turning, which a page wants and a card in a grid does not. */
  turning?: boolean
  className?: string
}) {
  const [look, setLook] = useState<AvatarLook | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const picture = useFlatPicture(look as unknown as PortraitLook, !!flat && !!look)

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
        <>
          {/*
            * Drawn over the stage rather than instead of it, so pressing 3D
            * again does not cost a second load of the body.
            */}
          <AvatarStage
            look={look}
            fill
            turning={turning && !flat}
            className={cn('h-full w-full', flat && 'invisible')}
          />
          {flat && (
            <div className="absolute inset-0 grid place-items-center">
              {picture
                ? <img src={picture} alt="" className="h-full w-full object-contain" />
                : <p className="text-sm text-muted">Drawing…</p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
