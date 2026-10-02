/*
 * A mesh, shown either way, with the switch between them.
 *
 * Staw: a rendered picture and a thing you can turn, two in a dozen, the
 * picture by default everywhere except the item page, and you can swap.
 *
 * The default is the picture rather than the model, and that is not
 * timidity. A grid of twenty cards is twenty WebGL contexts, and a browser
 * gives out somewhere between eight and sixteen before it starts throwing
 * the oldest away - so a Marketplace that opened in 3D would show a wall of
 * dead black squares from the ninth card down. The picture is also instant,
 * where a model is a download, a parse and a frame. The item page is the one
 * place where somebody has asked for this thing in particular, so that is
 * the one place that opens turning.
 *
 * Mountable with no provider and no router: the Workspace shows meshes too.
 */
import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCube, faImage } from '@fortawesome/free-solid-svg-icons'
import { MeshViewer } from '@/components/create/MeshViewer'
import { formatOf, type MeshFormat } from '@/engine/meshes'
import { kindIcons } from '@/lib/kinds'
import { cn } from '@/lib/cn'

export type MeshViewMode = '2d' | '3d'

export function MeshView({
  previewUrl, fileUrl, filePath, textureUrl, start = '2d', className, onWant3d,
}: {
  /** The drawn card picture. */
  previewUrl?: string | null
  /** A signed address for the model itself. Absent until it is asked for. */
  fileUrl?: string | null
  /** The stored path, which keeps its extension where a signed address need not. */
  filePath?: string | null
  /** The Decal it wears, if any. */
  textureUrl?: string | null
  /** Which one it opens on. The item page says '3d'; everything else does not. */
  start?: MeshViewMode
  className?: string
  /**
   * Told the first time somebody asks for 3D, so a card can go and fetch the
   * model it deliberately did not fetch while it was only a picture.
   */
  onWant3d?: () => void
}) {
  const [mode, setMode] = useState<MeshViewMode>(start)

  // Opening in 3D is still asking for 3D.
  useEffect(() => { if (mode === '3d') onWant3d?.() }, [mode])

  const format: MeshFormat = formatOf(filePath ?? fileUrl ?? '')
  const canTurn = !!fileUrl || !!onWant3d
  const showing: MeshViewMode = mode === '3d' && !fileUrl && !onWant3d ? '2d' : mode

  return (
    <div className={cn('relative', className)}>
      {showing === '3d' ? (
        fileUrl ? (
          <MeshViewer src={fileUrl} format={format} textureUrl={textureUrl} />
        ) : (
          /* Asked for, not arrived: the frame keeps its size and says so. */
          <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border border-ink-line bg-ink-raised">
            <FontAwesomeIcon
              icon={kindIcons.mesh}
              style={{ width: '28%', height: 'auto' }}
              className="animate-pulse text-white/25"
            />
          </div>
        )
      ) : previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          loading="lazy"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          className="h-full w-full select-none rounded-2xl object-cover"
        />
      ) : (
        <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border border-ink-line bg-ink-raised">
          <FontAwesomeIcon icon={kindIcons.mesh} className="text-3xl text-white/35" />
        </div>
      )}

      {/*
        * Only when there is something to switch to. A switch offering a view
        * that cannot be shown is the fake functionality this project does
        * not do.
        *
        * The card is a link, so the press is stopped here: switching a view
        * is not clicking through to the page.
        */}
      {canTurn && previewUrl && (
        <div
          className="absolute bottom-2 right-2 flex overflow-hidden rounded-lg border border-white/15 bg-black/65 backdrop-blur-sm"
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        >
          {([
            ['2d', faImage, 'Picture'],
            ['3d', faCube, 'Turn it'],
          ] as const).map(([which, icon, label]) => (
            <button
              key={which}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={showing === which}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMode(which) }}
              className={cn(
                'grid h-7 w-8 place-items-center text-xs transition-colors',
                showing === which
                  ? 'bg-brand text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white',
              )}
            >
              <FontAwesomeIcon icon={icon} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
