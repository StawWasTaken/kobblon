/*
 * The dummy, drawn here and now, for a garment that has no saved card.
 *
 * Staw: the previews for shirts and trousers go on a dummy even in 2D,
 * "cuz then people can steal it and reupload it". A saved card is drawn by
 * whoever made the thing, the first time they open Create - so everything
 * made before cards existed, and anything whose draw failed once, still had
 * its template sheet standing in. That sheet is the garment, at full size,
 * on a public page.
 *
 * So the fallback is not a picture any more, it is a drawing: the same
 * mannequin, the same framing, from the same `drawItemCard` the saved cards
 * come out of. Nothing is uploaded - whoever is looking is usually not the
 * person who made it and has no business writing to their folder.
 */
import { drawItemCard } from './portrait'
import { assetUrl, catalogUrl, mannequinFace } from './api'

/** One drawing per thing, for as long as the tab is open. */
const drawn = new Map<string, Promise<string | null>>()

/*
 * One at a time. Each drawing takes a WebGL context, a browser hands out
 * about sixteen, and a Catalog page is forty cards - all of them asking at
 * once is a grid where the first few draw and the rest come back null.
 */
let queue: Promise<unknown> = Promise.resolve()

function waitTurn<T>(work: () => Promise<T>): Promise<T> {
  const mine = queue.then(work, work)
  queue = mine.catch(() => null)
  return mine
}

export function wornCard(item: {
  id: string
  kind?: string | null
  slot?: string | null
  image_path?: string | null
  image_bucket?: string | null
  /**
   * The sheet, already an address.
   *
   * For a caller that resolved it before this was asked - a profile's
   * `PortraitLook` is the case: it carries `imageUrl` and never carried
   * the path it came from, so the panel beside somebody's avatar had
   * nothing to hand in here and drew a grey shirt instead. Taken only
   * when there is no path.
   */
  imageUrl?: string | null
  /** Which shape in the engine, for a body part. */
  shape?: string | null
  /**
   * The model, for an accessory with no card drawn for it.
   *
   * Staw: "accessories' previews dont load properly either". An accessory
   * is a mesh and nothing else - no sheet, no shape - so this function had
   * nothing to draw from and every one whose maker never opened Create
   * showed the torn mark for ever. A mesh is something to draw from, and
   * the card it comes out as is the same one `drawItemCard` makes.
   */
  mesh_path?: string | null
  texture_path?: string | null
  mesh_format?: string | null
  /**
   * The model as an address, for a caller that signed it already - a
   * profile's worn pieces carry `meshUrl`, the same way they carry
   * `imageUrl` and never carried the paths either came from.
   */
  meshUrl?: string | null
  textureUrl?: string | null
}): Promise<string | null> {
  const had = drawn.get(item.id)
  if (had) return had

  const making = waitTurn(async () => {
    const picture = item.image_path
      ? catalogUrl(item.image_path, item.image_bucket ?? undefined)
      : item.imageUrl ?? null
    /*
     * A garment needs its sheet, a body part needs its shape, an accessory
     * needs its model; none can be drawn without the one thing it is made
     * of, and a thing with none of the three is not a drawing problem.
     */
    if (!picture && !item.shape && !item.mesh_path && !item.meshUrl) return null

    /*
     * Signed only when it is going to be used - one request per card, and
     * only for the cards that have nothing else to be drawn from.
     */
    const needsModel = !picture && !item.shape
    const mesh = !needsModel
      ? null
      : item.meshUrl ?? (item.mesh_path
        ? await assetUrl(item.mesh_path).catch(() => null)
        : null)
    const skin = !mesh
      ? null
      : item.textureUrl ?? (item.texture_path
        ? await assetUrl(item.texture_path).catch(() => null)
        : null)
    if (!picture && !item.shape && !mesh) return null

    const blob = await drawItemCard({
      kind: item.kind ?? 'shirt',
      slot: item.slot ?? item.kind ?? 'shirt',
      imageUrl: picture,
      shape: item.shape ?? null,
      meshUrl: mesh,
      textureUrl: skin,
      meshFormat: item.mesh_format ?? null,
      faceUrl: await mannequinFace().catch(() => null),
    }).catch(() => null)

    return blob ? URL.createObjectURL(blob) : null
  })

  drawn.set(item.id, making)
  return making
}

/** Forgets one, for the maker who has just changed the texture under it. */
export function forgetWornCard(id: string) {
  const had = drawn.get(id)
  drawn.delete(id)
  void had?.then((url) => { if (url) URL.revokeObjectURL(url) }).catch(() => null)
}
