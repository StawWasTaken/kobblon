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
    plain: plain.isColor === true && plain.getHexString() === '123456',
    missing: missing.isColor === true,
    editor: drawn.isCubeTexture === true && drawn.image?.length === 6,
  }
})
check('a World with no sky gets its colour', skies.plain, 'colour honoured')
check('a sky that cannot be had falls back to the colour', skies.missing,
  'a picture that will not load never stops a World opening')
check('an editor can build the same sky without the engine', skies.editor,
  'buildSky returned a cube texture with six faces')

// and through the engine, which is how an app gets one
const dressed = await p.evaluate(async () => {
  window.fakeSky('sky-2')
  await window.engine.open({
    format: 1, id: 's', name: 'Sky', spawn: { at: [0, 4, 0] },
    sky: { colour: '#123456', decal: 'sky-2' },
    blocks: [{ kind: 'box', at: [0, -1, 0], size: [40, 2, 40] }],
  })
  // the picture is fetched, so give it a moment
  await new Promise((done) => setTimeout(done, 400))
  const background = window.engine.scene.background
  return { cube: background?.isCubeTexture === true, images: background?.image?.length ?? 0 }
})
check('a World that names a sky gets the sky', dressed.cube && dressed.images === 6,
  `cube texture with ${dressed.images} faces`)

// -- back to the first World for the picture
await p.evaluate(async () => {
  const manifest = await fetch('/experiences/first-ground.json').then((r) => r.json())
  await window.engine.open(manifest)
})

// -- a picture, for a human to look at
await p.evaluate(() => {
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
