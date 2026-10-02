import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FreeCorner } from '@/components/brand/FreeBadge'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck, faThumbsUp, faHandPointUp, faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { MeshView } from '@/components/create/MeshView'
import { getAsset, assetUrl } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { currency } from '@/lib/currency'
import type { MarketAsset } from '@/types/db'
import { Tooltip } from '@/components/ui/Tooltip'
import { CurrencyMark } from '@/components/brand/Currency'
import { overlayChip } from '@/lib/overlay'
import { cn } from '@/lib/cn'

/*
 * The words themselves live in `@/lib/kinds`, so the Workspace can import
 * them without importing a component. Re-exported here because every call
 * site already says AssetTile, and moving a name is not worth touching
 * thirty files for.
 */
export { kindIcons, kindLabels, contentTag } from '@/lib/kinds'
import { kindIcons, kindLabels, contentTag } from '@/lib/kinds'

export function AssetTile({ item, owned }: { item: MarketAsset; owned?: boolean }) {
  const preview = useSignedUrl(item.thumbnail_path ?? (item.kind === 'image' ? item.file_path : null))
  const tag = contentTag(item.kind, item.content_id)

  /*
   * A mesh can be turned on the card, and the model is fetched only when
   * somebody asks for that. A grid that downloads twenty models to show
   * twenty pictures is a grid nobody on a phone can open, and the great
   * majority of cards are never switched.
   *
   * The Decal comes with it: `get_asset` is what decides whether this viewer
   * may see the texture at all, so asking it is also the permission check.
   */
  const [model, setModel] = useState<{ file: string | null; skin: string | null } | null>(null)
  const [wanted, setWanted] = useState(false)
  const [path, setPath] = useState<string | null>(null)

  useEffect(() => {
    if (!wanted || item.kind !== 'mesh' || model || item.content_id == null) return
    let live = true
    void (async () => {
      const full = await getAsset(item.content_id as number).catch(() => null)
      if (!live || !full) return
      setPath(full.file_path)
      const [file, skin] = await Promise.all([
        assetUrl(full.file_path).catch(() => null),
        full.texture_path ? assetUrl(full.texture_path).catch(() => null) : null,
      ])
      if (live) setModel({ file, skin })
    })()
    return () => { live = false }
  }, [wanted, item.kind, item.content_id])

  return (
    <Tooltip
      label={item.price ? `${item.name} · ${currency.amount(item.price)}` : `${item.name} · free`}
      side="top"
    >
    {/*
      * The tile clips its corners, so the free badge goes on a wrapper that
      * does not - the half that hangs off is the half a card cuts away.
      */}
    <div className="relative">
      {!item.price && <FreeCorner />}
    <Link
      to={tag ? `/create/${tag}` : '/create'}
      className="block overflow-hidden rounded-xl border border-ink-line bg-ink-card transition-colors hover:border-brand/60">
      <div className="relative grid aspect-square place-items-center overflow-hidden bg-media">
        {item.kind === 'mesh' ? (
          <MeshView
            className="h-full w-full [&>*]:rounded-none"
            previewUrl={preview}
            fileUrl={model?.file}
            filePath={path ?? item.file_path}
            textureUrl={model?.skin}
            onWant3d={() => setWanted(true)}
          />
        ) : preview ? (
          <img
            src={preview}
            alt=""
            loading="lazy"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="h-full w-full select-none object-cover"
          />
        ) : (
          <FontAwesomeIcon icon={kindIcons[item.kind]} className="text-3xl text-white/35" />
        )}
        <span className={cn('absolute left-2 top-2', overlayChip)}>
          {kindLabels[item.kind]}
        </span>
        {owned && (
          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md bg-space text-[11px] text-[#fff]">
            <FontAwesomeIcon icon={faCheck} />
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="truncate text-sm font-bold">{item.name}</h3>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <span className="truncate">{item.creator_display_name}</span>
          {item.creator_is_admin && (
            <FontAwesomeIcon
              icon={faCircleCheck}
              className="shrink-0 text-[#4d68ff]"
              title="Verified Kobblon upload"
              aria-label="Verified"
            />
          )}
        </span>
        <p className="mt-2 flex items-center justify-between gap-2 text-[11px] text-white/40">
          {typeof item.score === 'number' && item.score !== null ? (
            <span className="inline-flex items-center gap-1.5">
              <FontAwesomeIcon icon={faThumbsUp} />
              {item.score}%
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <FontAwesomeIcon icon={faHandPointUp} />
              {formatCount(item.download_count)}
            </span>
          )}
          {item.price ? (
            <span className="inline-flex items-center gap-1 font-bold text-link">
              <CurrencyMark />
              {formatCount(item.price)}
            </span>
          ) : (
            <span className="font-mono">{tag}</span>
          )}
        </p>
      </div>
    </Link>
    </div>
    </Tooltip>
  )
}
