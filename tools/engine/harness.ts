/*
 * The engine, run on its own.
 *
 * This is a development harness, not part of the website: Kobblon experiences
 * do not run on the web. It exists so the runtime can be driven and looked at
 * while it is being built, and so a test can step it frame by frame.
 */
import { Engine, stillIntent, type Intent } from '@/engine'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const hud = document.getElementById('hud') as HTMLElement

const engine = new Engine({ canvas, avatarUrl: '/k6/k6.glb' })
addEventListener('resize', () => engine.resize())

// What the engine says happened, kept for a test to read. Listening starts
// before the first World is opened, so the first one counts.
const said: { died: number; opened: number } = { died: 0, opened: 0 }
engine.on('died', () => { said.died += 1 })
engine.on('opened', () => { said.opened += 1 })
Object.assign(window, { said })

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
