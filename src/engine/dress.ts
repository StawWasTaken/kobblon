import * as THREE from 'three'
import { K6, fitToSocket, SOCKET_FOR, type K6Part, type K6Point, type WornFit } from './k6'
import { loadMesh, releaseMesh, wearTexture, formatOf } from './meshes'

/**
 * Putting somebody's avatar on a body.
 *
 * This is the loop that had been written three times — twice on the
 * website (`AvatarStage` and `portrait.ts`) and once in the Launcher — and
 * the copies had already drifted: one forgot the real mesh format and the
 * maker's placement, so a profile picture came out with the accessory
 * missing or sitting in the wrong place, and Staw said what that looks
 * like from outside: "the picture is made from zero, not from the avatar."
 *
 * So it lives here, next to `K6`, and everything that dresses somebody
 * asks the engine. It is the arrangement the rest of the shared code
 * already uses: one side builds the thing, the other side uses it.
 */

/**
 * What somebody is wearing, in the shape the website's queries already
 * hand back.
 *
 * Every field beyond the first three is for whoever is *listing* what
 * somebody has on — a name, a price, a card — and none of it is read here.
 * It is carried because the alternative is a second type that is this one
 * minus six fields, and then a mapping between them that somebody has to
 * keep in step.
 */
export type WornLook = {
  body: Record<string, string> | null
  pieces: {
    slot: string
    point?: K6Point | null
    itemId?: string | null
    kind?: string | null
    name?: string | null
    contentId?: number | null
    cardUrl?: string | null
    price?: number | null
    imageUrl?: string | null
    meshUrl?: string | null
    /**
     * The real format, where the caller has the filename.
     *
     * Not optional in spirit: a signed address hides the extension behind
     * a query string, and sniffing one calls every OBJ a glTF — which
     * flips its texture upside down and was half of why a portrait did not
     * match the avatar beside it.
     */
    meshFormat?: string | null
    textureUrl?: string | null
    /** Where its maker placed it. Without this, it is not the same hat. */
    fit?: WornFit | null
  }[]
}

/**
 * Dress a body from a look, and hand back how to undo it.
 *
 * The disposer is the point of the return value: a World closed halfway
 * through loading has to give back the textures and meshes it borrowed,
 * and nothing else can, because nothing else fetched them.
 *
 * `alive` is checked after every await rather than once at the top. That
 * is this repository's oldest bug written as a parameter: a value read
 * before the thing that decides it can change is a value that is right
 * until it matters. Say no and loading stops, and everything already
 * taken is freed on the way out — a half-dressed body is not left holding
 * textures for a World nobody is in.
 */
export async function dressFrom(
  body: K6,
  look: WornLook,
  alive: () => boolean = () => true,
): Promise<() => void> {
  const borrowed: THREE.Object3D[] = []
  const textures: THREE.Texture[] = []

  const undo = () => {
    for (const one of borrowed) releaseMesh(one)
    for (const one of textures) one.dispose()
    borrowed.length = 0
    textures.length = 0
  }

  if (look.body) body.paint(look.body as Partial<Record<K6Part, string>>)

  for (const piece of look.pieces) {
    if (!alive()) { undo(); return () => {} }

    /*
     * A picture is painted on rather than hung off: a shirt, a face and
     * the thing stuck to the torso are all textures on the body itself,
     * and none of them has a socket.
     */
    if (piece.imageUrl) {
      const picture = await new THREE.TextureLoader()
        .loadAsync(piece.imageUrl).catch(() => null)
      if (!alive()) { if (picture) picture.dispose(); undo(); return () => {} }
      if (!picture) continue
      textures.push(picture)
      if (piece.slot === 'shirt' || piece.slot === 'trousers') body.dress(piece.slot, picture)
      else if (piece.slot === 'face') body.setFace(picture)
      else if (piece.slot === 'tdecal') body.stick(picture)
      continue
    }

    const socket = SOCKET_FOR[piece.slot]
    if (!piece.meshUrl || !socket) continue

    const model = await loadMesh(
      piece.meshUrl,
      (piece.meshFormat as 'obj' | 'gltf' | undefined) ?? formatOf(piece.meshUrl),
    ).catch(() => null)
    if (!alive()) { if (model) releaseMesh(model); undo(); return () => {} }
    if (!model) continue
    borrowed.push(model)

    if (piece.textureUrl) {
      const skin = await new THREE.TextureLoader()
        .loadAsync(piece.textureUrl).catch(() => null)
      if (!alive()) { if (skin) skin.dispose(); undo(); return () => {} }
      if (skin) {
        textures.push(skin)
        wearTexture(
          model, skin,
          (piece.meshFormat as 'obj' | 'gltf' | undefined) ?? formatOf(piece.meshUrl),
        )
      }
    }

    // Where its maker put it, not where the measuring put it.
    fitToSocket(model, socket, piece.fit ?? null)
    // Beside, never instead of: somebody wearing two things on their head
    // is wearing two things on their head.
    body.wearAlso(socket, model)
  }

  return undo
}
