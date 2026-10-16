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
import { catalogUrl, mannequinFace } from './api'

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
}): Promise<string | null> {
  const had = drawn.get(item.id)
  if (had) return had

  const making = waitTurn(async () => {
    const picture = item.image_path
      ? catalogUrl(item.image_path, item.image_bucket ?? undefined)
      : null
    if (!picture) return null

    const blob = await drawItemCard({
      kind: item.kind ?? 'shirt',
      slot: item.slot ?? item.kind ?? 'shirt',
      imageUrl: picture,
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
