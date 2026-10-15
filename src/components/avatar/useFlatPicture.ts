import { useEffect, useState } from 'react'
import { drawPortrait, type PortraitLook } from '@/lib/portrait'

/**
 * A flat picture of a look, drawn on demand.
 *
 * The 2D half of the 2D/3D switch. It renders the body once, off screen,
 * and hands back an object URL - so flipping to flat costs one draw rather
 * than keeping a second WebGL context alive beside the first.
 *
 * Lifted out of `WearingPanel` when My Avatar wanted the same switch. Two
 * copies of this would be two copies of the revoke, and a missed revoke is
 * a leak nobody notices until a long session goes slow.
 *
 * `wanted` rather than an eager draw: somebody who never presses 2D never
 * pays for it.
 */
export function useFlatPicture(look: PortraitLook | null, wanted: boolean) {
  const [picture, setPicture] = useState<string | null>(null)

  useEffect(() => {
    if (!wanted || !look) return
    let live = true
    let made: string | null = null

    void (async () => {
      const drawn = await drawPortrait(look, '/k6/k6.glb', 'body').catch(() => null)
      if (!drawn) return
      made = URL.createObjectURL(drawn)
      // The person being drawn can change while this is in flight, which is
      // the trap this project keeps falling into. If it has, the picture is
      // thrown away rather than shown over somebody else.
      if (!live) { URL.revokeObjectURL(made); return }
      setPicture(made)
    })()

    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
      setPicture(null)
    }
  }, [look, wanted])

  return picture
}
