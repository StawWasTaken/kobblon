/*
 * Somebody's avatar, drawn.
 *
 * One component, used everywhere a person is shown in three dimensions: the
 * editor, their profile, and the shot a profile picture is taken from. The
 * alternative - the editor drawing one avatar and the profile drawing
 * another - is how two versions of a person end up on one site, each wrong
 * in its own way.
 *
 * It takes what `avatar_of` returns and nothing else. No provider, no
 * router: the Workspace shows people too.
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser } from '@fortawesome/free-solid-svg-icons'
import {
  K6, loadK6Source, headshot, dressFrom,
  type WornFit,
} from '@/engine'
import { cn } from '@/lib/cn'

/*
 * The same handling a mesh has, because an avatar is a thing you look at in
 * the same way. Staw asked for it and it is the right call: a body you can
 * only see from the front is a body whose back nobody ever checks, and the
 * person most likely to want to turn it is the one who just put something on
 * its back.
 *
 * The numbers are `MeshViewer`'s. Not shared through a module, because what
 * is shared is the *feel* and not an implementation - but written the same
 * on purpose, so turning an avatar and turning a mesh are the same gesture
 * at the same speed.
 */
const DRIFT = 0.42
const SETTLE = 1.6
const NEAREST = 0.45
const FURTHEST = 1.9

/** What the stage needs to draw one person. Shaped like `avatar_of`'s answer. */
export type AvatarLook = {
  body: Record<string, string> | null
  pieces: {
    slot: string
    /**
     * Which item this is. A socket may hold several now, so "the hat" is no
     * longer a name for one thing, and anything keeping something per worn
     * piece - a signed address, a React key - keys on this.
     */
    itemId?: string | null
    kind: string
    name?: string | null
    /** Addresses, already resolved: this draws, it does not decide access. */
    imageUrl?: string | null
    meshUrl?: string | null
    meshFormat?: string | null
    textureUrl?: string | null
    /** How its maker placed it, applied on top of the automatic fit. */
    fit?: WornFit | null
  }[]
}

/** Which engine slot each wearable kind hangs from. */
/* `SOCKET_FOR` in the engine. One mapping, not one per renderer. */

export function AvatarStage({
  look, avatarUrl = '/k6/k6.glb', portrait, turning = true, handled,
  className,
}: {
  look: AvatarLook | null
  avatarUrl?: string
  /** Framed on the head, for a profile picture. */
  portrait?: boolean
  /** Slowly turning, which an editor wants and a thumbnail does not. */
  turning?: boolean
  /**
   * Draggable, like a mesh: turn it, tilt it, wheel to come closer. The
   * editor wants this; a card showing somebody in a list does not, because
   * there a drag is the list being scrolled.
   */
  handled?: boolean
  className?: string
}) {
  const holder = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const mount = holder.current
    if (!mount) return

    /*
     * The trap this project keeps falling into: everything below runs across
     * several awaits, and by the time they finish the person being drawn may
     * have changed. Every step past an await asks whether this pass is still
     * the one wanted rather than trusting what it captured.
     */
    let wanted = true
    let frame = 0
    let renderer: THREE.WebGLRenderer | null = null
    let body: K6 | null = null
    let undress: (() => void) | null = null

    void (async () => {
      try {
        const source = await loadK6Source(avatarUrl)
        if (!wanted) return
        body = new K6(source)

        /*
         * Dressed by the engine. This was the second of three copies of
         * the same loop — the Launcher had written a third — and the two
         * here had already drifted apart, which is how a portrait came out
         * with somebody's hat missing. `alive` is the same `wanted` this
         * pass has always checked, handed over so the engine can check it
         * after each await rather than this file checking it afterwards.
         */
        undress = await dressFrom(body, look ?? { body: null, pieces: [] }, () => wanted)

        if (!wanted) return

        const scene = new THREE.Scene()
        scene.add(body.object)
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8d95a6, 2.0))
        const sun = new THREE.DirectionalLight(0xffffff, 2.4)
        sun.position.set(6, 12, 9)
        scene.add(sun)

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setClearColor(0x000000, 0)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        mount.appendChild(renderer.domElement)
        renderer.domElement.className = 'h-full w-full'

        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200)

        /*
         * The camera turns around the body rather than the body turning
         * under a fixed camera. Both look the same standing still and they
         * are not the same thing: the body's own rotation is what a hat on
         * its back is drawn relative to, and spinning that would spin the
         * light with it.
         */
        const turn = { yaw: 0, pitch: 0.06, closeness: 1 }
        let held = false
        let lastTouched = -Infinity
        let last = { x: 0, y: 0 }

        const place = () => {
          if (portrait) {
            const shot = headshot()
            camera.fov = shot.fov
            camera.position.copy(shot.position)
            camera.lookAt(shot.middle)
            camera.updateProjectionMatrix()
            return
          }
          const whole = new THREE.Box3().setFromObject(body!.object)
          const middle = whole.getCenter(new THREE.Vector3())

          /*
           * Framed on the body's own height and width, not on the sphere
           * around it.
           *
           * The sphere's radius is half the *diagonal* of a standing figure,
           * which for K6 is about a third more than its height - so the
           * camera sat a third too far back and somebody in a tall frame was
           * a small person in a big empty room. Staw: "the avatar itself
           * bigger cuz its too small compared to all the space it has".
           *
           * Both directions are asked and the further answer wins, because
           * a frame narrower than it is tall runs out of width first and the
           * height alone would crop the arms off.
           */
          const size = whole.getSize(new THREE.Vector3())
          const half = Math.tan((camera.fov * Math.PI) / 360)
          // The widest the body can read as from any angle it can be turned
          // to, so turning it does not walk it out of the frame.
          const across = Math.max(size.x, size.z)
          const away = Math.max(
            (size.y / 2) / half,
            (across / 2) / (half * camera.aspect),
            // The margin is not decoration: the camera sits a little above
            // the middle and looks down, which puts the top of the head
            // further from the lens than the middle is. At 1.06 it was
            // sawing the head off.
          ) * 1.18 * turn.closeness
          const flat = Math.cos(turn.pitch) * away
          camera.position.set(
            middle.x + Math.sin(turn.yaw) * flat,
            middle.y + Math.sin(turn.pitch) * away,
            middle.z + Math.cos(turn.yaw) * flat,
          )
          camera.lookAt(middle)
          camera.updateProjectionMatrix()
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
          // Short of the poles, where a body spins around a point rather
          // than turning and reads as broken.
          turn.pitch = Math.max(-1.1, Math.min(1.1,
            turn.pitch + (e.clientY - last.y) * 0.01))
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
          turn.closeness = Math.max(NEAREST, Math.min(FURTHEST,
            turn.closeness * (1 + Math.sign(e.deltaY) * 0.12)))
        }

        if (handled && !portrait) {
          mount.addEventListener('pointerdown', grab)
          mount.addEventListener('pointermove', drag)
          mount.addEventListener('pointerup', drop)
          mount.addEventListener('pointercancel', drop)
          mount.addEventListener('wheel', roll, { passive: false })
          renderer.domElement.className = 'h-full w-full cursor-grab active:cursor-grabbing'
        }

        const fit = () => {
          const w = mount.clientWidth || 1
          const h = mount.clientHeight || 1
          renderer?.setSize(w, h, false)
          camera.aspect = w / h
          place()
        }
        fit()
        const watcher = new ResizeObserver(fit)
        watcher.observe(mount)

        let then = performance.now()
        const tick = (now: number) => {
          frame = requestAnimationFrame(tick)
          const step = Math.min(0.1, (now - then) / 1000)
          then = now
          body?.update(step)
          /*
           * Still while it is being handled, and for a moment afterwards -
           * the same settle a mesh has. A model that starts turning the
           * instant you let go takes the angle you just chose away from you.
           */
          const resting = !held && now - lastTouched > SETTLE * 1000
          if (turning && !portrait && (!handled || resting)) {
            turn.yaw += (handled ? DRIFT : 0.35) * step
          }
          if (!portrait) place()
          renderer?.render(scene, camera)
        }
        frame = requestAnimationFrame(tick)

        return () => watcher.disconnect()
      } catch {
        if (wanted) setFailed(true)
      }
    })()

    return () => {
      wanted = false
      cancelAnimationFrame(frame)
      mount.replaceChildren()
      undress?.()
      body?.dispose()
      renderer?.dispose()
      renderer?.domElement.remove()
    }
  }, [look, avatarUrl, portrait, turning, handled])

  return (
    <div
      ref={holder}
      className={cn(
        'relative grid aspect-square w-full place-items-center',
        handled && !portrait && 'touch-none select-none',
        className,
      )}
    >
      {failed && (
        <FontAwesomeIcon icon={faUser} className="text-3xl text-white/25" />
      )}
    </div>
  )
}
