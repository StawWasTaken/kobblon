import * as THREE from 'three'

/**
 * Loading a face so the head behind it still shows.
 *
 * Staw, with a picture of it: "for the faces, can we make sure we dont see
 * some white stuff around them, cuz the way the images are applied it shows
 * the white stuff around the faces". Two different things make that white
 * box, and only fixing both makes it go away:
 *
 * - **A face file with no transparency at all.** Plenty of the catalog's
 *   faces are drawn on white and saved flat, and a flat white picture laid
 *   on a head is a white rectangle on a head. Nothing in the material can
 *   help: the pixels really are white. So the background is keyed out here,
 *   from the colour the corners agree on.
 * - **A face file that does have transparency, filtered.** A face is drawn
 *   at a few hundred pixels and lands on a head a couple of hundred across,
 *   so every edge pixel is a blend of its neighbours - and with straight
 *   alpha, the neighbours of a drawn edge are white pixels that happen to be
 *   invisible. The blend keeps their white and averages their alpha, which
 *   is the pale halo round every mouth. Premultiplying before upload is the
 *   fix for that one, and it only works if the material blends the same way;
 *   see `setFace`.
 *
 * Keying is deliberately conservative. It runs only when the file is opaque
 * everywhere - a face its author already cut out is their work and is left
 * alone - and only against a background the four corners agree on, so a face
 * drawn edge to edge is left alone too. A drawing that reaches a corner
 * disagrees with the other three and nothing is keyed.
 */

/** How close to the background a pixel must be to vanish, in 0-255 per channel. */
const GONE = 12
/** And how far out the fade runs, so a smoothed edge does not keep its matte. */
const FADE = 70

/** The corners have to agree within this for there to be a background at all. */
const AGREE = 10

type Pixels = { data: Uint8ClampedArray; width: number; height: number }

/** The four corners, as offsets into the pixel array. */
const cornersOf = ({ width, height }: Pixels) => [
  0,
  (width - 1) * 4,
  (height - 1) * width * 4,
  ((height - 1) * width + width - 1) * 4,
]

/** The colour the corners agree on, or null if they do not agree. */
function backgroundOf(pixels: Pixels): [number, number, number] | null {
  const { data } = pixels
  const at = cornersOf(pixels)
  const first = at[0]
  for (const one of at) {
    if (data[one + 3] < 250) return null
    for (let c = 0; c < 3; c++) {
      if (Math.abs(data[one + c] - data[first + c]) > AGREE) return null
    }
  }
  return [data[first], data[first + 1], data[first + 2]]
}

/** Whether every pixel is opaque, which is what says the file was never cut out. */
function allOpaque({ data }: Pixels) {
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return false
  return true
}

/**
 * Cuts the background out, with a fade rather than a cliff.
 *
 * The fade is the point. A hard test leaves the drawing's own smoothed edge
 * standing at full strength with the matte colour still in it, which is the
 * same halo in a thinner ring. Fading alpha across the distance to the
 * background means a pixel that is nine tenths matte ends up nine tenths
 * gone.
 */
function key(pixels: Pixels, background: [number, number, number]) {
  const { data } = pixels
  for (let i = 0; i < data.length; i += 4) {
    const far = Math.max(
      Math.abs(data[i] - background[0]),
      Math.abs(data[i + 1] - background[1]),
      Math.abs(data[i + 2] - background[2]),
    )
    if (far <= GONE) data[i + 3] = 0
    else if (far < FADE) data[i + 3] = Math.round(255 * ((far - GONE) / (FADE - GONE)))
  }
}

/**
 * A face, as a texture with no matte around it.
 *
 * Falls back to the picture as it came whenever the canvas cannot be read -
 * no DOM, or an image served without the header that lets us read it back.
 * A face with its old white box is a great deal better than no face, and
 * this is exactly the sort of thing that must not take a head off in the
 * Workspace.
 */
export async function loadFacePicture(url: string): Promise<THREE.Texture | null> {
  const picture = await drawn(url).catch(() => null)
  if (picture) return picture

  const plain = await new THREE.TextureLoader().loadAsync(url).catch(() => null)
  if (plain) plain.premultiplyAlpha = true
  return plain
}

async function drawn(url: string): Promise<THREE.Texture | null> {
  if (typeof document === 'undefined') return null

  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = url
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const pen = canvas.getContext('2d', { willReadFrequently: false })
  if (!pen || !canvas.width || !canvas.height) return null
  pen.drawImage(image, 0, 0)

  // Throws on a picture served without the header that allows reading it
  // back, which is why the caller has a plain loader behind it.
  const got = pen.getImageData(0, 0, canvas.width, canvas.height)
  const pixels: Pixels = { data: got.data, width: canvas.width, height: canvas.height }

  if (allOpaque(pixels)) {
    const background = backgroundOf(pixels)
    if (background) {
      key(pixels, background)
      pen.putImageData(got, 0, 0)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  // So the edge the filter invents is a blend of what is drawn, not of the
  // invisible pixels beside it. Read with the material's own
  // `premultipliedAlpha`; one without the other is the halo again.
  texture.premultiplyAlpha = true
  texture.needsUpdate = true
  return texture
}
