/*
 * Somebody, standing there, and everything they have on beside them.
 *
 * Its own component rather than markup inside the profile page, for the
 * reason everything else here is: a panel inside a page can only be looked
 * at by having the page, an account, and a database - and this one is the
 * part of the profile most likely to come out wrong, because it is a figure
 * and a grid sharing a row. `tools/site/face-preview.html` mounts it with
 * nothing around it.
 *
 * No provider and no router of its own: it is handed a look and draws it.
 * The Workspace shows people too.
 */
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShirt } from '@fortawesome/free-solid-svg-icons'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/States'
import { AvatarStage, type AvatarLook } from '@/components/avatar/AvatarStage'
import { Studio } from '@/components/avatar/Studio'
import { avatarTag, avatarKindLabels } from '@/lib/kinds'
import type { PortraitLook } from '@/lib/portrait'

export function WearingPanel({ look, loading }: {
  look: PortraitLook | null
  loading?: boolean
}) {
  // Only the pieces that have a page to go to. A thing taken down is still
  // worn and no longer has one.
  const wearing = (look?.pieces ?? []).filter((piece) => piece.contentId)

  return (
    <Card className="grid gap-4 p-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <Studio className="relative aspect-square rounded-2xl border border-ink-line">
        {loading
          ? <Skeleton className="h-full w-full" />
          : <AvatarStage look={look as AvatarLook | null} handled />}
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
