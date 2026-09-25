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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { AssetKind } from '@/types/db'

/** Big enough for a card at full width, small enough to be nothing much. */
const WIDEST = 1280
const QUALITY = 0.82

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
  return new Promise((done) => canvas.toBlob(done, 'image/jpeg', QUALITY))
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
async function fromMesh(src: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 640

  let renderer: THREE.WebGLRenderer | null = null
  try {
    const model = await new GLTFLoader().loadAsync(src)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#e9edf5')
    scene.add(model.scene)

    // Enough light to read a shape by: one from above and in front, and a
    // soft fill so the side facing away is not a silhouette.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8d95a6, 2.2))
    const sun = new THREE.DirectionalLight(0xffffff, 2.4)
    sun.position.set(6, 10, 8)
    scene.add(sun)

    const around = new THREE.Box3().setFromObject(model.scene)
    const middle = around.getCenter(new THREE.Vector3())
    const reach = Math.max(around.getBoundingSphere(new THREE.Sphere()).radius, 0.001)

    const camera = new THREE.PerspectiveCamera(35, 1, reach / 100, reach * 100)
    // Far enough that the whole sphere is inside the cone of vision, with a
    // little air around it.
    const away = (reach * 1.35) / Math.sin((camera.fov * Math.PI) / 360)
    camera.position.set(
      middle.x + away * 0.62,
      middle.y + away * 0.48,
      middle.z + away * 0.62,
    )
    camera.lookAt(middle)

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setSize(canvas.width, canvas.height, false)
    renderer.render(scene, camera)

    const drawn = await new Promise<Blob | null>((done) => {
      canvas.toBlob(done, 'image/jpeg', QUALITY)
    })

    model.scene.traverse((one) => {
      const mesh = one as THREE.Mesh
      mesh.geometry?.dispose?.()
      for (const material of [mesh.material].flat()) (material as THREE.Material)?.dispose?.()
    })

    return drawn
  } catch {
    return null
  } finally {
    // A renderer left alive holds a WebGL context, and a browser only allows
    // a handful of those at once: leak them and the fifth upload in a
    // session silently stops drawing anything.
    renderer?.dispose()
  }
}

/** From the file somebody is uploading, before it has gone anywhere. */
export async function previewOf(file: File, kind: AssetKind): Promise<Blob | null> {
  if (!canPreview(kind)) return null
  // A Kobblon part file is JSON, and nothing here reads one yet.
  if (kind === 'mesh' && !/\.(glb|gltf)$/i.test(file.name)) return null

  const src = URL.createObjectURL(file)
  try {
    if (kind === 'mesh') return await fromMesh(src)
    return kind === 'video' ? await fromFilm(src) : await fromPicture(src)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(src)
  }
}

/** From something already uploaded, for work that predates previews. */
export async function previewOfUrl(url: string, kind: AssetKind): Promise<Blob | null> {
  if (!canPreview(kind)) return null
  try {
    if (kind === 'mesh') return await fromMesh(url)
    return kind === 'video' ? await fromFilm(url) : await fromPicture(url)
  } catch {
    return null
  }
}
