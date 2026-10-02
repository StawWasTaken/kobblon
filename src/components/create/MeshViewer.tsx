/*
 * A mesh, turning, wearing its Decal.
 *
 * Before this, a mesh's page showed the flat JPEG taken at upload: one
 * angle, no texture, and no way to tell a good model from a bad one. Which
 * is the whole question somebody is on that page to answer.
 *
 * Drag to turn it, wheel to come closer. It turns by itself, stops while
 * somebody is handling it, and picks up again a moment after they let go.
 *
 * It used to stop for good on the first touch, on the reasoning that a thing
 * resuming under your hand is fighting you. That half is right and is why
 * the pause lasts until a little after the last input rather than until the
 * pointer lifts - but stopping for ever meant one stray scroll left the
 * model dead for the rest of the visit, which is worse.
 *
 * Mounted by the Workspace as well, so: no provider, no router, no reading
 * of the page it sits on. It is handed two addresses and a size.
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCube, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import {
  formatOf, frameMesh, lightForLooking, loadMesh, releaseMesh, wearTexture,
  lookFrom, LOOK_YAW, LOOK_PITCH,
} from '@/lib/mesh'
import type { MeshFormat } from '@/lib/mesh'
import { cn } from '@/lib/cn'

/** How fast it turns when nobody is holding it, in radians a second. */
const DRIFT = 0.42
/** How long after the last touch before it starts turning again, in seconds. */
const SETTLE = 1.6
/** How close and how far the wheel may take you, against the model's size. */
const NEAREST = 0.35
const FURTHEST = 2.4

type State = 'loading' | 'shown' | 'failed'

export function MeshViewer({
  src, format, textureUrl, className, bare, onTurn,
}: {
  /** The mesh file. A signed address is fine; it is only read once. */
  src: string | null
  /**
   * Which format it is. Pass it wherever the real filename is known: a
   * signed or blob address often has no extension on it, and the guess made
   * from one is wrong exactly there.
   */
  format?: MeshFormat
  /** The Decal it wears, if it wears one and the viewer may see it. */
  textureUrl?: string | null
  className?: string
  /**
   * Without its own frame, for a caller that has already drawn one.
   *
   * `MeshView` shows this and a picture in turn, and they have to be the
   * same shape: a viewer with its own border and background inside a tile
   * that has its own made the 3D view a panel sitting inside the card while
   * the picture filled it edge to edge, so switching changed the layout as
   * well as the content.
   */
  bare?: boolean
  /**
   * The angle it is being looked from, as it changes. For a creator setting
   * the angle their card is taken from - the only one who knows which side
   * of their model is the front.
   */
  onTurn?: (angle: { yaw: number; pitch: number }) => void
}) {
  const holder = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<State>('loading')

  /*
   * Held in a ref rather than read from the closure. The effect below runs
   * once per model and lives for as long as the model is on screen; a
   * callback captured into it would be whichever one existed at mount - the
   * value-captured-before-the-thing-that-decides-it trap, in the disguise it
   * wears in React.
   */
  const told = useRef(onTurn)
  told.current = onTurn

  useEffect(() => {
    const mount = holder.current
    if (!mount || !src) return

    const kind = format ?? formatOf(src)

    setState('loading')

    /*
     * The trap this project keeps falling into, in its fourth disguise: this
     * runs across two awaits, and by the time they finish the person may
     * have opened another mesh. Every step past an await asks whether this
     * pass is still the one wanted, rather than trusting what it captured.
     */
    let wanted = true
    let frame = 0
    let renderer: THREE.WebGLRenderer | null = null
    let model: THREE.Object3D | null = null

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    lightForLooking(scene)

    /*
     * Opens where the card was taken from. The two used to be set
     * independently - the card three-quarters from one side, the viewer
     * square on from the other - so the same model looked like two models
     * depending on whether you were looking at a grid or at its page.
     */
    const turn = { yaw: LOOK_YAW, pitch: LOOK_PITCH, closeness: 1 }
    let held = false
    /*
     * When the last input was, rather than whether there has ever been one.
     * `performance.now()` and not `Date.now()`: the clock the frame loop
     * already reads, and one that cannot jump backwards.
     */
    let lastTouched = -Infinity
    let last = { x: 0, y: 0 }

    const place = (middle: THREE.Vector3, away: number) => {
      camera.position.copy(
        lookFrom(middle, away * turn.closeness, turn.yaw, turn.pitch),
      )
      camera.lookAt(middle)
    }

    const grab = (e: PointerEvent) => {
      held = true
      lastTouched = performance.now()
      last = { x: e.clientX, y: e.clientY }
      mount.setPointerCapture(e.pointerId)
    }
    const drag = (e: PointerEvent) => {
      if (!held) return
      lastTouched = performance.now()
      turn.yaw -= (e.clientX - last.x) * 0.01
      // Stopped short of straight up and straight down: at the poles the
      // model spins around a point instead of turning, which reads as broken.
      turn.pitch = Math.max(-1.3, Math.min(1.3, turn.pitch + (e.clientY - last.y) * 0.01))
      last = { x: e.clientX, y: e.clientY }
    }
    const drop = (e: PointerEvent) => {
      held = false
      lastTouched = performance.now()
      if (mount.hasPointerCapture(e.pointerId)) mount.releasePointerCapture(e.pointerId)
    }
    const roll = (e: WheelEvent) => {
      e.preventDefault()
      lastTouched = performance.now()
      // Proportional, so a step feels the same close up and far away.
      turn.closeness = Math.max(
        NEAREST,
        Math.min(FURTHEST, turn.closeness * (1 + Math.sign(e.deltaY) * 0.12)),
      )
    }

    void (async () => {
      try {
        const loaded = await loadMesh(src, kind)
        if (!wanted) { releaseMesh(loaded); return }
        model = loaded

        /*
         * An attached Decal wins, whatever the format.
         *
         * This used to skip glTF, on the reasoning that a model which brings
         * its own materials should keep them. That reasoning is right for a
         * default nobody chose and wrong for this: `texture_id` is somebody
         * deliberately saying "dress it in this". So a .glb with a Decal
         * attached stayed grey and the attaching looked broken - which is
         * what Staw was seeing, and it was inconsistent too, because the
         * engine has always painted an attached Decal onto any mesh.
         *
         * Roblox does the same thing: TextureID on a MeshPart overrides.
         * A model with no Decal attached still keeps everything it brought.
         */
        if (textureUrl) {
          const picture = await new THREE.TextureLoader().loadAsync(textureUrl)
          if (!wanted) { picture.dispose(); releaseMesh(loaded); model = null; return }
          wearTexture(loaded, picture, kind)
        }

        scene.add(loaded)
        const { middle, away } = frameMesh(loaded, camera)

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        mount.appendChild(renderer.domElement)
        renderer.domElement.className = 'h-full w-full cursor-grab active:cursor-grabbing'

        const size = () => {
          if (!renderer) return
          const { clientWidth: w, clientHeight: h } = mount
          if (!w || !h) return
          renderer.setSize(w, h, false)
          camera.aspect = w / h
          camera.updateProjectionMatrix()
        }
        size()
        const watcher = new ResizeObserver(size)
        watcher.observe(mount)

        mount.addEventListener('pointerdown', grab)
        mount.addEventListener('pointermove', drag)
        mount.addEventListener('pointerup', drop)
        mount.addEventListener('pointercancel', drop)
        mount.addEventListener('wheel', roll, { passive: false })

        setState('shown')

        let then = performance.now()
        const tick = (now: number) => {
          frame = requestAnimationFrame(tick)
          const step = Math.min(0.1, (now - then) / 1000)
          then = now
          // Still while it is being handled, and for a moment afterwards.
          const resting = !held && now - lastTouched > SETTLE * 1000
          if (resting) turn.yaw += DRIFT * step
          place(middle, away)
          renderer?.render(scene, camera)
          /*
           * Only while somebody is turning it, not while it drifts. The
           * angle this reports is meant to be one a person chose, and the
           * turntable would otherwise overwrite it a moment later with
           * wherever it happened to have spun to.
           */
          if (held) told.current?.({ yaw: turn.yaw, pitch: turn.pitch })
        }
        frame = requestAnimationFrame(tick)

        return () => watcher.disconnect()
      } catch {
        if (wanted) setState('failed')
      }
    })()

    return () => {
      wanted = false
      cancelAnimationFrame(frame)
      mount.removeEventListener('pointerdown', grab)
      mount.removeEventListener('pointermove', drag)
      mount.removeEventListener('pointerup', drop)
      mount.removeEventListener('pointercancel', drop)
      mount.removeEventListener('wheel', roll)
      if (model) releaseMesh(model)
      renderer?.dispose()
      renderer?.domElement.remove()
    }
  }, [src, format, textureUrl])

  return (
    <div
      className={cn(
        'relative grid aspect-square w-full place-items-center overflow-hidden',
        !bare && 'rounded-2xl border border-ink-line bg-ink-raised',
        className,
      )}
    >
      {/*
        * `select-none` and a refused dragstart: turning a model is a drag,
        * and without these the browser treats it as dragging whatever the
        * viewer sits inside - a link, on every card - and paints a ghost of
        * the card under the cursor while the model turns behind it.
        */}
      <div
        ref={holder}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className="absolute inset-0 touch-none select-none"
      />

      {state !== 'shown' && (
        <div className="pointer-events-none relative grid place-items-center gap-2 text-white/30">
          <FontAwesomeIcon
            icon={state === 'failed' ? faTriangleExclamation : faCube}
            style={{ width: '34%', height: 'auto' }}
            className={state === 'loading' ? 'animate-pulse' : ''}
          />
          {state === 'failed' && (
            <span className="font-display text-xs uppercase tracking-wider">
              This mesh could not be drawn
            </span>
          )}
        </div>
      )}

      {state === 'shown' && (
        /* Left, not centred: the view switch sits bottom right, and a
           centred hint ran straight into it once that switch had a word on
           it. */
        <span className="pointer-events-none absolute bottom-2 left-3 rounded-full bg-ink-sunken/80 px-3 py-1 font-display text-[10px] uppercase tracking-wider text-white/40">
          Drag to turn
        </span>
      )}
    </div>
  )
}
