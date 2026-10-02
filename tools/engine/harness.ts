/*
 * The engine, run on its own.
 *
 * This is a development harness, not part of the website: Kobblon experiences
 * do not run on the web. It exists so the runtime can be driven and looked at
 * while it is being built, and so a test can step it frame by frame.
 */
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
