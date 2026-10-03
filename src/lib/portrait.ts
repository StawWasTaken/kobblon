/*
 * The picture of somebody, taken from their avatar.
 *
 * Staw: a profile picture is a shot centred on the head, from the front. So
 * it is not something anybody uploads - it is what their avatar looks like,
 * taken again whenever the avatar changes.
 *
 * Drawn in the browser, like every other picture on this site, for the same
 * reason: the browser already has everything needed to look at the thing, so
 * it looks at it once and keeps the picture. No server renders avatars.
 *
 * It uses the engine's own `headshot` for the camera, so the crop here and
 * the crop in the editor are the same crop. Two ideas of where somebody's
 * face is would be two different people.
 */
import * as THREE from 'three'
import {
  K6, loadK6Source, headshot, loadMesh, releaseMesh, wearTexture, formatOf,
  frameMesh, lightForLooking, lookFrom,
  type K6Part, type K6Point,
} from '@/engine'

/** What a portrait is drawn at. Square, because every frame it goes in is. */
const SIDE = 512

/** Which engine socket each worn kind hangs from. Mirrors `AvatarStage`. */
const SOCKETS: Record<string, K6Point> = {
  hat: 'hat', hair: 'hat', face: 'face', neck: 'neck',
  back: 'back', front: 'front', waist: 'waist',
  leftHand: 'leftHand', rightHand: 'rightHand',
}

export type PortraitLook = {
  body: Record<string, string> | null
  pieces: {
    slot: string
    imageUrl?: string | null
    meshUrl?: string | null
    textureUrl?: string | null
  }[]
}

/**
 * Draws somebody's head and shoulders.
 *
 * Transparent, like every other card: a portrait goes on a dark page, a
 * light card and a chat line, and a shape on nothing works on all three
 * where a painted square works on one.
 *
 * Everything it builds, it frees. A renderer left alive holds a WebGL
 * context and a browser gives out a handful; taking five portraits in a
 * session and leaking each one is a page that quietly stops drawing.
 */
export async function drawPortrait(
  look: PortraitLook,
  avatarUrl = '/k6/k6.glb',
  /*
   * How much of the person is in the picture.
   *
   * 'head' is the profile picture. 'body' is the whole figure, which is
   * what a card for a shirt wants - a shirt photographed as a headshot is a
   * picture of a head with a collar in it, which is what the first version
   * of this produced and it was useless on sight.
   */
  frame: 'head' | 'body' = 'head',
): Promise<Blob | null> {
  let renderer: THREE.WebGLRenderer | null = null
  let body: K6 | null = null
  const borrowed: THREE.Object3D[] = []
  const textures: THREE.Texture[] = []

  try {
    body = new K6(await loadK6Source(avatarUrl))
    if (look.body) body.paint(look.body as Partial<Record<K6Part, string>>)

    for (const piece of look.pieces) {
      if (piece.imageUrl) {
        const picture = await new THREE.TextureLoader()
          .loadAsync(piece.imageUrl).catch(() => null)
        if (!picture) continue
        textures.push(picture)
        if (piece.slot === 'shirt' || piece.slot === 'trousers') {
          body.dress(piece.slot, picture)
        } else if (piece.slot === 'face') {
          body.setFace(picture)
        } else if (piece.slot === 'tdecal') {
          body.stick(picture)
        }
        continue
      }

      const socket = SOCKETS[piece.slot]
      if (!piece.meshUrl || !socket) continue
      const model = await loadMesh(piece.meshUrl, formatOf(piece.meshUrl)).catch(() => null)
      if (!model) continue
      borrowed.push(model)

      if (piece.textureUrl) {
        const skin = await new THREE.TextureLoader()
          .loadAsync(piece.textureUrl).catch(() => null)
        if (skin) {
          textures.push(skin)
          wearTexture(model, skin, formatOf(piece.meshUrl))
        }
      }

      const box = new THREE.Box3().setFromObject(model)
      const widest = Math.max(...box.getSize(new THREE.Vector3()).toArray())
      if (widest > 0) model.scale.multiplyScalar(3.2 / widest)
      body.wear(socket, model)
    }

    const scene = new THREE.Scene()
    scene.add(body.object)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8d95a6, 2.0))
    const sun = new THREE.DirectionalLight(0xffffff, 2.4)
    sun.position.set(4, 10, 8)
    scene.add(sun)

    const canvas = document.createElement('canvas')
    canvas.width = SIDE
    canvas.height = SIDE
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setSize(SIDE, SIDE, false)

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200)
    if (frame === 'head') {
      const shot = headshot()
      camera.fov = shot.fov
      camera.position.copy(shot.position)
      camera.lookAt(shot.middle)
    } else {
      const whole = new THREE.Box3().setFromObject(body.object)
      const middle = whole.getCenter(new THREE.Vector3())
      const reach = whole.getBoundingSphere(new THREE.Sphere()).radius
      const away = (reach * 1.12) / Math.sin((camera.fov * Math.PI) / 360)
      camera.position.set(middle.x, middle.y + away * 0.05, middle.z + away)
      camera.lookAt(middle)
    }
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)

    return await new Promise<Blob | null>((done) => {
      canvas.toBlob(done, 'image/webp', 0.9)
    })
  } catch {
    return null
  } finally {
    for (const one of borrowed) releaseMesh(one)
    for (const one of textures) one.dispose()
    body?.dispose()
    renderer?.dispose()
  }
}

/**
 * A card for something you wear, drawn the way it will be seen.
 *
 * Staw's rule, and the reason this exists at all: **clothes go on a body.**
 * A shirt laid out flat is its template - a cross of panels - and nobody
 * looking at that can tell what the shirt is. An accessory is a model and is
 * shown as the model. A face is already a picture of itself and needs
 * nothing drawn.
 *
 * The body it goes on is bare and grey on purpose: a shirt photographed on
 * somebody's own avatar would be a card that changes when they change their
 * skin colour, and two shirts would be unreadable side by side.
 */
export async function drawItemCard(item: {
  kind: string
  slot: string
  imageUrl?: string | null
  meshUrl?: string | null
  textureUrl?: string | null
}, avatarUrl = '/k6/k6.glb'): Promise<Blob | null> {
  // A face is its own card. Drawing a body to show one would hide it.
  if (item.kind === 'face') return null

  const plain = {
    Head: '#c9cedb', Torso: '#aab0c2', LeftArm: '#c9cedb',
    RightArm: '#c9cedb', LeftLeg: '#8d95a6', RightLeg: '#8d95a6',
  }

  /*
   * Clothes on the body, everything else on its own. An accessory worn by a
   * grey mannequin is a picture of a mannequin: the hat is a tenth of it,
   * and twenty of those in a grid are twenty identical grey people.
   */
  const onBody = item.kind === 'shirt' || item.kind === 'trousers' || item.kind === 'tdecal'

  if (onBody) {
    return drawPortrait(
      { body: plain, pieces: [{ slot: item.slot, imageUrl: item.imageUrl }] },
      avatarUrl,
      'body',
    )
  }

  if (!item.meshUrl) return null
  return drawModelCard(item.meshUrl, item.textureUrl ?? null)
}

/** A model on nothing, framed to fill the card. */
async function drawModelCard(meshUrl: string, textureUrl: string | null): Promise<Blob | null> {
  let renderer: THREE.WebGLRenderer | null = null
  let model: THREE.Object3D | null = null
  const textures: THREE.Texture[] = []
  try {
    model = await loadMesh(meshUrl, formatOf(meshUrl))
    if (textureUrl) {
      const skin = await new THREE.TextureLoader().loadAsync(textureUrl).catch(() => null)
      if (skin) {
        textures.push(skin)
        wearTexture(model, skin, formatOf(meshUrl))
      }
    }

    const scene = new THREE.Scene()
    scene.add(model)
    lightForLooking(scene)

    const canvas = document.createElement('canvas')
    canvas.width = SIDE
    canvas.height = SIDE
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setSize(SIDE, SIDE, false)

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200)
    const { middle, away } = frameMesh(model, camera)
    camera.position.copy(lookFrom(middle, away))
    camera.lookAt(middle)
    renderer.render(scene, camera)

    return await new Promise<Blob | null>((done) => {
      canvas.toBlob(done, 'image/webp', 0.9)
    })
  } catch {
    return null
  } finally {
    if (model) releaseMesh(model)
    for (const one of textures) one.dispose()
    renderer?.dispose()
  }
}
