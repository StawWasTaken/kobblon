/*
 * Every picture that goes into a bucket, made small enough to send.
 *
 * Kobblon pays for bytes leaving Supabase, and in the first week of anybody
 * actually using the site we went through five gigabytes of egress with
 * seven people signed in. Nothing was being downloaded in a loop; the files
 * were simply enormous. A profile picture was whatever came out of a phone -
 * four megabytes, four thousand pixels wide - stored exactly as it arrived
 * and then sent, in full, to every card, every list, every chat row that
 * shows a face at thirty-two pixels.
 *
 * Two things fix that and both of them live here.
 *
 * **Shrink before the upload.** The plan has no image transformations, so
 * there is no size to ask for after the fact: the only size that exists is
 * the one that was stored. A face is stored at 512 and a page picture at
 * 1600, as WebP, and that is one to two per cent of what was going up.
 *
 * **Say how long it may be cached.** Supabase defaults to an hour. Every
 * path this project writes is unique - a `crypto.randomUUID()` or a
 * `Date.now()` - so a file at a given address never changes, and an hour
 * means the CDN came back to the origin for the same unchanged face all day.
 * `FOREVER` says what is true: this one is immutable, keep it.
 *
 * What is deliberately **not** shrunk: anything that is the thing itself
 * rather than a picture of it. A mesh, a World file, a clothing texture, a
 * video. Shrinking those would be editing somebody's work.
 */

/** A year, and immutable, because these paths are never written over. */
export const FOREVER = '31536000, immutable'

/** Longest edge, in pixels, by what the picture is for. */
export const BUDGET = {
  /** A face. The largest it is ever drawn is a profile header. */
  face: 512,
  /** An emblem, a badge, a small square thing. */
  emblem: 512,
  /** Anything that runs the width of a page: a cover, a banner, a post. */
  page: 1600,
} as const

const TYPE = 'image/webp'
const QUALITY = 0.82

/** Whether this is a raster picture we may redraw. SVG and video are not. */
function redrawable(file: File) {
  return /^image\/(png|jpeg|jpg|webp|gif|bmp|avif)$/.test(file.type.toLowerCase())
}

function fit(width: number, height: number, longest: number) {
  const scale = Math.min(1, longest / Math.max(width, height))
  return {
    w: Math.max(1, Math.round(width * scale)),
    h: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * A picture, redrawn to fit within `longest` and encoded as WebP.
 *
 * Returns the original file untouched when it is not a raster picture, when
 * the browser will not decode it, or when the redraw came out **bigger** -
 * which happens with small flat PNGs and with art that was already
 * well compressed, and where keeping the original is simply the smaller
 * answer.
 *
 * An animated GIF is left alone too: a canvas can only draw one frame of it,
 * and a still where somebody uploaded an animation is a bug rather than a
 * saving.
 */
export async function shrink(file: File, longest: number = BUDGET.page): Promise<File> {
  if (!redrawable(file)) return file
  if (file.type.toLowerCase() === 'image/gif') return file

  try {
    const source = await createImageBitmap(file)
    const { w, h } = fit(source.width, source.height, longest)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const brush = canvas.getContext('2d')
    if (!brush) {
      source.close()
      return file
    }
    brush.drawImage(source, 0, 0, w, h)
    source.close()

    const drawn = await new Promise<Blob | null>((done) =>
      canvas.toBlob(done, TYPE, QUALITY))
    if (!drawn || drawn.size >= file.size) return file

    const stem = file.name.replace(/\.[^.]+$/, '') || 'picture'
    return new File([drawn], `${stem}.webp`, { type: TYPE })
  } catch {
    // A picture the browser cannot decode is still a picture the bucket may
    // accept, and refusing the upload over a failed saving would be worse
    // than the saving is worth.
    return file
  }
}
