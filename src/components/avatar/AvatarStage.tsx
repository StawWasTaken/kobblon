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
  K6, loadK6Source, headshot, loadMesh, releaseMesh, wearTexture, formatOf,
  type K6Point, type K6Part,
} from '@/engine'
import { cn } from '@/lib/cn'

/** What the stage needs to draw one person. Shaped like `avatar_of`'s answer. */
export type AvatarLook = {
  body: Record<string, string> | null
  pieces: {
    slot: string
    kind: string
    name?: string | null
    /** Addresses, already resolved: this draws, it does not decide access. */
    imageUrl?: string | null
    meshUrl?: string | null
    meshFormat?: string | null
    textureUrl?: string | null
  }[]
}

/** Which engine slot each wearable kind hangs from. */
const SOCKETS: Record<string, K6Point> = {
  hat: 'hat', hair: 'hat', face: 'face', neck: 'neck',
  back: 'back', front: 'front', waist: 'waist',
  leftHand: 'leftHand', rightHand: 'rightHand',
}

export function AvatarStage({
  look, avatarUrl = '/k6/k6.glb', portrait, turning = true, className,
}: {
  look: AvatarLook | null
  avatarUrl?: string
  /** Framed on the head, for a profile picture. */
  portrait?: boolean
  /** Slowly turning, which an editor wants and a thumbnail does not. */
  turning?: boolean
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
    const borrowed: THREE.Object3D[] = []
    const textures: THREE.Texture[] = []

    void (async () => {
      try {
        const source = await loadK6Source(avatarUrl)
        if (!wanted) return
        body = new K6(source)

        if (look?.body) body.paint(look.body as Partial<Record<K6Part, string>>)

        for (const piece of look?.pieces ?? []) {
          if (!wanted) return

          // A picture: clothing laid on by the template, or a face.
          if (piece.imageUrl) {
            const picture = await new THREE.TextureLoader()
              .loadAsync(piece.imageUrl).catch(() => null)
            if (!wanted) { picture?.dispose(); return }
            if (!picture) continue
            textures.push(picture)

            if (piece.slot === 'shirt' || piece.slot === 'trousers') {
              body.dress(piece.slot, picture)
            } else if (piece.slot === 'face') {
              body.setFace(picture)
            } else if (piece.slot === 'tdecal') {
              // Straight onto the torso, over whatever clothing is there.
              body.stick(picture)
            }
            continue
          }

          // A model: an accessory or hair, hung off a socket.
          const socket = SOCKETS[piece.slot]
          if (!piece.meshUrl || !socket) continue
          const model = await loadMesh(
            piece.meshUrl,
            (piece.meshFormat as 'obj' | 'gltf' | undefined) ?? formatOf(piece.meshUrl),
          ).catch(() => null)
          if (!wanted) { if (model) releaseMesh(model); return }
          if (!model) continue
          borrowed.push(model)

          if (piece.textureUrl) {
            const skin = await new THREE.TextureLoader()
              .loadAsync(piece.textureUrl).catch(() => null)
            if (!wanted) { skin?.dispose(); return }
            if (skin) {
              textures.push(skin)
              wearTexture(model, skin, formatOf(piece.meshUrl))
            }
          }

          /*
           * Scaled to a sensible size for the slot it is going in. A model
           * is uploaded at whatever size its maker worked at, and a hat
           * modelled in metres is a hat the size of a building; the body is
           * ten stons tall and nothing worn on it is bigger than the part it
           * sits on.
           */
          const box = new THREE.Box3().setFromObject(model)
          const widest = Math.max(...box.getSize(new THREE.Vector3()).toArray())
          if (widest > 0) model.scale.multiplyScalar(3.2 / widest)
          body.wear(socket, model)
        }

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

        const place = () => {
          if (portrait) {
            const shot = headshot()
            camera.fov = shot.fov
            camera.position.copy(shot.position)
            camera.lookAt(shot.middle)
          } else {
            const whole = new THREE.Box3().setFromObject(body!.object)
            const middle = whole.getCenter(new THREE.Vector3())
            const reach = whole.getBoundingSphere(new THREE.Sphere()).radius
            const away = (reach * 1.15) / Math.sin((camera.fov * Math.PI) / 360)
            camera.position.set(middle.x, middle.y + away * 0.06, middle.z + away)
            camera.lookAt(middle)
          }
          camera.updateProjectionMatrix()
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
          if (turning && !portrait) body!.object.rotation.y += step * 0.35
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
      for (const one of borrowed) releaseMesh(one)
      for (const one of textures) one.dispose()
      body?.dispose()
      renderer?.dispose()
      renderer?.domElement.remove()
    }
  }, [look, avatarUrl, portrait, turning])

  return (
    <div
      ref={holder}
      className={cn('relative grid aspect-square w-full place-items-center', className)}
    >
      {failed && (
        <FontAwesomeIcon icon={faUser} className="text-3xl text-white/25" />
      )}
    </div>
  )
}
