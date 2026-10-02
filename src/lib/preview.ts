/*
 * A small picture of a piece of content, made in the browser.
 *
 * The file itself is not something a browser can link to: the uploads bucket
 * is private on purpose, so a decal cannot be hotlinked and a video cannot be
 * taken by address. That also means nothing outside Kobblon can show what
 * a piece of content looks like, which is why a link pasted into a chat used
 * to be a name and no picture.
 *
 * So the browser draws one at upload: a decal shrunk down, a frame out of a
 * video. It goes in a bucket that is public, because a card has to be
 * fetchable by something with no account, and it is only ever made for
 * content that is listed in Create, which shows the same picture to anybody
 * who opens its page. Nothing about this makes the original file public.
 */
import * as THREE from 'three'
import {
  formatOf, frameMesh, lightForLooking, loadMesh, meshFormats, releaseMesh, wearTexture,
  lookFrom,
} from '@/lib/mesh'
import type { MeshFormat } from '@/lib/mesh'
import type { AssetKind } from '@/types/db'

/** Big enough for a card at full width, small enough to be nothing much. */
const WIDEST = 1280
const QUALITY = 0.82

/*
 * WebP, not JPEG, and the reason is not the file size.
 *
 * **JPEG has no alpha.** A Decal drawn on nothing - which is most of them,
 * every sun, every cut-out, every logo - came out on a black rectangle,
 * because that is what a transparent pixel becomes when the format cannot
 * say "transparent". It was invisible while nothing read these pictures;
 * the moment the cards started being read, every transparent Decal on the
 * site gained a black box.
 *
 * The same for a model: a mesh is a shape with nothing around it, and the
 * nothing has to stay nothing or the card is a white square with a burger
 * in the middle of it, sitting on a dark page.
 *
 * Every browser Kobblon runs on writes WebP, and `canvas.toBlob` falls back
 * to PNG rather than failing if one somehow does not - which is still
 * transparent, which is the part that matters.
 */
export const PREVIEW_TYPE = 'image/webp'
export const PREVIEW_EXTENSION = 'webp'

/**
 * Which generation of card-drawing made a card.
 *
 * A card is drawn once, at upload, and then it is a file sitting in a bucket
 * for ever. So every time the drawing changes - the format gaining
 * transparency, the camera turning round to face the front - everything
 * already drawn keeps the old behaviour, and the fix is invisible on exactly
 * the content somebody is complaining about.
 *
 * The extension answered that once, because the change was the format. It
 * cannot answer "this was taken from the wrong side", since that card is a
 * perfectly good WebP. So the mark goes in the name: a card is current when
 * its path carries this, and anything else is redrawn the next time its
 * owner opens it.
 *
 * **Bump this whenever the drawing changes in a way somebody would notice.**
 * It costs one redraw per item and it is the only thing that makes a fix
 * reach the pictures that already exist.
 */
export const CARD_MARK = 'k2'

/**
 * Whether a stored card was drawn by the drawing that runs today.
 *
 * A declared function rather than an arrow constant so that the checks in
 * `tools/site/types-check.mjs` can read its body out of this file and run
 * the real thing - which matters more here than anywhere, because a check
 * holding its own copy of the mark would keep passing after somebody bumped
 * it and updated only one of the two.
 */
export function cardIsCurrent(path?: string | null): boolean {
  return !!path && path.toLowerCase().includes(`.${CARD_MARK}.`)
}

/**
 * The kinds that look like something. A sound has nothing to draw.
 *
 * A mesh looks like something too, but only once somebody has rendered it,
 * which is what `fromMesh` below is for. Without it a mesh uploaded from a
 * file dialog is a blank tile, because a dialog cannot draw a `.glb`.
 */
export const canPreview = (kind: AssetKind) =>
  kind === 'image' || kind === 'video' || kind === 'mesh'

function fit(width: number, height: number) {
  const scale = Math.min(1, WIDEST / Math.max(width, height))
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) }
}

function draw(source: CanvasImageSource, width: number, height: number): Promise<Blob | null> {
  const { w, h } = fit(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const brush = canvas.getContext('2d')
  if (!brush) return Promise.resolve(null)
  brush.drawImage(source, 0, 0, w, h)
  return new Promise((done) => canvas.toBlob(done, PREVIEW_TYPE, QUALITY))
}

async function fromPicture(src: string) {
  const picture = new Image()
  picture.crossOrigin = 'anonymous'
  picture.src = src
  await picture.decode()
  return draw(picture, picture.naturalWidth, picture.naturalHeight)
}

/*
 * A frame from a quarter of the way in. The very first frame of a video is
 * very often black, a title card or a fade, and a still of nothing tells
 * somebody nothing about what they are being sent.
 */
function fromFilm(src: string) {
  return new Promise<Blob | null>((done) => {
    const film = document.createElement('video')
    film.crossOrigin = 'anonymous'
    film.preload = 'metadata'
    film.muted = true
    film.playsInline = true

    const giveUp = window.setTimeout(() => { film.src = ''; done(null) }, 15_000)
    const finish = (blob: Blob | null) => { window.clearTimeout(giveUp); film.src = ''; done(blob) }

    film.onloadedmetadata = () => {
      film.currentTime = Math.min(
        Number.isFinite(film.duration) ? film.duration * 0.25 : 1,
        3,
      )
    }
    film.onseeked = () => {
      void draw(film, film.videoWidth, film.videoHeight).then(finish)
    }
    film.onerror = () => finish(null)

    film.src = src
  })
}

/**
 * A picture of a model, by rendering it.
 *
 * The same trick as the video frame: the browser already has everything
 * needed to look at the thing, so it looks at it once and keeps the picture.
 * Three quarter view from slightly above, which is how a person picks a
 * model up to look at it, and the camera is pushed back from the model's own
 * bounding sphere so a tall thing and a wide thing both fill the frame.
 *
 * A Build is Kobblon's own part file, which is JSON rather than glTF and has
 * no reader on this side, so it gets no picture rather than a wrong one. A
 * mesh is glTF and is drawn.
 */
async function fromMesh(
  src: string, format: MeshFormat, skin?: string | null,
  angle?: { yaw: number; pitch: number } | null,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 640

  let renderer: THREE.WebGLRenderer | null = null
  let model: THREE.Object3D | null = null
  try {
    model = await loadMesh(src, format)

    /*
     * Wearing its Decal, so the card is a picture of the thing people will
     * actually get. An undressed card beside a dressed viewer reads as two
     * different items, and it is the card that gets seen first - in the
     * Marketplace, in a search, and in a link somebody pastes.
     *
     * A picture that will not load is not a reason to have no card at all,
     * so the model is drawn undressed rather than nothing being drawn.
     */
    if (skin) {
      const picture = await new THREE.TextureLoader().loadAsync(skin).catch(() => null)
      if (picture) wearTexture(model, picture, format)
    }

    /*
     * No background at all. The card sits on whatever page is showing it -
     * dark in the Marketplace, dark in a Toolbox, light in a link preview -
     * and a shape on nothing works on all of them where a painted square
     * works on exactly one.
     */
    const scene = new THREE.Scene()
    scene.add(model)
    lightForLooking(scene)

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    const { middle, away } = frameMesh(model, camera)
    camera.position.copy(lookFrom(middle, away, angle?.yaw, angle?.pitch))
    camera.lookAt(middle)

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setSize(canvas.width, canvas.height, false)
    renderer.render(scene, camera)

    return await new Promise<Blob | null>((done) => {
      canvas.toBlob(done, PREVIEW_TYPE, QUALITY)
    })
  } catch {
    return null
  } finally {
    if (model) releaseMesh(model)
    // A renderer left alive holds a WebGL context, and a browser only allows
    // a handful of those at once: leak them and the fifth upload in a
    // session silently stops drawing anything.
    renderer?.dispose()
  }
}

/** From the file somebody is uploading, before it has gone anywhere. */
export async function previewOf(
  file: File, kind: AssetKind, skin?: string | null,
  angle?: { yaw: number; pitch: number } | null,
): Promise<Blob | null> {
  if (!canPreview(kind)) return null
  // A Kobblon part file is JSON, and nothing here reads one yet.
  if (kind === 'mesh' && !meshFormats.test(file.name)) return null

  const src = URL.createObjectURL(file)
  try {
    // From `file.name`, not from `src`: `src` is a blob address with no
    // name on it, so sniffing it would send every OBJ to the glTF reader.
    if (kind === 'mesh') return await fromMesh(src, formatOf(file.name), skin, angle)
    return kind === 'video' ? await fromFilm(src) : await fromPicture(src)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(src)
  }
}

/** From something already uploaded, for work that predates previews. */
export async function previewOfUrl(
  url: string, kind: AssetKind, skin?: string | null,
  angle?: { yaw: number; pitch: number } | null,
): Promise<Blob | null> {
  if (!canPreview(kind)) return null
  try {
    if (kind === 'mesh') return await fromMesh(url, formatOf(url), skin, angle)
    return kind === 'video' ? await fromFilm(url) : await fromPicture(url)
  } catch {
    return null
  }
}

/**
 * Which of the three places a piece of content's picture should come from.
 *
 * Pulled out of the hook that used to decide it so that it can be checked
 * without a browser, and so the Workspace can ask the same question. The
 * hook turns the answer into an address; this only says which one.
 *
 *   * `direct` is a path in the public `previews` bucket, addressed with
 *     `getPublicUrl`.
 *   * `signed` is a path in the private `uploads` bucket, which has to be
 *     signed for.
 *
 * At most one is ever set. Getting the two the wrong way round broke every
 * picture on the site for a day, which is why they are named rather than
 * returned as one string somebody has to guess about.
 */
export function pictureFrom(item: {
  preview_path?: string | null
  thumbnail_path?: string | null
  file_path?: string | null
  kind?: string | null
}): { direct: string | null; signed: string | null } {
  // A Decal's own file is the picture; nothing else's is.
  const itself = item.kind === 'image' ? item.file_path ?? null : null

  // A card that is not WebP was drawn by the code that could not hold
  // transparency, so for a Decal it is worse than the file it was made from.
  const flat = !!item.preview_path
    && !item.preview_path.toLowerCase().endsWith(`.${PREVIEW_EXTENSION}`)

  const card = flat && itself ? null : item.preview_path ?? null
  if (card) return { direct: card, signed: null }
  return { direct: null, signed: item.thumbnail_path ?? itself }
}
