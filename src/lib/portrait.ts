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
import { MANNEQUIN_BODY } from './mannequin'
import {
  K6, loadK6Source, headshot, loadMesh, releaseMesh, wearTexture, formatOf,
  frameMesh, lightForLooking, lookFrom, fitToSocket,
  COVERS, PLACES, BODY, type Clothing,
  type K6Part, type K6Point, type WornFit,
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
    /** Which item this is, so a caller can key on it rather than on the slot. */
    itemId?: string | null
    /** What it is and what it is called, for anything that lists what somebody has on. */
    kind?: string | null
    name?: string | null
    /** Its Catalog number, so a list of what somebody is wearing can link to it. */
    contentId?: number | null
    /** Its card, for a list that shows the things rather than naming them. */
    cardUrl?: string | null
    /** What it sells for today. Null for something with no price of its own. */
    price?: number | null
    imageUrl?: string | null
    meshUrl?: string | null
    /**
     * The real format, where the caller has the filename. A signed address
     * hides the extension behind a query string, and sniffing one calls
     * every OBJ a glTF - which flips its texture upside down.
     */
    meshFormat?: string | null
    textureUrl?: string | null
    /** Where its maker placed it. Without this a portrait is not the avatar. */
    fit?: WornFit | null
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
  /*
   * 'head' is a profile picture, 'body' the whole figure, and a garment
   * name frames the parts that garment covers - Staw's "take the shot
   * centred on the piece of clothing on the mannequin". A shirt
   * photographed from head to toe is a card where the shirt is a third of
   * the picture and the legs are another third, next to nineteen other
   * cards with the same legs in them.
   */
  frame: 'head' | 'body' | Clothing = 'head',
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
      /*
       * The real format, not a guess off a signed address - the same bug
       * twice over, because a signed URL has no extension and every OBJ
       * then goes to the glTF reader and fails. The accessory simply did
       * not appear, which is half of why a portrait did not match the
       * avatar beside it.
       */
      const model = await loadMesh(
        piece.meshUrl,
        (piece.meshFormat as 'obj' | 'gltf' | undefined) ?? formatOf(piece.meshUrl),
      ).catch(() => null)
      if (!model) continue
      borrowed.push(model)

      if (piece.textureUrl) {
        const skin = await new THREE.TextureLoader()
          .loadAsync(piece.textureUrl).catch(() => null)
        if (skin) {
          textures.push(skin)
          wearTexture(
            model, skin,
            (piece.meshFormat as 'obj' | 'gltf' | undefined) ?? formatOf(piece.meshUrl),
          )
        }
      }

      // And where its maker put it. Drawing it where the measuring put it
      // is drawing a different hat from the one on the avatar.
      fitToSocket(model, socket, piece.fit ?? null)
      // Beside, not instead of - the same reason as the stage. A portrait
      // that drops the second hat is a portrait of somebody else.
      body.wearAlso(socket, model)
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
    } else if (frame === 'shirt' || frame === 'trousers') {
      /*
       * Framed on what the garment covers, read from the same table the
       * wrapping reads - so a change to the body's proportions moves the
       * camera with it rather than leaving a crop that was right once.
       */
      const covered = COVERS[frame]
      const top = Math.max(...covered.map((part) => PLACES[part].middle[1] + BODY[part].h / 2))
      const floor = Math.min(...covered.map((part) => PLACES[part].middle[1] - BODY[part].h / 2))
      const wide = Math.max(...covered.map((part) => BODY[part].w)) * 2.6
      const tall = top - floor

      const middle = new THREE.Vector3(0, (top + floor) / 2, 0)
      const reach = Math.max(wide, tall) / 2
      const away = (reach * 1.15) / Math.sin((camera.fov * Math.PI) / 360)
      camera.position.set(middle.x, middle.y, middle.z + away)
      camera.lookAt(middle)
    } else {
      /*
       * The same framing the stage uses, for the same reason: the sphere
       * around a standing figure has a radius half its *diagonal*, about a
       * third more than its height, so framing on it leaves the body a
       * third smaller than the picture it is in. Staw, on the flat one:
       * "when on 2d its still too small".
       *
       * Asked in both directions and the further answer wins. The picture
       * is square, so the aspect is one and the width question is the plain
       * one - written out anyway, because this is the frame that would be
       * wrong first if a portrait ever stops being square.
       */
      const whole = new THREE.Box3().setFromObject(body.object)
      const middle = whole.getCenter(new THREE.Vector3())
      const size = whole.getSize(new THREE.Vector3())
      const half = Math.tan((camera.fov * Math.PI) / 360)
      const across = Math.max(size.x, size.z)
      // 1.18, and the lift is small: the camera looks very slightly down, so
      // the feet are the far corner and 1.1 cut them off.
      const away = Math.max((size.y / 2) / half, (across / 2) / half) * 1.18
      camera.position.set(middle.x, middle.y + away * 0.02, middle.z + away)
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
  meshFormat?: string | null
  textureUrl?: string | null
  /** The mannequin's face. Without it the card is a headless body. */
  faceUrl?: string | null
}, avatarUrl = '/k6/k6.glb'): Promise<Blob | null> {
  // A face is its own card. Drawing a body to show one would hide it.
  if (item.kind === 'face') return null

  // The one mannequin. It was a body of its own here, slightly different
  // from the one the item page drew, so a shirt's card and that shirt on its
  // page were two different people.
  const plain = MANNEQUIN_BODY

  /*
   * Clothes on the body, everything else on its own. An accessory worn by a
   * grey mannequin is a picture of a mannequin: the hat is a tenth of it,
   * and twenty of those in a grid are twenty identical grey people.
   */
  const onBody = item.kind === 'shirt' || item.kind === 'trousers' || item.kind === 'tdecal'

  if (onBody) {
    return drawPortrait(
      {
        body: plain,
        pieces: [
          // The face it always wears, so a card is a person wearing a shirt
          // rather than a headless shape in one. Handed in by whoever is
          // drawing, because this file does not talk to the database.
          { slot: 'face', imageUrl: item.faceUrl ?? null },
          { slot: item.slot, imageUrl: item.imageUrl },
        ],
      },
      avatarUrl,
      // Centred on the garment, except a t-decal, which is the torso's whole
      // front and reads as itself from the front of the body.
      item.kind === 'tdecal' ? 'shirt' : (item.kind as Clothing),
    )
  }

  if (!item.meshUrl) return null
  return drawModelCard(
    item.meshUrl, item.textureUrl ?? null,
    (item.meshFormat as 'obj' | 'gltf' | undefined) ?? formatOf(item.meshUrl),
  )
}

/** A model on nothing, framed to fill the card. */
async function drawModelCard(
  meshUrl: string, textureUrl: string | null,
  format: 'obj' | 'gltf' = formatOf(meshUrl),
): Promise<Blob | null> {
  let renderer: THREE.WebGLRenderer | null = null
  let model: THREE.Object3D | null = null
  const textures: THREE.Texture[] = []
  try {
    model = await loadMesh(meshUrl, format)
    if (textureUrl) {
      const skin = await new THREE.TextureLoader().loadAsync(textureUrl).catch(() => null)
      if (skin) {
        textures.push(skin)
        wearTexture(model, skin, format)
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
