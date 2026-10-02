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
  previewUrl, fileUrl, filePath, textureUrl, start = '2d', labelled, className,
  onWant3d,
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
  /**
   * With a word beside the icon. True on a page with room for one; false on
   * a card, where a word takes space from the thing it is a card for.
   */
  labelled?: boolean
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
    <div
      className={cn('relative select-none', className)}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
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
        * One button that swaps, rather than two that argue.
        *
        * It was a pair of segments with the current one lit, which is a
        * control for choosing among things you can see - and there are only
        * two here, you are already looking at one of them, and the lit
        * segment is the one that does nothing when pressed. So: a single
        * button showing the view you are *not* in. The icon is the
        * destination, which is the only thing worth saying.
        *
        * Only when there is something to swap to. A control that offers a
        * view which cannot be shown is the fake functionality this project
        * does not do.
        *
        * The card is a link, so the press is stopped here - and dragging is
        * refused on the whole frame, because turning a model inside a link
        * used to start the browser dragging the link and smear a ghost of
        * the card across the page.
        */}
      {canTurn && previewUrl && (
        <button
          type="button"
          draggable={false}
          title={showing === '3d' ? 'Show the picture' : 'Turn it'}
          aria-label={showing === '3d' ? 'Show the picture' : 'Turn it'}
          onDragStart={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setMode(showing === '3d' ? '2d' : '3d')
          }}
          /*
           * The two shapes set `display` themselves rather than one being
           * added on top of the other: `grid` and `flex` are the same
           * property, and which one wins is the order they appear in the
           * stylesheet, not the order they are written here. Written the
           * other way, the labelled one stacked its word under its icon.
           */
          className={cn(
            'absolute bottom-2 right-2 rounded-full',
            'border border-white/20 bg-ink/80 text-white/75 backdrop-blur-sm',
            'transition-colors hover:border-brand hover:bg-brand hover:text-white',
            labelled
              ? 'flex h-9 items-center gap-2 px-3.5 text-xs font-bold'
              : 'grid h-8 w-8 place-items-center text-xs',
          )}
        >
          <FontAwesomeIcon icon={showing === '3d' ? faImage : faCube} />
          {labelled && <span>{showing === '3d' ? 'Picture' : '3D'}</span>}
        </button>
      )}
    </div>
  )
}
