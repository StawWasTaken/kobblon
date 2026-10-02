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
import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCube, faImage, faCopy } from '@fortawesome/free-solid-svg-icons'
import { MeshViewer } from '@/components/create/MeshViewer'
import { formatOf, type MeshFormat } from '@/engine/meshes'
import { kindIcons } from '@/lib/kinds'
import { cn } from '@/lib/cn'

export type MeshViewMode = '2d' | '3d'

/**
 * The same picture as a PNG.
 *
 * Only for the clipboard. A card is WebP because WebP can hold
 * transparency at a sensible size; a clipboard handed WebP is a paste that
 * fails in about half the places somebody would paste it, with no error
 * anywhere - it simply does not arrive.
 */
async function asPng(blob: Blob): Promise<Blob> {
  const picture = new Image()
  picture.src = URL.createObjectURL(blob)
  try {
    await picture.decode()
    const sheet = document.createElement('canvas')
    sheet.width = picture.naturalWidth
    sheet.height = picture.naturalHeight
    const brush = sheet.getContext('2d')
    if (!brush) return blob
    brush.drawImage(picture, 0, 0)
    return await new Promise<Blob>((done) => {
      sheet.toBlob((made) => done(made ?? blob), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(picture.src)
  }
}

export function MeshView({
  previewUrl, fileUrl, filePath, textureUrl, start = '2d', labelled, bare,
  className, onWant3d, onTurn,
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
  /** The angle it is being turned to, for a creator setting their card. */
  onTurn?: (angle: { yaw: number; pitch: number }) => void
  /**
   * Without the frame, for a caller that is already one - a card's tile has
   * its own border and corners, and two of them is a box inside a box.
   *
   * A prop rather than a class passed in, because `cn` joins and does not
   * merge: `rounded-none` next to `rounded-2xl` is decided by which lands
   * later in the stylesheet, not by which was written last.
   */
  bare?: boolean
}) {
  const [mode, setMode] = useState<MeshViewMode>(start)

  /*
   * A turn that ends is not a press.
   *
   * The card is a link, and a pointer going down and up on it is a click
   * however far it travelled in between - so letting go after turning a
   * model opened its page, which is the opposite of what the hand was
   * doing. The viewer says when a turn actually happened, and the next
   * click is swallowed.
   *
   * A ref and a single click rather than a flag with a timer: the click
   * that follows a drag is the very next one, so there is nothing to time
   * out, and nothing left set if that click never comes.
   */
  const turnedJustNow = useRef(false)

  /*
   * A menu of our own, with one thing on it.
   *
   * Staw: you should be able to copy the render, and only copy it. So this
   * replaces the browser's menu rather than adding to it - the browser's
   * offers Save image as, Open image in new tab and Copy image address, and
   * on a signed address those are a private file's URL handed out with an
   * expiry on it. One item, and it is the one he asked for.
   *
   * A picture is not a licence: copying the render of a mesh is the same as
   * screenshotting the page, which nobody can prevent and this does not
   * pretend to. The file itself still goes through the permission check.
   */
  const take = useRef<null | (() => Promise<Blob | null>)>(null)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [said, setSaid] = useState<string | null>(null)

  useEffect(() => {
    if (!menu) return
    const shut = () => setMenu(null)
    // Any press anywhere, any scroll, and Escape. A menu that outlives what
    // opened it is the thing people report as "stuck".
    window.addEventListener('pointerdown', shut)
    window.addEventListener('scroll', shut, true)
    window.addEventListener('blur', shut)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') shut() }
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', shut)
      window.removeEventListener('scroll', shut, true)
      window.removeEventListener('blur', shut)
      window.removeEventListener('keydown', key)
    }
  }, [menu])

  const copy = async () => {
    setMenu(null)
    try {
      const picture = showing === '3d' && take.current
        ? await take.current()
        : previewUrl
          ? await fetch(previewUrl).then((r) => r.blob())
          : null
      if (!picture) { setSaid('Nothing to copy yet.'); return }

      /*
       * PNG on the way out whatever it was on the way in: a card is WebP,
       * and a clipboard that is handed WebP is a paste that fails in half
       * the places somebody would paste it.
       */
      const png = picture.type === 'image/png' ? picture : await asPng(picture)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      setSaid('Copied.')
    } catch {
      setSaid('Your browser would not let that be copied.')
    }
  }

  useEffect(() => {
    if (!said) return
    const go = window.setTimeout(() => setSaid(null), 2200)
    return () => window.clearTimeout(go)
  }, [said])

  // Opening in 3D is still asking for 3D.
  useEffect(() => { if (mode === '3d') onWant3d?.() }, [mode])

  const format: MeshFormat = formatOf(filePath ?? fileUrl ?? '')
  const canTurn = !!fileUrl || !!onWant3d
  const showing: MeshViewMode = mode === '3d' && !fileUrl && !onWant3d ? '2d' : mode

  /*
   * One frame, two contents.
   *
   * Both views used to draw their own: the viewer a bordered rounded panel,
   * the picture an image filling whatever it was in. So pressing the switch
   * changed the shape of the card as well as what was in it, and on an item
   * page the model sat in a box the picture did not have. Staw: the preview
   * and the real thing should look the same. They are the same frame now,
   * and only what is inside it changes.
   */
  return (
    <div
      className={cn(
        'relative grid w-full select-none place-items-center overflow-hidden',
        bare ? 'h-full' : 'aspect-square rounded-2xl border border-ink-line bg-ink-raised',
        className,
      )}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => {
        // Only where there is actually a render to copy.
        if (showing === '3d' ? !take.current : !previewUrl) return
        e.preventDefault()
        e.stopPropagation()
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setMenu({ x: e.clientX - box.left, y: e.clientY - box.top })
      }}
      onClickCapture={(e) => {
        if (!turnedJustNow.current) return
        turnedJustNow.current = false
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      {showing === '3d' ? (
        fileUrl ? (
          <MeshViewer
            bare
            className="absolute inset-0"
            src={fileUrl}
            format={format}
            textureUrl={textureUrl}
            onTurn={(angle) => { turnedJustNow.current = true; onTurn?.(angle) }}
            onSnapshot={(fn) => { take.current = fn }}
          />
        ) : (
          /* Asked for, not arrived: the frame keeps its size and says so. */
          <FontAwesomeIcon
            icon={kindIcons.mesh}
            style={{ width: '28%', height: 'auto' }}
            className="animate-pulse text-white/25"
          />
        )
      ) : previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          loading="lazy"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 h-full w-full select-none object-contain"
        />
      ) : (
        <FontAwesomeIcon icon={kindIcons.mesh} className="text-3xl text-white/35" />
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

      {menu && (
        <div
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute z-20 min-w-[11rem] overflow-hidden rounded-xl border border-ink-line bg-ink-raised py-1 shadow-pop"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); void copy() }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-ink-hover"
          >
            <FontAwesomeIcon icon={faCopy} className="text-white/40" />
            Copy the render
          </button>
        </div>
      )}

      {said && (
        <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-ink-sunken/90 px-3 py-1 text-[11px] font-bold text-white/80">
          {said}
        </span>
      )}
    </div>
  )
}