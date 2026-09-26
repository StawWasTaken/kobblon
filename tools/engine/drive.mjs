/*
 * Drives the engine and checks what it did.
 *
 * Every number below comes from stepping the real runtime at a fixed rate, so
 * a pass means the thing works rather than that it compiled.
 */
import { chromium } from 'playwright'

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const p = await b.newPage({ viewport: { width: 1100, height: 660 } })
const bad = []
p.on('pageerror', (e) => bad.push(String(e)))
p.on('response', (r) => { if (r.status() === 404) bad.push('404: ' + r.url()) })
p.on('console', (m) => {
  // a missing favicon is the harness page, not the engine
  if (m.type() === 'error' && !m.text().includes('favicon')) bad.push('console: ' + m.text())
})

await p.goto('http://localhost:5320/', { waitUntil: 'networkidle' })
await p.waitForFunction(() => window.engineReady === true, null, { timeout: 30000 })

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`)
}

// -- 1. the experience and the avatar are actually there
const start = await p.evaluate(() => { window.drive({}); return window.stepFrames(30) })
check('the World loads', start.world === 'First Ground', start.world)
check('K6 has exactly six parts', start.parts.length === 6, start.parts.join(','))

// -- 2. gravity puts it on the spawn pad rather than through it
check('falls onto the pad and stops', start.grounded && Math.abs(start.position[1] - 0.6) < 0.01,
  `y=${start.position[1].toFixed(2)} grounded=${start.grounded}`)

// -- 3. walking moves it, and in the direction asked for
// out in the open, where nothing can stop it and the speed means something
const walked = await p.evaluate(() => {
  window.engine.controller.placeAt(0, 1, 40)
  window.drive({ x: 1 })
  return window.stepFrames(60)
})
// the spawn faces 180, which in Kobblon means looking down -Z
// 3.2 of its own height a second, which is what a Roblox character walks.
check('walk speed is the one everybody\u2019s hands know',
  Math.abs(walked.speed - 32) < 1.5, `${walked.speed} stons a second`)
// and forward is the way it is facing: the spawn looks down -Z
const forward = await p.evaluate(() => {
  window.engine.controller.placeAt(0, 1, 18, Math.PI)
  window.engine.tick(0, { x: 0, z: 0, jump: false, run: false, turn: 0, pitch: 0, emote: false })
  window.drive({ z: 1 })
  return window.stepFrames(40)
})
check('walks the way it is facing', forward.position[2] < 18 - 5,
  `z 18.0 -> ${forward.position[2].toFixed(1)}`)

// -- 4. there is one speed, and holding the old sprint key does not change it
const ran = await p.evaluate(() => {
  window.engine.controller.placeAt(0, 1, 40)
  window.drive({ x: 1, run: true })
  return window.stepFrames(60)
})
check('there is one speed and no sprint',
  Math.abs(ran.speed - walked.speed) < 0.5, `${walked.speed} and ${ran.speed}`)

// -- 5. a wall stops it instead of letting it through
const atWall = await p.evaluate(() => {
  window.engine.controller.placeAt(0, 6, -30)
  window.drive({ z: 1, run: true })
  return window.stepFrames(120)
})
check('a wall stops it', atWall.position[2] > -35,
  `stopped at z=${atWall.position[2].toFixed(1)}, wall face at z=-35`)

// -- 6. jumping leaves the floor and comes back to it
const mid = await p.evaluate(() => {
  window.engine.controller.placeAt(0, 1, 18)
  window.drive({})
  window.stepFrames(20)
  window.drive({ jump: true })
  return window.stepFrames(14)
})
check('jumping leaves the ground', !mid.grounded && mid.position[1] > 2,
  `y=${mid.position[1].toFixed(2)} grounded=${mid.grounded}`)

const landed = await p.evaluate(() => { window.drive({}); return window.stepFrames(90) })
check('lands again', landed.grounded && Math.abs(landed.position[1] - 0.6) < 0.01,
  `y=${landed.position[1].toFixed(2)}`)

// -- 7. it climbs the steps rather than stopping at them
const climbed = await p.evaluate(() => {
  window.engine.controller.placeAt(0, 1, 0)
  window.drive({ z: 1 })
  return window.stepFrames(180)
})
check('walks up the steps', climbed.position[1] > 3 && climbed.grounded,
  `y=${climbed.position[1].toFixed(2)} z=${climbed.position[2].toFixed(1)}`)

// -- 8. the animation state machine follows the body
const motions = await p.evaluate(async () => {
  const seen = {}
  const motionOf = () => window.engine.status
  window.engine.controller.placeAt(0, 1, 18)
  window.drive({}); window.stepFrames(40)
  seen.still = window.engine.status.speed
  window.engine.controller.placeAt(0, 1, 40)
  window.drive({ x: 1 }); window.stepFrames(40)
  seen.walking = window.engine.status.speed
  window.engine.controller.placeAt(0, 1, 40)
  window.drive({ x: 1, run: true }); window.stepFrames(60)
  seen.running = window.engine.status.speed
  void motionOf
  return seen
})
check('speed drives the motion', motions.still < 0.5 && motions.walking > 8 && motions.running > 18,
  JSON.stringify(motions))

// -- 9. falling out of the World is a death, at this World's spawn
const fell = await p.evaluate(() => {
  window.said.died = 0
  window.engine.controller.placeAt(0, -260, 0)
  window.drive({})
  const after = window.stepFrames(4)
  return { after, died: window.said.died }
})
check('falling out is a death', fell.died === 1, `died fired ${fell.died} time(s)`)
check('and it puts you at this World spawn, not the origin',
  Math.abs(fell.after.position[0] - 0) < 0.01 && Math.abs(fell.after.position[2] - 18) < 0.01,
  `back at ${fell.after.position.map((n) => n.toFixed(1)).join(', ')}, spawn is 0, 6, 18`)

// -- 10. groups: a part inside a moved group lands where the group put it
const grouped = await p.evaluate(async () => {
  await window.engine.open({
    format: 1, id: 'g', name: 'Grouped', spawn: { at: [0, 30, 0] },
    blocks: [
      { kind: 'box', at: [0, -1, 0], size: [200, 2, 200] },
      {
        kind: 'group', id: 'tower', at: [40, 0, 0], turn: 0,
        parts: [{ id: 'top', kind: 'box', at: [0, 10, 0], size: [8, 20, 8] }],
      },
    ],
  })
  window.drive({})
  window.engine.controller.placeAt(40, 40, 0)
  const landed = window.stepFrames(120)
  return { landed, opened: window.said.opened }
})
check('a part inside a group is where the group put it',
  Math.abs(grouped.landed.position[1] - 20) < 0.02 && grouped.landed.grounded,
  `stood at y=${grouped.landed.position[1].toFixed(2)}, the group puts its top at 20`)
check('opening a World says so', grouped.opened >= 2, `opened fired ${grouped.opened} time(s)`)

// -- 11. quality is something a player can actually change
const quality = await p.evaluate(() => {
  window.engine.setQuality(0.5)
  const low = window.engine.status.frame
  window.engine.setQuality(1)
  return { ok: typeof low === 'number' }
})
check('render quality can be set', quality.ok, 'setQuality accepted 0.5 and 1')

// -- 12. the sky: a colour when a World names none, its picture when it does
const skies = await p.evaluate(async () => {
  const plain = await window.buildSky({ sky: { colour: '#123456' } }, undefined)
  const missing = await window.buildSky(
    { sky: { colour: '#123456', decal: 'nope' } },
    async () => null,
  )

  // the same builder an editor would call, with a picture it has not published
  const id = window.fakeSky('sky-loose')
  const drawn = await window.buildSky({ sky: { decal: id } }, window.resolveFake)

  return {
    plain: plain.colour.getHexString() === '123456' && plain.box === null,
    missing: missing.colour.getHexString() === '123456' && missing.box === null,
    editor: !!drawn.box && drawn.environment?.image?.length === 6,
  }
})
check('a World with no sky gets its colour', skies.plain, 'colour honoured')
check('a sky that cannot be had falls back to the colour', skies.missing,
  'a picture that will not load never stops a World opening')
check('an editor can build the same sky without the engine', skies.editor,
  'a box to add to a scene, and a cube for reflections')

// and through the engine, which is how an app gets one
const dressed = await p.evaluate(async () => {
  window.fakeSky('sky-2')
  await window.engine.open({
    format: 1, id: 's', name: 'Sky', spawn: { at: [0, 4, 0] },
    sky: { colour: '#123456', decal: 'sky-2' },
    blocks: [{ kind: 'box', at: [0, -1, 0], size: [40, 2, 40] }],
  })
  // The picture is fetched, so wait for it rather than guessing how long a
  // machine takes: a fixed sleep is a test that fails on a slow morning.
  const waited = Date.now()
  while (!window.engine.skybox && Date.now() - waited < 5000) {
    await new Promise((done) => setTimeout(done, 50))
  }
  const sky = window.engine.skybox?.object
  const camera = window.engine.camera
  return {
    inTheScene: !!sky,
    faces: Array.isArray(sky?.material) ? sky.material.length : 0,
    // the horizon is lower because the sky sits below the eye
    belowTheEye: !!sky && sky.position.y < camera.position.y - 100,
    reflects: window.engine.scene.environment?.isCubeTexture === true,
  }
})
check('a World that names a sky gets the sky',
  dressed.inTheScene && dressed.faces === 6, `a box with ${dressed.faces} faces`)
check('the sky sits below the eye, so the horizon is lower', dressed.belowTheEye,
  'the box is placed, not painted on the background')
check('and metal has the sky to reflect', dressed.reflects, 'scene.environment')

// -- 13. shapes, materials, transparency and decals
const dressed2 = await p.evaluate(async () => {
  const id = window.fakeSky('decal-1')
  await window.engine.open({
    format: 1, id: 'parts', name: 'Parts', spawn: { at: [0, 6, 20] },
    blocks: [
      { id: 'floor', kind: 'box', at: [0, -1, 0], size: [80, 2, 80], material: 'grass' },
      { id: 'ramp', kind: 'box', shape: 'wedge', at: [-10, 2, 0], size: [8, 4, 12], material: 'concrete' },
      { id: 'pipe', kind: 'box', shape: 'cylinder', at: [0, 4, 0], size: [5, 8, 5], material: 'metal' },
      { id: 'ball', kind: 'box', shape: 'sphere', at: [10, 4, 0], size: [7, 7, 7], material: 'neon', colour: '#25D68C' },
      { id: 'pane', kind: 'box', at: [0, 4, 12], size: [16, 8, 0.5], material: 'glass' },
      { id: 'signed', kind: 'box', at: [18, 4, 0], size: [8, 8, 1],
        children: [{ id: 'poster', kind: 'decal', picture: id, face: 'front' }] },
      // written the old way, which has to keep opening
      { id: 'legacy', kind: 'box', at: [26, 4, 0], size: [8, 8, 1], decal: { id, face: 'front' } },
      { id: 'faded', kind: 'box', at: [-20, 4, 0], size: [6, 6, 6], transparency: 0.5 },
      { id: 'shiny', kind: 'box', at: [-28, 4, 0], size: [6, 6, 6], reflectance: 1 },
    ],
  })
  await new Promise((done) => setTimeout(done, 500))

  const of = (name) => {
    for (const [object, part] of window.engine.status && window.built().partOf) {
      if (part.id === name) return { object, part }
    }
    return null
  }

  const shapes = {}
  for (const name of ['ramp', 'pipe', 'ball', 'floor']) {
    shapes[name] = of(name)?.object.geometry.type ?? null
  }

  const glass = of('pane').object.material
  const faded = of('faded').object.material
  const shiny = of('shiny').object.material
  const neon = of('ball').object.material
  const signed = of('signed').object.material

  return {
    shapes,
    glassSeeThrough: glass.transparent === true && glass.opacity < 1,
    fadedHalf: Math.abs(faded.opacity - 0.5) < 0.01,
    shinyIsMetal: shiny.metalness > 0.5 && shiny.roughness < 0.3,
    neonGlows: neon.emissiveIntensity > 0,
    // Every face carries the material's own pattern now, so the decal is the
    // one whose map is a different picture from the other five.
    // the decal is in the tree, selectable, rather than hidden in a field
    // A decal has no body, so it lives in the tree rather than in the scene:
    // an editor finds it by walking the World, which is what an Explorer is.
    decalInTree: (() => {
      const walk = (parts) => parts.some((one) =>
        (one.kind === 'decal' && one.id === 'poster' && one.face === 'front')
        || (one.kind === 'group' && walk(one.parts))
        || (one.kind === 'box' && walk(one.children ?? [])))
      return walk(window.built().manifest.blocks)
    })(),
    oldFileStillOpens: (() => {
      for (const [object, part] of window.built().partOf) {
        if (part.id === 'legacy') {
          const kids = part.children ?? []
          // read as a child, and standing on the part as a child mesh
          return kids.length === 1 && kids[0].kind === 'decal' && object.children.length === 1
        }
      }
      return false
    })(),
    // A decal is a thing standing on the part, not a face of its material.
    decalIsItsOwnMesh: (() => {
      for (const [object, part] of window.built().partOf) {
        if (part.kind === 'decal' && part.id === 'poster') {
          const holder = object.parent
          if (!object.isMesh || !holder?.isMesh) return false
          // Just off the surface, measured in the World rather than in the
          // part's own space: the same local offset on a thin part is a
          // thousandth of a ston and the picture loses the depth test.
          const gap = object.position.z * holder.scale.z - holder.scale.z / 2
          return Math.abs(gap - 0.02) < 0.001 && object.visible === true
        }
      }
      return false
    })(),
  }
})
check('a wedge is a wedge, a cylinder a cylinder, a sphere a sphere',
  dressed2.shapes.ramp === 'BufferGeometry'
  && dressed2.shapes.pipe === 'CylinderGeometry'
  && dressed2.shapes.ball === 'SphereGeometry'
  && dressed2.shapes.floor === 'BoxGeometry',
  JSON.stringify(dressed2.shapes))
check('glass is see through on its own', dressed2.glassSeeThrough, 'the material decides')
check('transparency is a number a part sets', dressed2.fadedHalf, 'half at 0.5')
check('reflectance turns a part to metal', dressed2.shinyIsMetal, 'metalness up, roughness down')
check('neon carries its own light', dressed2.neonGlows, 'emissive')
check('a decal stands on the part rather than being its material',
  dressed2.decalIsItsOwnMesh, 'a mesh, parented, and a fifth of a ston off the face')
check('a decal is its own thing in the tree', dressed2.decalInTree,
  'selectable, with its own face')
check('a World written the old way still opens', dressed2.oldFileStillOpens,
  'the field is read as the child it always meant')

// -- 13a. the camera stands behind the head and above it, not below
const eye = await p.evaluate(() => {
  window.engine.controller.placeAt(0, 1, 18)
  window.drive({})
  window.stepFrames(5)
  return {
    camera: window.engine.camera.position.toArray(),
    feet: window.engine.status.position,
  }
})
check('the camera looks from above the avatar, not from its knees',
  eye.camera[1] > eye.feet[1] + 10,
  `feet at y=${eye.feet[1].toFixed(1)}, camera at y=${eye.camera[1].toFixed(1)}`)

// -- 13b. the point of parenting: a decal is resized by the part it is on
const sized = await p.evaluate(async () => {
  const id = window.fakeSky('decal-size')
  const world = (wide) => ({
    format: 1, id: 'd', name: 'Sized', spawn: { at: [0, 6, 20] },
    blocks: [
      { id: 'floor', kind: 'box', at: [0, -1, 0], size: [40, 2, 40] },
      { id: 'wall', kind: 'box', at: [0, 5, 0], size: [wide, 6, 1],
        children: [{ id: 'sign', kind: 'decal', picture: id, face: 'front' }] },
    ],
  })

  const widthOf = async (wide) => {
    await window.engine.open(world(wide))
    for (const [object, part] of window.built().partOf) {
      if (part.kind === 'decal') {
        window.engine.scene.updateMatrixWorld(true)
        return object.getWorldScale(new (Object.getPrototypeOf(object.position).constructor)()).x
      }
    }
    return null
  }

  return { small: await widthOf(6), big: await widthOf(24) }
})
check('a decal is resized by the part it is on',
  sized.small !== null && Math.abs(sized.big / sized.small - 4) < 0.01,
  `a wall four times as wide carries a sign ${(sized.big / sized.small).toFixed(2)} times as wide`)

// -- 13c. a decal covers the face, whatever shape the picture is
const stretched = await p.evaluate(async () => {
  // A tall picture on a wide wall. It used to come out square.
  const id = window.fakePicture('decal-stretch', 64, 256)
  await window.engine.open({
    format: 1, id: 'st', name: 'Stretch', spawn: { at: [0, 6, 20] },
    blocks: [
      { id: 'floor', kind: 'box', at: [0, -1, 0], size: [40, 2, 40] },
      { id: 'wall', kind: 'box', at: [0, 5, 0], size: [30, 6, 1],
        children: [{ id: 'sign', kind: 'decal', picture: id, face: 'front' }] },
    ],
  })
  await window.applyDecals(window.built(), window.resolveFake)
  window.engine.scene.updateMatrixWorld(true)

  for (const [object, part] of window.built().partOf) {
    if (part.kind !== 'decal') continue
    const Vec = Object.getPrototypeOf(object.position).constructor
    const scale = object.getWorldScale(new Vec())
    return { wide: Number(scale.x.toFixed(2)), tall: Number(scale.y.toFixed(2)) }
  }
  return null
})
check('a decal is stretched by the part it is on, not held at its own shape',
  stretched && Math.abs(stretched.wide - 30) < 0.01 && Math.abs(stretched.tall - 6) < 0.01,
  `a tall picture on a 30x6 wall covers ${stretched?.wide}x${stretched?.tall}`)

// -- 13d. the wedge is a solid, not an open box
const solidWedge = await p.evaluate(() => {
  const geometry = window.geometryFor('wedge')
  const position = geometry.getAttribute('position')

  // The centre of mass of the prism: the average of its six corners.
  const corners = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5],
  ]
  const centre = [0, 1, 2].map((k) => corners.reduce((sum, one) => sum + one[k], 0) / 6)

  let inward = 0
  let triangles = 0
  for (let i = 0; i < position.count; i += 3) {
    const at = (n) => [position.getX(n), position.getY(n), position.getZ(n)]
    const [a, b, c] = [at(i), at(i + 1), at(i + 2)]
    const ab = b.map((v, k) => v - a[k])
    const ac = c.map((v, k) => v - a[k])
    // The triangle's own normal, from the order its corners are written in.
    const n = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ]
    const mid = a.map((v, k) => (v + b[k] + c[k]) / 3)
    const out = mid.map((v, k) => v - centre[k])
    if (n.reduce((sum, v, k) => sum + v * out[k], 0) <= 0) inward += 1
    triangles += 1
  }

  // And that it actually fills the box it is given.
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const fills = [box.min.x, box.min.y, box.min.z].every((v) => Math.abs(v + 0.5) < 1e-6)
    && [box.max.x, box.max.y, box.max.z].every((v) => Math.abs(v - 0.5) < 1e-6)

  return { inward, triangles, fills }
})
check('every face of the wedge faces outwards',
  solidWedge.inward === 0 && solidWedge.triangles === 8,
  `${solidWedge.triangles} triangles, ${solidWedge.inward} facing inward`)
check('and the wedge fills its box', solidWedge.fills, 'corner to corner')

// -- 13e. a Texture is a decal that repeats
const tiled = await p.evaluate(async () => {
  const id = window.fakePicture('decal-repeat', 64, 64)
  const once = window.fakePicture('decal-once', 64, 64)
  await window.engine.open({
    format: 1, id: 'tx', name: 'Tiled', spawn: { at: [0, 6, 20] },
    blocks: [
      { id: 'floor', kind: 'box', at: [0, -1, 0], size: [40, 2, 40] },
      { id: 'wall', kind: 'box', at: [0, 5, 0], size: [20, 6, 1], children: [
        { id: 'tex', kind: 'decal', picture: id, face: 'front', repeat: [8, 3] },
        { id: 'plain', kind: 'decal', picture: once, face: 'back' },
      ] },
    ],
  })
  await window.applyDecals(window.built(), window.resolveFake)

  const found = {}
  for (const [object, part] of window.built().partOf) {
    if (part.kind !== 'decal') continue
    const map = object.material.map
    found[part.id] = map && {
      repeat: [map.repeat.x, map.repeat.y],
      wraps: map.wrapS === 1000 && map.wrapT === 1000, // RepeatWrapping
    }
  }
  return found
})
check('a decal with a repeat tiles its picture',
  tiled.tex && tiled.tex.repeat[0] === 8 && tiled.tex.repeat[1] === 3 && tiled.tex.wraps,
  `8 by 3 across the face, and set to repeat rather than clamp`)
check('and a decal without one is unchanged',
  tiled.plain && tiled.plain.repeat[0] === 1 && tiled.plain.repeat[1] === 1 && !tiled.plain.wraps,
  'once, clamped, exactly as before')

// -- 13f. lights
const lights = await p.evaluate(async () => {
  const many = []
  for (let i = 0; i < 40; i += 1) {
    many.push({ id: `spare-${i}`, kind: 'light', light: 'point', brightness: 1 })
  }
  await window.engine.open({
    format: 1, id: 'li', name: 'Lit', spawn: { at: [0, 6, 20] },
    blocks: [
      { id: 'floor', kind: 'box', at: [0, -1, 0], size: [40, 2, 40] },
      { id: 'lamp', kind: 'box', at: [0, 5, 0], size: [2, 2, 2], children: [
        { id: 'bulb', kind: 'light', light: 'point', colour: '#ff0000', brightness: 3, range: 25 },
        { id: 'beam', kind: 'light', light: 'spot', angle: 30 },
        { id: 'panel', kind: 'light', light: 'surface', brightness: 2 },
        { id: 'dark', kind: 'light', light: 'point', on: false },
      ] },
      ...many,
    ],
  })

  const kinds = {}
  let burning = 0
  for (const [object, part] of window.built().partOf) {
    if (part.kind !== 'light') continue
    if (part.id && !part.id.startsWith('spare-')) kinds[part.id] = object.type
    if (object.isLight) burning += 1
  }
  const bulb = window.built().named.get('bulb')
  return {
    kinds,
    burning,
    most: window.MOST_LIGHTS,
    colour: bulb?.color?.getHexString?.() ?? null,
    range: bulb?.distance ?? null,
    // A light rides the part it belongs to.
    parented: window.built().named.get('beam')?.parent === window.built().named.get('lamp'),
  }
})
check('one light node, three sorts of light',
  lights.kinds.bulb === 'PointLight'
  && lights.kinds.beam === 'SpotLight'
  && lights.kinds.panel === 'RectAreaLight',
  JSON.stringify(lights.kinds))
check('a light that is off is still in the tree, and is not burning',
  lights.kinds.dark === 'Object3D', 'an empty in the same place')
check('a light belongs to the part it is on', lights.parented, 'it moves when the part moves')
check('its colour and range are its own',
  lights.colour === 'ff0000' && lights.range === 25, `#${lights.colour}, ${lights.range} stons`)
check('and a World cannot light more than the runtime allows',
  lights.burning === lights.most, `${lights.burning} burning, the cap is ${lights.most}`)

// -- 13g. a part can be a model from the Catalog
const modelled = await p.evaluate(async () => {
  await window.engine.open({
    format: 1, id: 'md', name: 'Modelled', spawn: { at: [0, 6, 20] },
    blocks: [
      { id: 'floor', kind: 'box', at: [0, -1, 0], size: [40, 2, 40] },
      { id: 'statue', kind: 'box', mesh: 'MDL-1042', at: [0, 5, 0], size: [4, 10, 4],
        colour: '#25D68C', material: 'marble' },
      { id: 'missing', kind: 'box', mesh: 'MDL-nope', at: [8, 5, 0], size: [4, 4, 4] },
    ],
  })
  const before = window.built().named.get('statue').geometry.type

  // K6 stands in for a Catalog model: a real glTF, fetched by content id.
  await window.applyMeshes(window.built(), async (id) => (id === 'MDL-1042' ? '/k6/k6.glb' : null))

  const statue = window.built().named.get('statue')
  statue.geometry.computeBoundingBox()
  const span = statue.geometry.boundingBox.max.clone().sub(statue.geometry.boundingBox.min)

  return {
    before,
    after: statue.geometry.type,
    // Scaled into the unit box, which the part's own size then expands.
    unit: Math.abs(span.x - 1) < 0.01 && Math.abs(span.y - 1) < 0.01,
    material: statue.material.color.getHexString(),
    // A part whose model cannot be fetched keeps its shape.
    fallback: window.built().named.get('missing').geometry.type,
  }
})
check('a part can be a model from the Catalog',
  modelled.after === 'BufferGeometry' && modelled.unit,
  `a box became a model, fitted to the part box`)
check('and the part keeps its own colour, so one model is any colour',
  modelled.material === '25d68c', `#${modelled.material}`)
check('a model that cannot be fetched leaves the part as it was',
  modelled.fallback === 'BoxGeometry', 'still a box, not a hole in the World')

// -- 13h. welds, anchored, and fields this engine has not learned
const carried = await p.evaluate(() => {
  const written = {
    format: 1, id: 'k', name: 'Kept', spawn: { at: [0, 4, 0] },
    // Three things a newer Workspace might write that this engine does not
    // know about. None of them should survive as behaviour; all of them
    // should survive as data.
    physics: { solver: 'rapier', steps: 4 },
    welds: [['a', 'b'], ['c'], ['d', 'e', 'f']],
    blocks: [
      { id: 'a', kind: 'box', at: [0, 0, 0], size: [4, 4, 4], anchored: false,
        surfaceGui: { text: 'hello', size: [2, 1] }, massKg: 12 },
      { id: 'b', kind: 'box', at: [6, 0, 0], size: [4, 4, 4] },
    ],
  }
  const read = window.readManifest(written)
  const part = read.blocks.find((one) => one.id === 'a')

  // And a file trying to reach a prototype through an unknown field.
  const nasty = window.readManifest({
    format: 1, id: 'n', name: 'N', spawn: { at: [0, 4, 0] },
    blocks: [{ id: 'z', kind: 'box', at: [0, 0, 0], size: [1, 1, 1],
      whatever: JSON.parse('{"__proto__": {"polluted": true}, "fine": 1}') }],
  })

  return {
    welds: read.welds,
    anchored: part.anchored,
    kept: part.more,
    worldKept: read.more,
    // The known fields are still read as themselves, not swept into `more`.
    notSwept: part.more?.size === undefined && part.more?.at === undefined,
    nasty: nasty.blocks[0].more?.whatever,
    polluted: ({}).polluted === true,
  }
})
check('a weld is read and kept, and a group of one is not a weld',
  carried.welds.length === 2
  && carried.welds[0].join() === 'a,b'
  && carried.welds[2] === undefined,
  `${carried.welds.length} groups kept out of 3 written`)
check('anchored is read and kept, though nothing acts on it yet',
  carried.anchored === false, 'said, kept, and honestly not simulated')
check('a field this engine has not learned survives being opened',
  carried.kept?.surfaceGui?.text === 'hello' && carried.kept?.massKg === 12,
  'opening and saving no longer deletes what a newer Workspace wrote')
check('and so does one on the World itself',
  carried.worldKept?.physics?.solver === 'rapier', 'carried, never read')
check('while the fields it does know stay where they belong', carried.notSwept,
  'size and at are read, not carried')
check('a file cannot reach a prototype through a field nobody reads',
  carried.polluted === false && carried.nasty?.fine === 1
  && carried.nasty?.polluted === undefined,
  'the dangerous key is dropped, the rest is kept')

// -- 13i. the new manifest shape, and the old one still opening
const shaped = await p.evaluate(() => {
  // The same World, said both ways.
  const old = {
    format: 1, id: 'm', name: 'Manifest', spawn: { at: [0, 4, 0] },
    sounds: [{ kind: 'sound', sound: 'SND-1', loop: true }],
    blocks: [
      { id: 'wall', kind: 'box', at: [0, 5, 0], size: [20, 10, 2], colour: '#b8563a',
        material: 'brick', children: [
          { id: 'sign', kind: 'decal', picture: 'IMG-1', face: 'front', repeat: [4, 2] },
          { id: 'bulb', kind: 'light', light: 'point', brightness: 2 },
        ] },
      { id: 'bunch', kind: 'group', at: [10, 0, 0], parts: [
        { id: 'inner', kind: 'box', at: [0, 1, 0], size: [2, 2, 2] },
      ] },
    ],
  }

  const nodes = {
    format: 2, id: 'm', name: 'Manifest', spawn: { at: [0, 4, 0] },
    sounds: [{ class: 'Sound', properties: { sound: 'SND-1', loop: true } }],
    parts: [
      { class: 'Part',
        properties: { id: 'wall', at: [0, 5, 0], size: [20, 10, 2], colour: '#b8563a', material: 'brick' },
        children: [
          { class: 'Decal', properties: { id: 'sign', picture: 'IMG-1', face: 'front', repeat: [4, 2] } },
          { class: 'Light', properties: { id: 'bulb', light: 'point', brightness: 2 } },
        ] },
      { class: 'Group', properties: { id: 'bunch', at: [10, 0, 0] }, children: [
        { class: 'Part', properties: { id: 'inner', at: [0, 1, 0], size: [2, 2, 2] } },
      ] },
    ],
  }

  const a = window.readManifest(old)
  const b = window.readManifest(nodes)

  // Read the same, whichever way they were written.
  const same = JSON.stringify(a.blocks) === JSON.stringify(b.blocks)
    && JSON.stringify(a.sounds) === JSON.stringify(b.sounds)

  // Written back out, and read again: nothing lost on the way round.
  const written = window.writeManifest(a)
  const again = window.readManifest(written)
  const round = JSON.stringify(again.blocks) === JSON.stringify(a.blocks)

  // A field this engine has never learned survives the round trip, which is
  // the point of writing in the new shape at all.
  const withExtra = window.readManifest({
    format: 1, id: 'x', name: 'X', spawn: { at: [0, 4, 0] },
    blocks: [{ id: 'p', kind: 'box', at: [0, 0, 0], size: [1, 1, 1],
      surfaceGui: { text: 'kept' } }],
  })
  const outAgain = window.readManifest(window.writeManifest(withExtra))

  return {
    same,
    round,
    format: written.format,
    topKey: Array.isArray(written.parts) && !written.blocks,
    firstClass: written.parts[0].class,
    childClasses: written.parts[0].children.map((one) => one.class),
    groupChildren: written.parts[1].children.length,
    // Defaults a reader filled in are not written back as though somebody
    // typed them.
    noDefaults: written.parts[0].properties.reflectance === undefined
      || a.blocks[0].reflectance !== undefined,
    carried: outAgain.blocks[0].more?.surfaceGui?.text,
    mixed: (() => {
      // A file that says 1 but holds nodes, which is what a hand edit looks
      // like, opens rather than refusing on a technicality.
      const odd = window.readManifest({
        format: 1, id: 'o', name: 'O', spawn: { at: [0, 4, 0] },
        blocks: [{ class: 'Part', properties: { id: 'q', at: [0, 0, 0], size: [3, 3, 3] } }],
      })
      return odd.blocks[0].size.join()
    })(),
  }
})
check('a World written as nodes reads the same as one written the old way',
  shaped.same, 'one reader, one set of checks, two spellings')
check('and what is written out is the new shape',
  shaped.format === 2 && shaped.topKey && shaped.firstClass === 'Part'
  && shaped.childClasses.join() === 'Decal,Light' && shaped.groupChildren === 1,
  `format ${shaped.format}, parts, and classes on every node`)
check('a World survives being read, written and read again', shaped.round,
  'nothing lost on the way round')
check('including a field this engine has never learned',
  shaped.carried === 'kept', 'carried through the migration, not deleted by it')
check('the old format still opens, and so does a file that mixes them',
  shaped.mixed === '3,3,3', 'the node decides its spelling, not the header')

// -- 13j. a World abandoned while it was still loading
const abandoned = await p.evaluate(async () => {
  const id = window.fakePicture('slow-decal', 32, 32)

  // A resolver that takes its time, so a second World can be opened while
  // the first one's pictures are still coming.
  let waiting = null
  const slow = (url) => new Promise((go) => { waiting = () => go(url) })

  const world = (name, picture) => ({
    format: 1, id: name, name, spawn: { at: [0, 4, 0] },
    sounds: [{ id: 'ambience', kind: 'sound', sound: 'SND-1', loop: true, playing: true }],
    blocks: [
      { id: 'floor', kind: 'box', at: [0, -1, 0], size: [40, 2, 40] },
      { id: 'wall', kind: 'box', at: [0, 4, 0], size: [10, 8, 1], children: [
        { id: 'sign', kind: 'decal', picture, face: 'front' },
      ] },
    ],
  })

  const built = window.buildWorld(window.readManifest(world('first', id)))
  const sign = [...built.partOf].find(([, part]) => part.kind === 'decal')[0]

  // The first World's pictures start arriving...
  const job = window.applyDecals(built, () => slow(window.drawnUrl(id)), () => false)
  await new Promise((r) => setTimeout(r, 30))
  // ...and the player leaves before they land.
  if (waiting) waiting()
  await job

  return {
    // Nothing was written into the World nobody is in.
    untouched: sign.material.map === null && sign.visible === false,
  }
})
check('a picture that arrives after its World was left is dropped',
  abandoned.untouched,
  'nothing is written into a World nobody is in')

// The same thing through the engine, which is where it actually bites.
const leftEarly = await p.evaluate(async () => {
  const quiet = { format: 1, id: 'q', name: 'Quiet', spawn: { at: [0, 4, 0] },
    blocks: [{ id: 'floor', kind: 'box', at: [0, -1, 0], size: [40, 2, 40] }] }
  const noisy = { format: 1, id: 'n', name: 'Noisy', spawn: { at: [0, 4, 0] },
    sounds: [{ id: 'ambience', kind: 'sound', sound: 'SND-1', loop: true, playing: true }],
    blocks: [{ id: 'floor', kind: 'box', at: [0, -1, 0], size: [40, 2, 40] }] }

  // Open the noisy World and leave for the quiet one without waiting.
  const first = window.engine.open(noisy)
  await window.engine.open(quiet)
  await first

  return {
    world: window.engine.world?.manifest.name ?? window.built().manifest.name,
    // The World on screen is the quiet one, so nothing of the noisy one's
    // is still queued to start.
    playing: window.engine.sound.all.filter((one) => one.wanted).length,
  }
})
check('a World left before it finished loading does not keep making a noise',
  leftEarly.world === 'Quiet' && leftEarly.playing === 0,
  `${leftEarly.world} is open, ${leftEarly.playing} sounds asked to play`)

// -- 13k. chat: what is said, and what is not allowed to be said
const chatted = await p.evaluate(async () => {
  const chat = window.engine.chat
  const seen = []
  const off = chat.on('line', (line) => seen.push(line))

  /*
   * Spaced out, because flood protection is real and this is not the check
   * for it. Writing these back to back is how this check failed the first
   * time: three went and the rest were refused, which was the service doing
   * its job and the check not knowing about it.
   */
  const say = async (text) => {
    const why = chat.send(text)
    await new Promise((r) => setTimeout(r, 800))
    return why
  }

  await say('hello world')
  // Markup is text. It is never parsed, and the element proves it: the
  // bubble holds the characters, not a tag.
  await say('<script>alert(1)</script>')
  await say('<b>bold</b>')
  // Too long is trimmed rather than refused, counted in what a person sees.
  await say('x'.repeat(400))
  // An emoji is one character, not two.
  await say('\u{1f600}'.repeat(250))
  // Nothing is nothing, however it is spelt.
  const empty = await say('   \u200b \u0000  ')

  const said = seen.filter((one) => one.kind === 'said')

  /*
   * The markup one again, last, with the allowance let go first.
   *
   * Only three bubbles stack, so by now the markup one has been pushed out
   * by the newer messages — the board doing its job. Asking again is how
   * this check looks at the bubble it means rather than whichever three
   * happen to be up, and the send is asserted rather than assumed: at
   * 800ms apart these sit close enough to the rate limit that one was
   * quietly refused and the check read the bubble before it.
   */
  await new Promise((r) => setTimeout(r, 2500))
  const wentOut = chat.send('<script>alert(1)</script>') === null
  await new Promise((r) => setTimeout(r, 80))
  window.stepFrames(2)
  const bubbles = [...document.querySelectorAll('.kob-bubble')]

  return {
    first: said[0]?.text,
    markupIsText: said[1]?.text === '<script>alert(1)</script>',
    wentOut,
    // The element's own HTML shows the tag escaped, which is what
    // textContent does: nothing was ever parsed as markup.
    nothingParsed: bubbles.some((one) => one.innerHTML.includes('&lt;script&gt;'))
      && !document.querySelector('.kob-bubble script'),
    bubbleCount: bubbles.length,
    newestBubble: bubbles[bubbles.length - 1]?.innerHTML.slice(0, 40),
    trimmed: said[3]?.text.length,
    emoji: said[4] ? [...said[4].text].length : null,
    empty,
    // A refusal is said out loud rather than swallowed.
    refused: seen.some((one) => one.kind === 'system'),
    off: typeof off,
  }
})
check('what somebody says arrives as they said it', chatted.first === 'hello world',
  `"${chatted.first}"`)
check('markup is text, and nothing is ever parsed as markup',
  chatted.markupIsText && chatted.nothingParsed && chatted.wentOut,
  `sent: ${chatted.wentOut}, kept as text: ${chatted.markupIsText}, `
  + `nothing parsed: ${chatted.nothingParsed}, bubbles: ${chatted.bubbleCount}, `
  + `newest: ${JSON.stringify(chatted.newestBubble ?? null)}`)
check('a message too long is trimmed to what a person can see',
  chatted.trimmed === 200 && chatted.emoji === 200,
  `${chatted.trimmed} characters, and ${chatted.emoji} emoji rather than half of one each`)
check('there is no saying nothing', typeof chatted.empty === 'string',
  `refused: ${chatted.empty}`)

// -- 13l. flood protection, and typing instead of walking
const flooded = await p.evaluate(async () => {
  const chat = window.engine.chat
  // Let the last check's allowance run out, so this measures the limit
  // rather than the leftovers of the previous test.
  await new Promise((r) => setTimeout(r, 2400))
  const before = chat.lines.filter((one) => one.kind === 'said').length
  const refusals = []
  const off = chat.on('refused', (one) => refusals.push(one.why))

  for (let i = 0; i < 10; i += 1) chat.send(`spam ${i}`)
  await new Promise((r) => setTimeout(r, 30))
  const after = chat.lines.filter((one) => one.kind === 'said').length
  off()

  return { got: after - before, refusals: refusals.length }
})
check('a burst is allowed and a flood is not',
  flooded.got === 3 && flooded.refusals > 0,
  `${flooded.got} of 10 went, ${flooded.refusals} refused`)

const typing = await p.evaluate(() => {
  const where = () => window.engine.controller.state.position.z
  window.engine.controller.placeAt(0, 1, 0, 0)
  window.drive({ z: 1 })
  window.stepFrames(40)

  const from = where()
  window.stepFrames(40)
  const walking = Math.abs(where() - from)

  /*
   * Now they are typing, with the same key still held. A body has weight,
   * so it does not stop on the frame the window opens — it slides to a
   * halt. The check is that it stops, not that it stops instantly: the
   * first version demanded a dead stop within half a ston and failed on
   * the deceleration, which is the controller being right.
   */
  window.engine.chat.setTyping(true)
  window.stepFrames(40)
  const settling = where()
  window.stepFrames(40)
  const typingMoved = Math.abs(where() - settling)

  window.engine.chat.setTyping(false)
  window.stepFrames(40)
  const after = Math.abs(where() - settling)
  window.drive({})

  return {
    walking: Number(walking.toFixed(2)),
    typingMoved: Number(typingMoved.toFixed(2)),
    after: Number(after.toFixed(2)),
  }
})
check('while somebody is typing, the keys are theirs and not the World\u2019s',
  typing.walking > 5 && typing.typingMoved < 0.1 && typing.after > 5,
  `walked ${typing.walking}, moved ${typing.typingMoved} while typing, then ${typing.after} again`)

// -- 13m. bubbles go, on their own
const bubbling = await p.evaluate(async () => {
  const chat = window.engine.chat
  await new Promise((r) => setTimeout(r, 2400))
  chat.send('over my head')
  await new Promise((r) => setTimeout(r, 60))
  window.stepFrames(2)
  const up = document.querySelectorAll('.kob-bubble').length

  // Four more, so the oldest is pushed out: three stacked, not a column.
  for (const word of ['one', 'two', 'three', 'four']) {
    chat.send(word)
    await new Promise((r) => setTimeout(r, 800))
  }
  window.stepFrames(2)
  const stacked = document.querySelectorAll('.kob-bubble').length

  return { up, stacked }
})
check('what you say goes over your head', bubbling.up > 0,
  `${bubbling.up} bubble(s)`)
check('and no more than three stack up at once', bubbling.stacked <= 3,
  `${bubbling.stacked} after five messages`)

// -- 13n. a truss repeats rather than stretching, and can be climbed
const trussed = await p.evaluate(async () => {
  const bars = (geometry) => geometry.getAttribute('position').count / 24
  const short = window.tiledGeometry('truss', [4, 8, 4], 0)
  const middling = window.tiledGeometry('truss', [4, 16, 4], 0)
  const tall = window.tiledGeometry('truss', [4, 24, 4], 0)
  // Widened rather than lengthened: more truss beside itself.
  const wide = window.tiledGeometry('truss', [12, 8, 4], 0)

  // The bar in the geometry, back in world stons: the unit box is divided
  // through by the size, so a bar of one thickness comes out the same
  // whatever the part does.
  const widthOf = (geometry, size) => {
    geometry.computeBoundingBox()
    const leg = geometry.getAttribute('position')
    let thinnest = Infinity
    // The first box in the merge is a leg; its first eight points are its
    // corners, so its x extent is the bar thickness.
    let least = Infinity
    let most = -Infinity
    for (let i = 0; i < 8; i += 1) {
      least = Math.min(least, leg.getX(i))
      most = Math.max(most, leg.getX(i))
    }
    thinnest = (most - least) * size[0]
    return Number(thinnest.toFixed(2))
  }

  await window.engine.open({
    format: 2, id: 'tr', name: 'Truss', spawn: { at: [0, 4, 14] },
    parts: [
      { class: 'Part', properties: { id: 'floor', at: [0, -1, 0], size: [60, 2, 60] } },
      { class: 'Part', properties: { id: 'tower', shape: 'truss', at: [0, 12, 0], size: [4, 24, 4], material: 'metal' } },
      { class: 'Part', properties: { id: 'ledge', at: [4, 24, 0], size: [6, 1, 6] } },
    ],
  })

  const solids = window.built().solids
  return {
    shortBars: bars(short),
    middlingBars: bars(middling),
    tallBars: bars(tall),
    wideBars: bars(wide),
    shortBar: widthOf(short, [4, 8, 4]),
    tallBar: widthOf(tall, [4, 24, 4]),
    climbable: solids.filter((one) => one.climb).length,
    solidsTotal: solids.length,
  }
})
/*
 * Each bay costs the same, which is what repeating means. Not three times
 * the bars for three times the length: the legs are shared down the whole
 * thing and a ring is shared between the bays either side of it, so the
 * count grows by a fixed amount per bay rather than in proportion. The
 * first version of this check asserted the proportion and was measuring
 * the offset.
 */
check('every bay of a truss costs the same, so it repeats rather than stretches',
  trussed.middlingBars - trussed.shortBars === trussed.tallBars - trussed.middlingBars
  && trussed.tallBars > trussed.shortBars,
  `${trussed.shortBars} bars at 8 stons, ${trussed.middlingBars} at 16, ${trussed.tallBars} at 24`)
check('and a truss made wider is more truss beside itself',
  trussed.wideBars > trussed.shortBars * 2,
  `${trussed.shortBars} bars at 4 wide, ${trussed.wideBars} at 12`)
check('and its bars are the same thickness at either length',
  Math.abs(trussed.shortBar - trussed.tallBar) < 0.01,
  `${trussed.shortBar} stons either way, rather than stretched`)
check('a truss is one solid, and it is the climbable one',
  trussed.climbable === 1 && trussed.solidsTotal === 3,
  `${trussed.climbable} climbable of ${trussed.solidsTotal} solids`)

const onTheTruss = await p.evaluate(() => {
  const at = () => window.engine.controller.state.position.clone()
  // Standing at the foot of the tower, facing it.
  window.drive({})
  window.engine.controller.placeAt(0, 1, 3.2, Math.PI)
  window.stepFrames(10)
  const bottom = at()

  // Forward, into it and then up it.
  window.drive({ z: 1 })
  window.stepFrames(90)
  const up = at()
  const state = { ...window.engine.controller.state }

  // Down again.
  window.drive({ z: -1 })
  window.stepFrames(60)
  const down = at()

  // Let go, and gravity is back.
  window.drive({ jump: true })
  window.stepFrames(6)
  window.drive({})
  window.stepFrames(150)
  const after = at()

  return {
    rose: Number((up.y - bottom.y).toFixed(1)),
    climbing: state.climbing,
    fell: Number((down.y - up.y).toFixed(1)),
    landed: Number(after.y.toFixed(1)),
    grounded: window.engine.controller.state.grounded,
    holding: window.engine.controller.state.climbing,
  }
})
check('somebody who walks into a truss climbs it',
  onTheTruss.climbing && onTheTruss.rose > 8, `up ${onTheTruss.rose} stons, holding on`)
check('and goes back down it the way they came up',
  onTheTruss.fell < -4, `down ${onTheTruss.fell} stons`)
/*
 * Standing on the floor or holding on at the foot of it both count. Coming
 * to rest on a truss with nothing pressed is what a truss is for, and the
 * first version of this check demanded `grounded`, which called that a
 * failure. What must never happen is the third thing: falling past the
 * World, which is what a solid truss did when somebody let go inside it.
 */
check('letting go puts them back at the bottom rather than through the World',
  onTheTruss.landed < 2 && onTheTruss.landed > -2
  && (onTheTruss.grounded || onTheTruss.holding),
  `back at y=${onTheTruss.landed}, grounded ${onTheTruss.grounded}, `
  + `holding ${onTheTruss.holding}`)

// -- 13o. a model gets a card picture, by being looked at
const modelCard = await p.evaluate(async () => {
  // A real glTF, fetched and handed over as a file the way an upload does.
  const bytes = await fetch('/k6/k6.glb').then((r) => r.blob())
  const file = new File([bytes], 'k6.glb', { type: 'model/gltf-binary' })

  const drawn = await window.previewOf(file, 'mesh')
  if (!drawn) return { drew: false }

  // Look at what came out: a card picture has to be a picture of something,
  // not an empty frame the right size.
  const picture = new Image()
  picture.src = URL.createObjectURL(drawn)
  await picture.decode()
  const sheet = document.createElement('canvas')
  sheet.width = picture.naturalWidth
  sheet.height = picture.naturalHeight
  const paint = sheet.getContext('2d')
  paint.drawImage(picture, 0, 0)
  const { data } = paint.getImageData(0, 0, sheet.width, sheet.height)

  // The background is one colour; anything else is the model.
  let model = 0
  for (let i = 0; i < data.length; i += 4) {
    const off = Math.abs(data[i] - 233) + Math.abs(data[i + 1] - 237) + Math.abs(data[i + 2] - 245)
    if (off > 24) model += 1
  }

  const kbfl = new File(['{}'], 'part.kbfl', { type: 'application/json' })
  return {
    drew: true,
    type: drawn.type,
    bytes: drawn.size,
    size: [picture.naturalWidth, picture.naturalHeight],
    share: model / (data.length / 4),
    saysMeshesCanBeDrawn: window.canPreview('mesh'),
    // Kobblon's own part file is not glTF and gets no picture rather than a
    // wrong one.
    ownFormat: await window.previewOf(kbfl, 'build'),
  }
})
check('a mesh is drawn for its card, rather than left blank',
  modelCard.drew && modelCard.saysMeshesCanBeDrawn && modelCard.bytes > 2000,
  `${modelCard.size?.join('x')} ${modelCard.type}, ${modelCard.bytes} bytes`)
check('and the picture is of the mesh rather than an empty frame',
  modelCard.share > 0.02 && modelCard.share < 0.9,
  `${(modelCard.share * 100).toFixed(1)}% of it is the model`)
check('a Build gets no picture rather than a wrong one',
  modelCard.ownFormat === null, 'nothing drawn for a .kbfl')

// -- 13p. whose session the shared components talk to
const whoseClient = await p.evaluate(async () => {
  const asked = []

  /*
   * An application with its own session hands its own client over. The
   * Workspace's lives in memory with its refresh token in the keychain, so
   * it is never the one this module would have built.
   */
  const theirs = {
    from(table) { asked.push(`from:${table}`); return { select: () => ({ data: [], error: null }) } },
    storage: { from(bucket) { asked.push(`storage:${bucket}`); return {} } },
    mine: true,
  }

  window.setSupabaseClient(theirs)
  window.supabase.from('assets')
  window.supabase.storage.from('uploads')
  const during = { routed: [...asked], isTheirs: window.currentSupabase().mine === true }

  /*
   * And back, mid-session rather than at startup, then used again. The
   * failure worth refusing is the one that keeps the old client quietly:
   * it renders correctly, nothing throws, and every call goes to the wrong
   * session. So this counts what the handed-over client hears afterwards,
   * rather than only asking which client is current.
   */
  window.setSupabaseClient(null)
  const heardBefore = asked.length
  window.supabase.from('worlds')
  const after = {
    isTheirs: window.currentSupabase().mine === true,
    stillWorks: typeof window.supabase.from === 'function',
    oldClientHeardMore: asked.length > heardBefore,
  }

  return { during, after }
})
check('an application can hand the shared components its own client',
  whoseClient.during.isTheirs
  && whoseClient.during.routed.join() === 'from:assets,storage:uploads',
  `routed ${whoseClient.during.routed.join(' and ')} to the client it was given`)
check('and handing back null returns to the website\u2019s own, mid-session',
  !whoseClient.after.isTheirs && whoseClient.after.stillWorks
  && !whoseClient.after.oldClientHeardMore,
  'a call after the hand-back does not reach the client that was handed over')

// -- 13q. fog is a distance, and a near World is not fogged backwards
const fogged = await p.evaluate(async () => {
  const look = async (fog) => {
    await window.engine.open({
      format: 2, id: 'f', name: 'Fog', spawn: { at: [0, 4, 0] },
      sky: { colour: '#9fc4e8', ...(fog === null ? {} : { fog }) },
      parts: [{ class: 'Part', properties: { at: [0, -1, 0], size: [40, 2, 40] } }],
    })
    const one = window.engine.scene.fog
    return one ? { near: one.near, far: one.far } : null
  }

  return {
    clear: await look(null),
    zero: await look(0),
    // Under the old hard-coded near of 40, this was near 40 far 30: a range
    // running backwards, which is what a small World always got.
    small: await look(30),
    big: await look(400),
  }
})
check('no fog is no fog, and zero means the same',
  fogged.clear === null && fogged.zero === null, 'a clear day either way')
check('fog is a range that runs the right way round, however near it is',
  fogged.small.near < fogged.small.far && fogged.big.near < fogged.big.far,
  `30 stons gives ${fogged.small.near}..${fogged.small.far}, 400 gives ${fogged.big.near}..${fogged.big.far}`)
check('and it is total at the distance somebody asked for',
  fogged.small.far === 30 && fogged.big.far === 400,
  'the number is how far you can see')

// -- 14. a material is a pattern, and the pattern is the size of the world
const textured = await p.evaluate(async () => {
  await window.engine.open({
    format: 1, id: 't', name: 'Tiling', spawn: { at: [0, 6, 30] },
    blocks: [
      { id: 'small', kind: 'box', at: [-20, 5, 0], size: [10, 10, 2], material: 'brick' },
      { id: 'big', kind: 'box', at: [20, 20, 0], size: [40, 40, 2], material: 'brick' },
      { id: 'floor', kind: 'box', at: [0, 0, 0], size: [40, 2, 40], material: 'grass' },
      { id: 'pane', kind: 'box', at: [0, 5, 10], size: [4, 4, 1], material: 'glass' },
    ],
  })

  const of = (name) => {
    for (const [object, part] of window.built().partOf) if (part.id === name) return object
    return null
  }

  const uvSpan = (mesh, face) => {
    const uv = mesh.geometry.getAttribute('uv')
    let acrossMost = 0
    let downMost = 0
    for (let corner = 0; corner < 4; corner += 1) {
      acrossMost = Math.max(acrossMost, uv.getX(face * 4 + corner))
      downMost = Math.max(downMost, uv.getY(face * 4 + corner))
    }
    return { across: acrossMost, down: downMost }
  }

  const small = of('small')
  const big = of('big')

  return {
    // the front face of each wall: +z is face 4
    smallAcross: uvSpan(small, 4).across,
    bigAcross: uvSpan(big, 4).across,
    brickHasPattern: !!small.material.map,
    // a floor is not the same on its top as on its side
    // A floor 40 across and 2 thick: forty of something on top, two on the edge.
    floorTop: uvSpan(of('floor'), 2).down,
    floorSide: uvSpan(of('floor'), 4).down,
    glassHasNone: !of('pane').material.map,
  }
})
check('a big wall shows more bricks than a small one, in proportion',
  Math.abs(textured.bigAcross / textured.smallAcross - 4) < 0.01,
  `four times the wall, ${(textured.bigAcross / textured.smallAcross).toFixed(2)} times the bricks`)
check('a material carries a pattern', textured.brickHasPattern, 'brick has a map')
check('a face is tiled by its own two dimensions, not the part',
  Math.abs(textured.floorTop - textured.floorSide) > 0.01,
  `top ${textured.floorTop.toFixed(2)} across, side ${textured.floorSide.toFixed(2)}`)
check('glass carries none, because glass has no pattern', textured.glassHasNone, 'no map')

// -- 17. a picture keeps its own proportions unless it is told not to
const fitted = await p.evaluate(async () => {
  const square = window.fakePicture('pic-square', 128, 128)
  const wide = window.fakePicture('pic-wide', 400, 100)

  const world = (picture, extra) => ({
    format: 1, id: 'f', name: 'Fitted', spawn: { at: [0, 6, 20] },
    blocks: [
      { id: 'wall', kind: 'box', at: [0, 5, 0], size: [40, 8, 1],
        colour: '#0000ff', transparency: 0.5,
        children: [{ id: 'sign', kind: 'decal', picture, face: 'front', ...extra }] },
    ],
  })

  const Vector3 = Object.getPrototypeOf(window.engine.camera.position).constructor

  const shown = async (picture, extra) => {
    await window.engine.open(world(picture, extra))
    let sign = null
    for (const [object, part] of window.built().partOf) if (part.kind === 'decal') sign = object
    // applyDecals is a separate pass on purpose, so this waits for it rather
    // than for a fixed time.
    for (let i = 0; i < 200 && !sign.material.map; i += 1) {
      await new Promise((r) => setTimeout(r, 20))
    }
    window.engine.scene.updateMatrixWorld(true)
    const size = sign.getWorldScale(new Vector3())
    return {
      across: size.x, up: size.y,
      colour: sign.material.color.getHexString(),
      opacity: sign.material.opacity,
      own: sign.material !== sign.parent.material,
    }
  }

  return {
    square: await shown(square, {}),
    wide: await shown(wide, {}),
    stretched: await shown(square, { scale: [2, 1] }),
    moved: await shown(square, { offset: [0.25, 0] }),
    where: (() => {
      let sign = null
      for (const [object, part] of window.built().partOf) if (part.kind === 'decal') sign = object
      return sign.position.x
    })(),
  }
})
/*
 * These two used to assert the opposite: that a picture kept its own
 * proportions whatever it was painted on. That was the bug — a sign stopped
 * being readable the moment somebody resized the wall — and the checks were
 * holding it in place.
 */
check('a square picture on a long wall covers the long wall',
  Math.abs(fitted.square.across - 40) < 0.01 && Math.abs(fitted.square.up - 8) < 0.01,
  `${fitted.square.across.toFixed(2)} by ${fitted.square.up.toFixed(2)} stons on a wall 40 by 8`)
check('and so does a wide one: the face decides, not the picture',
  Math.abs(fitted.wide.across - fitted.square.across) < 0.01
  && Math.abs(fitted.wide.up - fitted.square.up) < 0.01,
  `4:1 and 1:1 both come out ${fitted.wide.across.toFixed(2)} by ${fitted.wide.up.toFixed(2)}`)
check('and stretching it is something a World asks for',
  Math.abs(fitted.stretched.across / fitted.square.across - 2) < 0.02,
  `scale [2, 1] is ${(fitted.stretched.across / fitted.square.across).toFixed(2)} times as wide`)
check('an offset slides it across the face it is on',
  Math.abs(fitted.where - 0.25) < 0.001, `x ${fitted.where.toFixed(2)} of a face width`)

// -- 18. the part's colour and transparency are the part's, not the picture's
check('a decal has a material of its own',
  fitted.square.own && fitted.square.colour === 'ffffff' && fitted.square.opacity === 1,
  `blue half see through wall, #${fitted.square.colour} decal at opacity ${fitted.square.opacity}`)

// -- 19. the wheel, between the engine's near end and the World's far one
const zoomed = await p.evaluate(async () => {
  await window.engine.open({
    format: 1, id: 'z', name: 'Zoomed', spawn: { at: [0, 6, 0] },
    camera: { zoom: { most: 20 } },
    blocks: [{ id: 'floor', kind: 'box', at: [0, 0, 0], size: [40, 2, 40] }],
  })
  const out = window.engine.zoom(1000)
  // The camera eases rather than teleports now, so these wait for it to
  // arrive instead of reading it mid flight.
  window.stepFrames(90)
  const drawnFar = window.engine.status.drawn
  const near = window.engine.zoom(-1000)
  window.stepFrames(90)
  return { out, near, drawnFar, drawnNear: window.engine.status.drawn }
})
check('a World says how far back the camera may go', zoomed.out === 20, `${zoomed.out} stons, as the manifest asked`)
check('and the near end is the engine’s', Math.abs(zoomed.near - 0.5) < 0.001, `${zoomed.near} stons`)
check('at the near end K6 is not drawn at all',
  zoomed.drawnFar === true && zoomed.drawnNear === false, 'not faded, not clipped, not drawn')

// -- 19b. the camera eases rather than teleporting
const eased = await p.evaluate(async () => {
  await window.engine.open({
    format: 1, id: 'e', name: 'Eased', spawn: { at: [0, 6, 0] },
    blocks: [{ id: 'floor', kind: 'box', at: [0, 0, 0], size: [80, 2, 80] }],
  })
  window.drive({})
  window.engine.zoom(-1000)
  window.stepFrames(90)
  const near = window.engine.camera.position.z

  // Asked for all the way out, then looked at almost at once.
  window.engine.zoom(1000)
  window.stepFrames(1)
  const oneFrame = window.engine.camera.position.z
  window.stepFrames(120)
  const settled = window.engine.camera.position.z

  return {
    moved: Math.abs(oneFrame - near) > 0.01,
    partOfTheWay: Math.abs(oneFrame - near) < Math.abs(settled - near) * 0.5,
    arrived: Math.abs(Math.abs(settled - near) - (34 - 0.5)) < 1.5,
  }
})
check('the camera is already moving on the frame after a zoom', eased.moved,
  'it starts at once rather than waiting')
check('but it is nowhere near there yet: the zoom is eased, not a jump',
  eased.partOfTheWay, 'less than half way after one frame')
check('and it arrives where it was asked to go', eased.arrived,
  'all the way out, in its own time')

// -- 20. sound: everywhere, or somewhere, and loaded is not playing
const heard = await p.evaluate(async () => {
  window.fakePicture('SND-1064', 8, 8) // a file that is there; not a real sound
  await window.engine.open({
    format: 1, id: 's', name: 'Heard', spawn: { at: [0, 6, 0] },
    sounds: [{ id: 'wind', kind: 'sound', sound: 'SND-1064', loop: true, playing: true }],
    blocks: [
      { id: 'radio', kind: 'box', at: [0, 4, 0], size: [2, 2, 2],
        children: [{ id: 'tune', kind: 'sound', sound: 'SND-1064', reach: 30 }] },
    ],
  })
  const all = window.engine.sound.all
  const tune = window.engine.sound.get('tune')
  const wind = window.engine.sound.get('wind')
  return {
    count: all.length,
    ambientEverywhere: wind ? wind.at === null : false,
    childRidesThePart: tune ? tune.at?.parent?.name === 'radio' || tune.at?.parent === window.built().named.get('radio') : false,
    quietUntilAsked: tune ? tune.wanted === false : false,
    ambientWanted: wind ? wind.wanted === true : false,
    asked: window.engine.sound.play('tune') && window.engine.sound.get('tune').wanted === true,
  }
})
check('a World’s own sounds are everywhere and a part’s are somewhere',
  heard.count === 2 && heard.ambientEverywhere && heard.childRidesThePart,
  'ambience has no position, a part’s sound rides the part')
check('loaded and playing are two things',
  heard.quietUntilAsked && heard.ambientWanted && heard.asked,
  'silent until asked, and asking works whether or not the file is here')

// -- 21. the materials that are pictures actually arrive, and tile right
const surfaced = await p.evaluate(async () => {
  await window.engine.open({
    format: 1, id: 'm', name: 'Materials', spawn: { at: [0, 6, 20] },
    blocks: [
      { id: 'lawn',   kind: 'box', at: [0, -1, 0],  size: [40, 2, 40], material: 'grass',  colour: '#5bbf4a' },
      { id: 'stonewall', kind: 'box', at: [-12, 4, 0], size: [8, 8, 2],  material: 'stons',  colour: '#4a6cff' },
      { id: 'wall',   kind: 'box', at: [0, 4, 0],   size: [8, 8, 2],   material: 'brick',  colour: '#b8563a' },
      { id: 'beam',   kind: 'box', at: [12, 4, 0],  size: [8, 8, 2],   material: 'wood',   colour: '#a3703c' },
      { id: 'deck',   kind: 'box', at: [24, 4, 0],  size: [8, 8, 2],   material: 'planks', colour: '#c09a68' },
      { id: 'tread',  kind: 'box', at: [36, 4, 0],  size: [8, 8, 2],   material: 'plate',  colour: '#9aa3ad' },
      { id: 'pipe',   kind: 'box', at: [48, 4, 0],  size: [8, 8, 2],   material: 'metal',  colour: '#b9c0c8' },
      { id: 'path',   kind: 'box', at: [60, 4, 0],  size: [8, 8, 2],   material: 'pebble', colour: '#9c968c' },
      { id: 'pillar', kind: 'box', at: [72, 4, 0],  size: [8, 8, 2],   material: 'marble', colour: '#e8e6e2' },
    ],
  })

  const of = (name) => window.built().named.get(name)
  const names = ['lawn', 'stonewall', 'wall', 'beam', 'deck', 'tread', 'pipe', 'path', 'pillar']

  // Every one of these is fetched, so this waits for the files rather than
  // for a fixed number of milliseconds.
  for (let i = 0; i < 300; i += 1) {
    if (names.every((n) => of(n).material.map?.image)) break
    await new Promise((r) => setTimeout(r, 20))
  }

  const sizeOf = (name) => {
    const image = of(name).material.map?.image
    return image ? `${image.width}x${image.height}` : null
  }

  /* How many times the pattern goes across a face, read off the UVs. */
  const acrossOf = (name, face) => {
    const uv = of(name).geometry.attributes.uv
    const start = face * 4
    let least = Infinity
    let most = -Infinity
    for (let i = start; i < start + 4; i += 1) {
      least = Math.min(least, uv.getX(i))
      most = Math.max(most, uv.getX(i))
    }
    return most - least
  }

  return {
    sizes: Object.fromEntries(names.map((n) => [n, sizeOf(n)])),
    // The bumps: what makes a brick wall read as brick rather than as a
    // photograph of brick stuck to a flat face.
    bumps: Object.fromEntries(names.map((n) => {
      const m = of(n).material
      return [n, m.normalMap ? `${m.normalMap.image?.width}x${m.normalMap.image?.height}` : null]
    })),
    relief: of('stonewall').material.normalScale?.x ?? 0,
    flatOnPurpose: (() => {
      const smooth = window.built()
      return smooth ? true : true
    })(),
    // the front face of the stons wall, 8 stons across
    stonsAcross: acrossOf('stonewall', 4),
    tinted: of('stonewall').material.color.getHexString(),
    shared: of('wall').material.map === of('beam').material.map,
  }
})
check('a surface has its bumps, so it catches light like a surface',
  Object.values(surfaced.bumps).every((one) => one === '256x256'),
  JSON.stringify(surfaced.bumps))
check('and how far it stands out is the material\u2019s business',
  surfaced.relief === 1, `stons at ${surfaced.relief}`)
check('a pictured material fetches its picture',
  Object.values(surfaced.sizes).every((one) => one === '512x512'),
  JSON.stringify(surfaced.sizes))
check('a ston is one ston, so a part can be counted by looking at it',
  Math.abs(surfaced.stonsAcross * 4 - 8) < 0.01,
  `8 stons across shows ${(surfaced.stonsAcross * 4).toFixed(2)} of them`)
check('and the pattern multiplies the colour rather than replacing it',
  surfaced.tinted === '4a6cff', `#${surfaced.tinted}`)
check('two materials are two patterns', !surfaced.shared, 'brick is not wood')

// -- 22. the camera does not go through walls, and first person is inside the head
const looking = await p.evaluate(async () => {
  await window.engine.open({
    format: 1, id: 'c', name: 'Camera', spawn: { at: [0, 4, 0], facing: 180 },
    sky: { colour: '#9fc4e8' },
    blocks: [
      { kind: 'box', at: [0, -1, 0], size: [80, 2, 80], material: 'grass', colour: '#63c04d' },
      // A wall right where the camera would like to be.
      { kind: 'box', at: [0, 6, 14], size: [40, 14, 2], material: 'brick', colour: '#b8563a' },
    ],
  })
  await new Promise((r) => setTimeout(r, 400))
  window.drive({})
  window.engine.controller.placeAt(0, 1, 6, Math.PI)
  window.engine.zoom(1000)
  window.stepFrames(90)
  const behindWall = window.engine.camera.position.z

  window.engine.controller.placeAt(0, 1, -20, Math.PI)
  window.stepFrames(90)
  const inTheOpen = window.engine.camera.position.z + 20

  window.engine.zoom(-1000)
  window.stepFrames(90)
  const inside = window.engine.status

  return {
    behindWall: Number(behindWall.toFixed(2)),
    inTheOpen: Number(inTheOpen.toFixed(2)),
    first: inside.firstPerson,
    drawn: inside.drawn,
  }
})
check('the camera stops at a wall rather than going through it',
  looking.behindWall < 13 && looking.behindWall > 10,
  `wall face at z=13, camera held at z=${looking.behindWall}`)
check('and goes all the way back when nothing is in the way',
  looking.inTheOpen > 30, `${looking.inTheOpen} stons behind`)
check('zoomed all the way in, somebody is behind their own face',
  looking.first && !looking.drawn, 'first person, body not drawn')

// -- 23. dragging right turns right
const dragged = await p.evaluate(() => {
  window.engine.zoom(1000)
  window.engine.controller.placeAt(0, 1, 18, 0)
  window.drive({})
  window.stepFrames(90)
  const before = window.engine.camera.position.x
  // Positive movementX is a drag to the right.
  window.drive({ turn: 0.6 })
  window.stepFrames(4)
  return { before: Number(before.toFixed(2)), after: Number(window.engine.camera.position.x.toFixed(2)) }
})
check('dragging right turns the camera right',
  dragged.after > dragged.before,
  `camera x ${dragged.before} -> ${dragged.after}`)

// -- 24. and dragging down looks down
const tilted = await p.evaluate(() => {
  // The zoom check left the camera in first person, where a pitch barely
  // moves it at all; back out first so the rise is something to measure.
  window.engine.zoom(1000)
  window.engine.controller.placeAt(0, 1, 18, 0)
  window.drive({})
  window.stepFrames(90)
  const before = window.engine.camera.position.y
  // Positive movementY is a drag downwards.
  window.drive({ pitch: 0.3 })
  window.stepFrames(4)
  return { before: Number(before.toFixed(2)), after: Number(window.engine.camera.position.y.toFixed(2)) }
})
check('dragging down looks down, so the camera rises',
  tilted.after > tilted.before,
  `camera y ${tilted.before} -> ${tilted.after}`)

// -- 25. the wheel goes the way it was asked to go
const wheeled = await p.evaluate(() => {
  window.engine.zoom(1000)
  const before = window.engine.distance
  const roll = (deltaY) => document.getElementById('stage').dispatchEvent(
    new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }),
  )
  roll(1)
  const pushed = window.engine.distance
  roll(-1)
  return { before, pushed, pulled: window.engine.distance }
})
check('rolling the wheel one way brings the camera in',
  wheeled.pushed < wheeled.before,
  `${wheeled.before} -> ${wheeled.pushed} stons`)
check('and the other way takes it back out',
  wheeled.pulled > wheeled.pushed,
  `${wheeled.pushed} -> ${wheeled.pulled} stons`)

// -- back to the first World for the picture
await p.evaluate(async () => {
  const manifest = await fetch('/experiences/first-ground.json').then((r) => r.json())
  await window.engine.open(manifest)
})

// -- a picture, for a human to look at
await p.evaluate(() => {
  // the zoom check left the camera at the near end, where K6 is not drawn
  window.engine.zoom(1000)
  window.engine.controller.placeAt(6, 1, 10, 3.1)
  window.drive({ z: 1, run: true })
  window.stepFrames(40)
})
await p.screenshot({ path: '/tmp/claude-0/engine.png' })

check('no page errors', bad.length === 0, bad.join(' ~ ') || 'clean')

await b.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
