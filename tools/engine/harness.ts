/*
 * The engine, run on its own.
 *
 * This is a development harness, not part of the website: Kobblon experiences
 * do not run on the web. It exists so the runtime can be driven and looked at
 * while it is being built, and so a test can step it frame by frame.
 */
import * as THREE from 'three'
import { wearTexture } from '@/engine/meshes'
import { fitToSocket } from '@/engine/k6'
import { previewOf, canPreview } from '@/lib/preview'
import { supabase, setSupabaseClient, currentSupabase } from '@/lib/supabase'
import {
  Engine, applyDecals, applyMeshes, buildSky, buildWorld, geometryFor, tiledGeometry, readManifest,
  writeManifest, stillIntent,
  MOST_LIGHTS, type Intent,
} from '@/engine'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const hud = document.getElementById('hud') as HTMLElement

/*
 * A stand-in for the Catalog. The Launcher answers this from the platform and
 * Creator answers it from whatever is on disk, including something not
 * published yet; here it draws a cross so the sky can be checked without one.
 */
const drawn = new Map<string, string>()

const engine = new Engine({
  canvas,
  avatarUrl: '/k6/k6.glb',
  resolveAsset: async (id) => drawn.get(id) ?? (window as unknown as { engineResolve?: string }).engineResolve ?? null,
  chat: { name: 'Staw' },
})

Object.assign(window, {
  previewOf,
  canPreview,
  supabase,
  setSupabaseClient,
  currentSupabase,
  buildSky,
  applyDecals,
  applyMeshes,
  buildWorld,
  geometryFor,
  tiledGeometry,
  readManifest,
  writeManifest,
  MOST_LIGHTS,
  resolveFake: async (id: string) => drawn.get(id) ?? null,
  /**
   * A short, real, silent sound, as an address.
   *
   * A real one rather than a stub: the thing being checked is what the audio
   * nodes do, and a node is only built once a buffer actually decodes. Made
   * here rather than kept in public/ because it is a fixture for the checks
   * and not something the site serves.
   */
  quietSound(seconds = 0.2) {
    const rate = 8000
    const frames = Math.round(rate * seconds)
    const bytes = 44 + frames * 2
    const buffer = new ArrayBuffer(bytes)
    const view = new DataView(buffer)
    const text = (at: number, s: string) => {
      for (let i = 0; i < s.length; i += 1) view.setUint8(at + i, s.charCodeAt(i))
    }
    text(0, 'RIFF'); view.setUint32(4, bytes - 8, true); text(8, 'WAVE')
    text(12, 'fmt '); view.setUint32(16, 16, true)
    view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true)
    view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    text(36, 'data'); view.setUint32(40, frames * 2, true)
    // Samples left at zero: silence, so a check never makes a noise.
    let binary = ''
    const raw = new Uint8Array(buffer)
    for (let i = 0; i < raw.length; i += 1) binary += String.fromCharCode(raw[i])
    return `data:audio/wav;base64,${btoa(binary)}`
  },
  /** The data address a fake picture was stored at, for a slow resolver. */
  drawnUrl: (id: string) => drawn.get(id) ?? null,
  /**
   * Where a worn thing actually ends up on the body, and whether it stays
   * there once the body moves.
   *
   * The second half is the point. A hat parented to the right place but not
   * to a *bone* sits correctly on a still avatar and is left behind the
   * moment somebody walks - which is exactly the kind of wrong that looks
   * fine in a screenshot.
   */
  async wornAt(point: string, steps = 0) {
    const { K6, loadK6Source, K6_POINTS } = await import('@/engine/k6')
    const source = await loadK6Source('/k6/k6.glb')
    const body = new K6(source)

    const thing = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshBasicMaterial(),
    )
    body.wear(point as keyof typeof K6_POINTS, thing)

    // Into a scene, or nothing has a world matrix worth reading.
    const scene = new THREE.Scene()
    scene.add(body.object)

    if (steps > 0) {
      body.play('walk', 0)
      for (let i = 0; i < steps; i += 1) body.update(1 / 60)
    }
    scene.updateMatrixWorld(true)

    const at = thing.getWorldPosition(new THREE.Vector3())
    const head = body.parts.get('Head')!
    const headBox = new THREE.Box3().setFromObject(head)

    const answer = {
      at: at.toArray().map((n) => +n.toFixed(2)),
      headTop: +headBox.max.y.toFixed(2),
      headFront: +headBox.max.z.toFixed(2),
      parented: thing.parent?.name ?? null,
      wearing: body.wearing().size,
    }
    body.dispose()
    return answer
  },
  /**
   * What colour a part's material is: painted, dressed, undressed.
   *
   * three.js multiplies `map` by `color`, so a shirt on a torso painted navy
   * came out navy-times-shirt - the body colour tinting the clothing, which
   * Staw found by looking at it. The check is the sequence rather than one
   * state, because the colour and the map change for different reasons and
   * the bug lives in the case where only one of them changed.
   */
  async skinUnderClothes() {
    const { K6, loadK6Source } = await import('@/engine/k6')
    const body = new K6(await loadK6Source('/k6/k6.glb'))
    const hex = () => (body.parts.get('Torso')!.material as THREE.MeshStandardMaterial)
      .color.getHexString()

    body.paint({ Torso: '#1b34e8' })
    const painted = hex()

    body.dress('shirt', new THREE.Texture())
    const dressed = hex()

    body.dress('shirt', null)
    const bare = hex()

    body.dress('shirt', new THREE.Texture())
    body.paint({ Torso: '#ff0033' })
    const afterRepaint = hex()

    return { painted, dressed, bare, afterRepaint }
  },
  /**
   * Where a template lands on the body.
   *
   * Reported as numbers rather than looked at, because the thing that went
   * wrong the first time - every face mirrored - looked completely fine
   * until somebody read a letter on it. A letter is only legible to a human
   * at one size; a sign is legible to a check at any.
   */
  async clothesWrap() {
    const { K6, loadK6Source } = await import('@/engine/k6')
    const { templateFor } = await import('@/engine/clothes')
    const body = new K6(await loadK6Source('/k6/k6.glb'))
    body.dress('shirt', new THREE.Texture())

    const torso = body.parts.get('Torso')!
    const uv = torso.geometry.getAttribute('uv1') as THREE.BufferAttribute
    const position = torso.geometry.getAttribute('position')
    const normal = torso.geometry.getAttribute('normal')
    const sheet = templateFor('shirt')

    // The front panel, as a share of the whole sheet.
    const front = sheet.regions['Torso.front']
    const inFront = {
      u0: front.x / sheet.width,
      u1: (front.x + front.w) / sheet.width,
      v0: 1 - (front.y + front.h) / sheet.height,
      v1: 1 - front.y / sheet.height,
    }

    let rightMost = { x: -Infinity, u: 0 }
    let leftMost = { x: Infinity, u: 0 }
    let highest = { y: -Infinity, v: 0 }
    let inside = 0
    let facing = 0

    for (let i = 0; i < position.count; i += 1) {
      if (normal.getZ(i) < 0.9) continue
      facing += 1
      const u = uv.getX(i)
      const v = uv.getY(i)
      if (u >= inFront.u0 - 0.001 && u <= inFront.u1 + 0.001
        && v >= inFront.v0 - 0.001 && v <= inFront.v1 + 0.001) inside += 1
      const x = position.getX(i)
      const y = position.getY(i)
      if (x > rightMost.x) rightMost = { x, u }
      if (x < leftMost.x) leftMost = { x, u }
      if (y > highest.y) highest = { y, v }
    }

    const has = !!torso.geometry.getAttribute('uv')
    body.dispose()
    return {
      facing,
      allInsideFront: facing > 0 && inside === facing,
      // +X is the avatar's left, which is on the right of the template as a
      // person looks at the front of it.
      notMirrored: rightMost.u > leftMost.u,
      topIsHigh: highest.v > (inFront.v0 + inFront.v1) / 2,
      keptItsOwnUv: has,
      sheet: { w: sheet.width, h: sheet.height },
    }
  },

  /**
   * Where a template lands on the body.
   *
   * Reported as numbers rather than looked at, because the thing that went
   * wrong the first time - every face mirrored - looked completely fine
   * until somebody read a letter on it, and only at the right size. A sign
   * is legible to a check at any size.
   */
  async clothesWrap() {
    const { K6, loadK6Source } = await import('@/engine/k6')
    const { templateFor } = await import('@/engine/clothes')
    const body = new K6(await loadK6Source('/k6/k6.glb'))
    body.dress('shirt', new THREE.Texture())

    const torso = body.parts.get('Torso')!
    const uv = torso.geometry.getAttribute('uv1') as THREE.BufferAttribute
    const position = torso.geometry.getAttribute('position')
    const normal = torso.geometry.getAttribute('normal')
    const sheet = templateFor('shirt')

    const front = sheet.regions['Torso.front']
    const edge = {
      u0: front.x / sheet.width,
      u1: (front.x + front.w) / sheet.width,
      v0: 1 - (front.y + front.h) / sheet.height,
      v1: 1 - front.y / sheet.height,
    }

    let rightMost = { x: -Infinity, u: 0 }
    let leftMost = { x: Infinity, u: 0 }
    let highest = { y: -Infinity, v: 0 }
    let inside = 0
    let facing = 0

    for (let i = 0; i < position.count; i += 1) {
      if (normal.getZ(i) < 0.9) continue
      facing += 1
      const u = uv.getX(i)
      const v = uv.getY(i)
      if (u >= edge.u0 - 0.001 && u <= edge.u1 + 0.001
        && v >= edge.v0 - 0.001 && v <= edge.v1 + 0.001) inside += 1
      const x = position.getX(i)
      const y = position.getY(i)
      if (x > rightMost.x) rightMost = { x, u }
      if (x < leftMost.x) leftMost = { x, u }
      if (y > highest.y) highest = { y, v }
    }

    const keptItsOwnUv = !!torso.geometry.getAttribute('uv')
    body.dispose()
    return {
      facing,
      allInsideFront: facing > 0 && inside === facing,
      // +X is the avatar's left, which is the right of the template as a
      // person looks at the front of it.
      notMirrored: rightMost.u > leftMost.u,
      topIsHigh: highest.v > (edge.v0 + edge.v1) / 2,
      keptItsOwnUv,
    }
  },

  /**
   * Whether a face goes on, comes off, leaves nothing behind - and whether
   * it is on the head rather than in front of it.
   *
   * The second half is Staw's: "make that the faces really are onto the head,
   * not infront". A flat square an inch off the front passes "is there a
   * face", which is why the check measures the thing that tells them apart -
   * how far the surface bends back from its middle to its edges. A plane
   * bends back by nothing.
   */
  async faceOnOff() {
    const { K6, loadK6Source } = await import('@/engine/k6')
    const body = new K6(await loadK6Source('/k6/k6.glb'))
    const scene = new THREE.Scene()
    scene.add(body.object)

    const find = () => {
      let found: THREE.Mesh | null = null
      body.object.traverse((o) => { if (o.name === 'face') found = o as THREE.Mesh })
      return found as THREE.Mesh | null
    }

    const before = !!find()
    const picture = new THREE.Texture()
    body.setFace(picture)
    scene.updateMatrixWorld(true)

    const on = find()
    const headBox = new THREE.Box3().setFromObject(body.parts.get('Head')!)
    const headMiddle = headBox.getCenter(new THREE.Vector3())
    const faceBox = on ? new THREE.Box3().setFromObject(on) : null

    /*
     * How far each corner of the surface sits from the head's axis, against
     * how far the middle of it does. On a cylinder of the head's own radius
     * they are the same number; on a plane the corners are further out,
     * because a flat sheet held against a round head only touches down the
     * middle.
     */
    const radii: number[] = []
    if (on) {
      const points = on.geometry.getAttribute('position')
      const at = new THREE.Vector3()
      for (let i = 0; i < points.count; i += 1) {
        at.fromBufferAttribute(points, i)
        on.localToWorld(at)
        radii.push(Math.hypot(at.x - headMiddle.x, at.z - headMiddle.z))
      }
    }

    body.setFace(null)
    const after = !!find()
    body.dispose()

    return {
      before,
      on: !!on,
      after,
      mapped: on ? (on.material as THREE.MeshBasicMaterial).map === picture : false,
      // The front of the face against the front of the head: still a hair
      // proud, so the two never fight for the same pixels.
      proud: faceBox ? +(faceBox.max.z - headBox.max.z).toFixed(3) : null,
      across: faceBox ? +(faceBox.max.x - faceBox.min.x).toFixed(2) : null,
      tall: faceBox ? +(faceBox.max.y - faceBox.min.y).toFixed(2) : null,
      // How far it wraps back. Zero is a flat sticker.
      wraps: faceBox ? +(faceBox.max.z - faceBox.min.z).toFixed(3) : null,
      headWide: +(headBox.max.x - headBox.min.x).toFixed(2),
      furthest: radii.length ? +Math.max(...radii).toFixed(3) : null,
      nearest: radii.length ? +Math.min(...radii).toFixed(3) : null,
      height: faceBox ? +faceBox.getCenter(new THREE.Vector3()).y.toFixed(2) : null,
      /*
       * How much surface the picture is painted on, across and down. These
       * two being equal is what "a square face is drawn square" means, and
       * it is not the same as the box being square: the face is bent, so the
       * surface across it is an arc and the box only sees its chord.
       */
      surfaceAcross: on
        ? +(
          Math.abs(
            (on.geometry.parameters as { thetaLength: number }).thetaLength
            * (on.geometry.parameters as { radiusTop: number }).radiusTop,
          )
        ).toFixed(3)
        : null,
      surfaceDown: on
        ? +(on.geometry.parameters as { height: number }).height.toFixed(3)
        : null,
    }
  },

  /**
   * The same face box whatever shape the picture is.
   *
   * Two pictures of different shapes, each with its drawing in a different
   * part of its own file. The head does not care: one box, and a picture is
   * laid in it whole.
   *
   * The second half of this check is a promise that was made and then taken
   * back. Cropping each picture to the part of it that was drawn on did make
   * two faces the same size on the nose - and multiplied with the bigger box
   * until every face was far too big, which is what Staw saw. So `cropped`
   * is now checked to be false: a face is its file.
   */
  async twoFaces() {
    const { K6, loadK6Source } = await import('@/engine/k6')

    const drawn = (wide: number, high: number, inset: number) => {
      const sheet = document.createElement('canvas')
      sheet.width = wide
      sheet.height = high
      const paint = sheet.getContext('2d')!
      paint.clearRect(0, 0, wide, high)
      paint.fillStyle = '#000000'
      paint.fillRect(inset, inset, wide - inset * 2, high - inset * 2)
      const picture = new THREE.CanvasTexture(sheet)
      return picture
    }

    const measure = async (picture: THREE.Texture) => {
      const body = new K6(await loadK6Source('/k6/k6.glb'))
      const scene = new THREE.Scene()
      scene.add(body.object)
      body.setFace(picture)
      scene.updateMatrixWorld(true)
      let found: THREE.Mesh | null = null
      body.object.traverse((o) => { if (o.name === 'face') found = o as THREE.Mesh })
      const box = new THREE.Box3().setFromObject(found!)
      const answer = {
        across: +(box.max.x - box.min.x).toFixed(3),
        tall: +(box.max.y - box.min.y).toFixed(3),
        window: [
          +picture.repeat.x.toFixed(3), +picture.repeat.y.toFixed(3),
        ],
      }
      body.dispose()
      return answer
    }

    // A square picture drawn edge to edge, and a tall one with its drawing
    // in the middle of a wide margin.
    const full = await measure(drawn(256, 256, 0))
    const inset = await measure(drawn(128, 256, 40))

    return {
      full,
      inset,
      sameSize: full.across === inset.across && full.tall === inset.tall,
      // The second one is cropped in on its drawing rather than shown whole.
      cropped: inset.window[0] < 0.999 || inset.window[1] < 0.999,
    }
  },

  /**
   * Fitting the same model twice, which is what switching accessories does.
   *
   * `fitToSocket` multiplies the scale, and for a long time it reset the
   * position and the rotation but not the scale - so the second fit
   * multiplied again and the thing came out at the square of its size.
   * Reported from a screenshot, which is the expensive way to find it.
   *
   * The check is not "is the size right after one fit". It is "does a
   * second fit land in the same place as the first", because the broken
   * version passes the first question.
   */
  /**
   * Several things on one socket, which the database now allows.
   *
   * The check is not "does a hat go on" - the broken version passes that.
   * It is **"is the first one still there after the second"**, plus that
   * both are parented to the same bone, because a second hat that replaces
   * the first and a second hat that is left behind when the body walks are
   * two different ways of losing it and both draw correctly standing still.
   */
  async twoOnOneSocket(steps = 0) {
    const { K6, loadK6Source } = await import('@/engine/k6')
    const body = new K6(await loadK6Source('/k6/k6.glb'))

    const make = () => new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshBasicMaterial(),
    )
    const first = make()
    const second = make()

    body.wear('hat', first)
    body.wearAlso('hat', second)

    const scene = new THREE.Scene()
    scene.add(body.object)
    if (steps > 0) {
      body.play('walk', 0)
      for (let i = 0; i < steps; i += 1) body.update(1 / 60)
    }
    scene.updateMatrixWorld(true)

    const onSocket = body.wearing().get('hat') ?? []
    const answer = {
      count: onSocket.length,
      bothThere: onSocket.includes(first) && onSocket.includes(second),
      sameParent: first.parent === second.parent,
      parented: first.parent?.name ?? null,
      together: first.getWorldPosition(new THREE.Vector3())
        .distanceTo(second.getWorldPosition(new THREE.Vector3())),
      // And taking one off leaves the other, which is what the cross on one
      // row of "Wearing" does.
      afterOneOff: (() => {
        body.takeOffOne(first)
        const left = body.wearing().get('hat') ?? []
        return { count: left.length, kept: left[0] === second }
      })(),
      // And the slot door still empties the lot, handing all of them back so
      // nothing is leaked.
      handedBack: body.takeOff('hat').length,
    }
    body.dispose()
    return answer
  },
  fitTwice(grow: number) {
    const model = new THREE.Mesh(
      new THREE.BoxGeometry(10, 6, 10),
      new THREE.MeshBasicMaterial(),
    )
    // Drawn off its own origin, as an uploaded accessory routinely is.
    model.geometry.translate(6, 0, 0)

    const placed = { p: [0, 0, 0] as const, r: [0, 0, 0] as const, s: grow }

    fitToSocket(model, 'hat', placed)
    const once = {
      scale: +model.scale.x.toFixed(4),
      at: model.position.toArray().map((n) => +n.toFixed(3)),
    }

    fitToSocket(model, 'hat', placed)
    const twice = {
      scale: +model.scale.x.toFixed(4),
      at: model.position.toArray().map((n) => +n.toFixed(3)),
    }

    return {
      once, twice,
      same: once.scale === twice.scale
        && once.at.every((n, i) => Math.abs(n - twice.at[i]) < 0.001),
    }
  },
  /**
   * What `wearTexture` actually does to a model, for the two things that
   * made a Decal look like it never arrived: the wrong way up, and no
   * texture coordinates to sample at all.
   *
   * The geometry has its `uv` attribute taken off deliberately, which is
   * what an OBJ exported without `vt` lines gives you.
   */
  dressed(format: 'gltf' | 'obj', withUv: boolean) {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    if (!withUv) geometry.deleteAttribute('uv')
    const part = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
    const authored = withUv
      ? Array.from((geometry.getAttribute('uv') as THREE.BufferAttribute).array)
      : null

    const picture = new THREE.Texture()
    wearTexture(part, picture, format)

    const uv = part.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined
    const numbers = uv ? Array.from(uv.array as Float32Array) : []
    return {
      flipY: picture.flipY,
      hasUv: !!uv,
      count: uv?.count ?? 0,
      // Every coordinate a real number inside the picture.
      sane: numbers.length > 0
        && numbers.every((n) => Number.isFinite(n) && n >= 0 && n <= 1),
      // An authored model's own coordinates are left exactly as they were.
      untouched: authored ? JSON.stringify(authored) === JSON.stringify(numbers) : null,
      mapped: (part.material as THREE.MeshStandardMaterial).map === picture,
      /*
       * BoxGeometry lays its faces out +X, -X, +Y, -Y, +Z, -Z, four
       * vertices each. So the two faces that look at each other along X are
       * vertices 0-3 and 4-7, and whether a Decal reads the right way round
       * on both is whether their `u` runs in opposite directions.
       */
      acrossX: uv
        ? { front: numbers.slice(0, 8), back: numbers.slice(8, 16) }
        : null,
    }
  },
  /** A plain picture of a given shape, for checking how a decal is fitted. */
  fakePicture(id: string, width: number, height: number) {
    const sheet = document.createElement('canvas')
    sheet.width = width
    sheet.height = height
    const paint = sheet.getContext('2d')!
    paint.fillStyle = '#ffffff'
    paint.fillRect(0, 0, width, height)
    drawn.set(id, sheet.toDataURL('image/png'))
    return id
  },
  /** Makes a horizontal cross with a different colour on each face. */
  fakeSky(id: string) {
    const face = 64
    const sheet = document.createElement('canvas')
    sheet.width = face * 4
    sheet.height = face * 3
    const paint = sheet.getContext('2d')!
    const where: [string, number, number][] = [
      ['#ff0000', 2, 1], ['#00ff00', 0, 1], ['#0000ff', 1, 0],
      ['#ffff00', 1, 2], ['#ff00ff', 1, 1], ['#00ffff', 3, 1],
    ]
    for (const [colour, column, row] of where) {
      paint.fillStyle = colour
      paint.fillRect(column * face, row * face, face, face)
    }
    drawn.set(id, sheet.toDataURL('image/png'))
    return id
  },
})
addEventListener('resize', () => engine.resize())

// What the engine says happened, kept for a test to read. Listening starts
// before the first World is opened, so the first one counts.
const said: { died: number; opened: number } = { died: 0, opened: 0 }
engine.on('died', () => { said.died += 1 })
engine.on('opened', () => { said.opened += 1 })
Object.assign(window, { said })

// A test needs the built World, not only the engine's summary of it.
let latest: Awaited<ReturnType<typeof engine.open>> | null = null
const open = engine.open.bind(engine)
engine.open = async (raw: unknown) => {
  latest = await open(raw)
  return latest
}
Object.assign(window, { built: () => latest })

const manifest = await fetch('/experiences/first-ground.json').then((r) => r.json())
await engine.open(manifest)

// A test drives this instead of the keyboard, so movement can be asserted
// rather than eyeballed.
const forced: { intent: Intent | null } = { intent: null }
Object.assign(window, {
  engine,
  drive(next: Partial<Intent> | null) {
    forced.intent = next ? { ...stillIntent(), ...next } : null
  },
  /** Steps a fixed number of frames at a fixed rate: repeatable, unlike a clock. */
  stepFrames(count: number, dt = 1 / 60) {
    for (let i = 0; i < count; i += 1) engine.tick(dt, forced.intent ?? stillIntent())
    return engine.status
  },
})

let last = performance.now()
const loop = (now: number) => {
  const dt = Math.min((now - last) / 1000, 1 / 20)
  last = now
  if (!forced.intent) engine.tick(dt, undefined)
  const s = engine.status
  hud.textContent = [
    `world       ${s.world}`,
    `parts       ${s.parts.length}  ${s.parts.join(' ')}`,
    `position    ${s.position.map((n) => n.toFixed(1)).join(', ')}`,
    `grounded    ${s.grounded}   speed ${s.speed}`,
    '',
    'WASD move · Shift run · Space jump · E wave · drag to look',
  ].join('\n')
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

Object.assign(window, { engineReady: true })
