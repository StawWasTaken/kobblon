/*
 * Somebody, standing there, and everything they have on beside them.
 *
 * Laid out like the page Staw sent: the figure in a panel on the left with a
 * 2D/3D switch over it, and the things themselves in a grid to the right -
 * pictures, not names, because a grid of names is a list and he asked for
 * the cards.
 *
 * Its own component rather than markup inside the profile page, for the
 * reason everything else here is: a panel inside a page can only be looked
 * at by having the page, an account and a database, and this one is the part
 * most likely to come out wrong, being a figure and a grid sharing a row.
 * `tools/site/face-preview.html` mounts it with nothing around it.
 *
 * No provider of its own, and a router only because the tiles are links.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCube, faImage, faShirt } from '@fortawesome/free-solid-svg-icons'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/States'
import { AvatarStage, type AvatarLook } from '@/components/avatar/AvatarStage'
import { Studio } from '@/components/avatar/Studio'
import { ViewSwitch } from '@/components/avatar/ViewSwitch'
import { avatarTag, avatarKindLabels } from '@/lib/kinds'
import { drawPortrait, type PortraitLook } from '@/lib/portrait'

/**
 * The flat one.
 *
 * 2D is a *picture* - that is the whole difference from 3D, and the reason
 * it is worth having: it does not spin, it does not hold a WebGL context,
 * and it is what somebody wants when they are looking at the eight tiles
 * beside it rather than at the figure.
 *
 * Drawn once per look and kept for as long as the panel is open. Freed on
 * the way out: a blob URL nobody revokes is a leak that only shows up after
 * somebody has read twenty profiles.
 */
function useFlatPicture(look: PortraitLook | null, wanted: boolean) {
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

export function WearingPanel({ look, loading }: {
  look: PortraitLook | null
  loading?: boolean
}) {
  /*
   * The figure first. The flat one is for when somebody wants it to hold
   * still while they read the grid beside it.
   */
  const [mode, setMode] = useState<'picture' | 'body'>('body')
  const flat = useFlatPicture(look, mode === 'picture')

  // Only the pieces that have a page to go to. A thing taken down is still
  // worn and no longer has one.
  const wearing = (look?.pieces ?? []).filter((piece) => piece.contentId)

  return (
    <Card className="grid gap-4 p-4 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <Studio className="relative aspect-square rounded-2xl border border-ink-line">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <>
            {/* The Catalog's switch, which is the same control doing the
                same job - "just use the same design we had for the catalog". */}
            <ViewSwitch
              ways={[
                { value: 'picture' as const, icon: faImage, label: 'Picture' },
                { value: 'body' as const, icon: faCube, label: '3D' },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === 'body' ? (
              <AvatarStage look={look as AvatarLook | null} handled />
            ) : flat ? (
              <img src={flat} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="grid h-full w-full place-items-center text-sm text-muted">
                Drawing…
              </div>
            )}
          </>
        )}
      </Studio>

      {wearing.length === 0 ? (
        <p className="self-center text-sm text-muted">
          {loading ? 'Looking…' : 'Nothing on.'}
        </p>
      ) : (
        <div className="grid auto-rows-min grid-cols-3 gap-2.5 sm:grid-cols-4">
          {wearing.map((piece) => (
            <Link
              key={piece.itemId ?? piece.contentId}
              to={`/catalog/${avatarTag(piece.kind ?? '', piece.contentId)}`}
              title={piece.name ?? undefined}
              className="rounded-xl border border-ink-line bg-ink-raised p-2 transition-colors hover:border-brand/60"
            >
              <span className="block aspect-square overflow-hidden rounded-lg bg-ink-card">
                {piece.cardUrl ? (
                  <img
                    src={piece.cardUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-white/30">
                    <FontAwesomeIcon icon={faShirt} />
                  </span>
                )}
              </span>
              <span className="mt-1.5 block truncate text-[11px] font-bold">{piece.name}</span>
              <span className="block truncate text-[10px] uppercase tracking-wide text-muted">
                {avatarKindLabels[piece.kind ?? ''] ?? piece.kind}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
