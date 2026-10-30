import * as THREE from 'three'
import { K6, fitToSocket, SOCKET_FOR, type K6Part, type K6Point, type WornFit } from './k6'
import { loadMesh, releaseMesh, wearTexture, formatOf } from './meshes'
import { PART_FOR_SLOT, type WornShapes } from './bodyshapes'
import { loadFacePicture } from './facepicture'

/**
 * Putting somebody's avatar on a body.
 *
 * This is the loop that had been written three times - twice on the
 * website (`AvatarStage` and `portrait.ts`) and once in the Launcher - and
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
 * somebody has on - a name, a price, a card - and none of it is read here.
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
    /**
     * When it stopped or stops selling, so a page can say it was a
     * limited. Carried rather than looked up: the engine draws, it does
     * not decide what anything is.
     */
    sellsUntil?: string | null
    imageUrl?: string | null
    meshUrl?: string | null
    /**
     * The real format, where the caller has the filename.
     *
     * Not optional in spirit: a signed address hides the extension behind
     * a query string, and sniffing one calls every OBJ a glTF - which
     * flips its texture upside down and was half of why a portrait did not
     * match the avatar beside it.
     */
    meshFormat?: string | null
    textureUrl?: string | null
    /** Where its maker placed it. Without this, it is not the same hat. */
    fit?: WornFit | null
    /**
     * Which shape in the engine, for a body part.
     *
     * Not a thing hung off the body and not a picture painted on it: it
     * replaces the geometry of the part it is worn on, so it is applied
     * before anything else, because clothing is measured against the shape
     * it is laid over.
     */
    shape?: string | null
  }[]
}

/**
 * The slots that are a picture on the body rather than a model hung off it.
 *
 * Written down once, here, because the alternative was reading it off the
 * row - and the row cannot tell them apart.
 */
const PAINTED_ON = new Set(['shirt', 'trousers', 'face', 'tdecal'])

/**
 * Something in the look that did not make it onto the body.
 *
 * `passing` is the part that matters to a caller deciding whether to keep
 * the picture. A file that did not arrive, or an address that was never
 * signed, is a failure that a later attempt may not have - so a portrait
 * drawn through one is not the person and must not be saved. A piece with
 * no picture at all, or a slot nothing hangs from, is the shape of the
 * data: drawing it again changes nothing, and refusing to save would mean
 * never saving that person's face again.
 */
export type Missing = {
  piece: WornLook['pieces'][number]
  why: string
  passing: boolean
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
 * taken is freed on the way out - a half-dressed body is not left holding
 * textures for a World nobody is in.
 */
export async function dressFrom(
  body: K6,
  look: WornLook,
  alive: () => boolean = () => true,
  /*
   * Told about anything it could not put on.
   *
   * Every failure in here is a `continue`, and that is right for a stage -
   * a hat whose file did not arrive should not take the rest of the person
   * down with it. It is wrong for anything that **keeps** the result: a
   * profile picture saved while the hair was still failing to load is a
   * hairless face stored as current, and nothing ever asks again. Staw saw
   * exactly that: "I SAW PEOPLE WEARING HAIR AND ON THEIR AVATAR WE SEE
   * EVERYTHING BUT ON THEIR PFP WE DONT SEE THEIR HAIR".
   *
   * So the skipping stays and it is no longer silent. A caller that is
   * drawing to look at it ignores this; a caller that is drawing to save
   * it refuses to save when anything comes through here.
   */
  onMissing?: (miss: Missing) => void,
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

  /*
   * The body's own shape first, in one call, before a stitch of clothing.
   *
   * Both halves matter. First, because `setShape` rebuilds the part and
   * re-wraps whatever is on it - a shirt dressed before the torso changed
   * would be laid out against a torso that no longer exists, which is this
   * repository's oldest bug wearing a skirt. And in one call, because six
   * parts changed one at a time is six rebuilds and five of them are thrown
   * away.
   */
  const shapes: WornShapes = {}
  for (const piece of look.pieces) {
    const part = PART_FOR_SLOT[piece.slot]
    if (piece.kind === 'bodypart' && piece.shape && part) shapes[part] = piece.shape
  }
  /*
   * Always, rather than only when there is one: `setShapes` names every part
   * and `setShape` does nothing where the shape has not changed, so this is
   * also how a part that was taken off goes back to the plain block. Guarded
   * on "is there a shape in this look" it would not - the body would keep
   * the last one it was given, which on a reused rig is somebody else's.
   */
  body.setShapes(shapes)

  for (const piece of look.pieces) {
    if (!alive()) { undo(); return () => {} }

    /*
     * A picture is painted on rather than hung off: a shirt, a face and
     * the thing stuck to the torso are all textures on the body itself,
     * and none of them has a socket.
     *
     * Which of the two a piece is was decided by **whether it had a
     * picture**, and that is what stopped haircuts appearing - reported on
     * Discord as "why doesn't my hair show". Every catalog item has a
     * picture: it is the thumbnail on its card. So a haircut came in here,
     * matched none of the three painted-on slots, hit the `continue` at the
     * bottom of this branch, and its model was never loaded at all. It was
     * worn, it was in the look, and nothing drew it. Hats, accessories and
     * everything else on a socket were one thumbnail away from the same
     * fate.
     *
     * The slot says which kind of thing it is. The thumbnail never did.
     */
    if (PAINTED_ON.has(piece.slot)) {
      if (!piece.imageUrl) { onMissing?.({ piece, why: 'it has no picture', passing: false }); continue }
      /*
       * A face goes through its own loader, which takes the matte off a
       * face that was saved flat on white. A shirt does not: a shirt's
       * white is the shirt.
       */
      const picture = piece.slot === 'face'
        ? await loadFacePicture(piece.imageUrl)
        : await new THREE.TextureLoader().loadAsync(piece.imageUrl).catch(() => null)
      if (!alive()) { if (picture) picture.dispose(); undo(); return () => {} }
      if (!picture) { onMissing?.({ piece, why: 'its picture did not load', passing: true }); continue }
      textures.push(picture)
      if (piece.slot === 'shirt' || piece.slot === 'trousers') body.dress(piece.slot, picture)
      else if (piece.slot === 'face') body.setFace(picture)
      else if (piece.slot === 'tdecal') body.stick(picture)
      continue
    }

    const socket = SOCKET_FOR[piece.slot]
    if (!socket) { onMissing?.({ piece, why: `nothing hangs from ${piece.slot}`, passing: false }); continue }
    if (!piece.meshUrl) { onMissing?.({ piece, why: 'its model has no address', passing: true }); continue }

    const model = await loadMesh(
      piece.meshUrl,
      (piece.meshFormat as 'obj' | 'gltf' | undefined) ?? formatOf(piece.meshUrl),
    ).catch(() => null)
    if (!alive()) { if (model) releaseMesh(model); undo(); return () => {} }
    if (!model) { onMissing?.({ piece, why: 'its model did not load', passing: true }); continue }
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
