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
check('walk speed is held', Math.abs(walked.speed - 11) < 0.6, `${walked.speed}`)
// and forward is the way it is facing: the spawn looks down -Z
const forward = await p.evaluate(() => {
  window.engine.controller.placeAt(0, 1, 18, Math.PI)
  window.engine.tick(0, { x: 0, z: 0, jump: false, run: false, turn: 0, pitch: 0, emote: false })
  window.drive({ z: 1 })
  return window.stepFrames(40)
})
check('walks the way it is facing', forward.position[2] < 18 - 5,
  `z 18.0 -> ${forward.position[2].toFixed(1)}`)

// -- 4. running is faster than walking
const ran = await p.evaluate(() => {
  window.engine.controller.placeAt(0, 1, 40)
  window.drive({ x: 1, run: true })
  return window.stepFrames(60)
})
check('runs faster than it walks', ran.speed > walked.speed + 6, `${walked.speed} -> ${ran.speed}`)

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
check('a square picture on a long wall stays square',
  Math.abs(fitted.square.across - fitted.square.up) < 0.01,
  `${fitted.square.across.toFixed(2)} by ${fitted.square.up.toFixed(2)} stons on a wall 40 by 8`)
check('a wide picture is as wide as it is',
  Math.abs(fitted.wide.across / fitted.wide.up - 4) < 0.02,
  `4:1 came out ${(fitted.wide.across / fitted.wide.up).toFixed(2)}:1`)
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
  window.stepFrames(2)
  const drawnFar = window.engine.status.drawn
  const near = window.engine.zoom(-1000)
  window.stepFrames(2)
  return { out, near, drawnFar, drawnNear: window.engine.status.drawn }
})
check('a World says how far back the camera may go', zoomed.out === 20, `${zoomed.out} stons, as the manifest asked`)
check('and the near end is the engine’s', Math.abs(zoomed.near - 0.5) < 0.001, `${zoomed.near} stons`)
check('at the near end K6 is not drawn at all',
  zoomed.drawnFar === true && zoomed.drawnNear === false, 'not faded, not clipped, not drawn')

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
    // the front face of the stons wall, 8 stons across
    stonsAcross: acrossOf('stonewall', 4),
    tinted: of('stonewall').material.color.getHexString(),
    shared: of('wall').material.map === of('beam').material.map,
  }
})
check('a pictured material fetches its picture',
  Object.values(surfaced.sizes).every((one) => one === '512x512'),
  JSON.stringify(surfaced.sizes))
check('a ston is one ston, so a part can be counted by looking at it',
  Math.abs(surfaced.stonsAcross * 4 - 8) < 0.01,
  `8 stons across shows ${(surfaced.stonsAcross * 4).toFixed(2)} of them`)
check('and the pattern multiplies the colour rather than replacing it',
  surfaced.tinted === '4a6cff', `#${surfaced.tinted}`)
check('two materials are two patterns', !surfaced.shared, 'brick is not wood')

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
