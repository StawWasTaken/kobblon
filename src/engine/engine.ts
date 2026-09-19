import * as THREE from 'three'
import { Controller } from './controller'
import { Keyboard, stillIntent, type Intent } from './input'
import { K6, loadK6Source, type K6Look } from './k6'
import { buildWorld, readManifest, type BuiltWorld, type WorldManifest } from './experience'
import { K6_HEIGHT } from './units'

/**
 * The Kobblon Engine, the first useful slice of it.
 *
 * One runtime, used by whoever needs to run an experience: the Launcher to
 * play one and Creator to test one. Two runtimes would mean two sets of
 * behaviour and a creator who cannot trust their own test button, so there is
 * only ever this one.
 *
 * It does, today: load an experience, load and spawn K6, move, jump, collide,
 * animate, follow with a camera. It does not do: networking, scripting,
 * sound, shadows past one light. Those go in when they are the next thing
 * needed, not before.
 */

export type EngineOptions = {
  canvas: HTMLCanvasElement
  /** Where k6.glb is served from. */
  avatarUrl?: string
  /** Off for a test or a thumbnail, on for a player. */
  listen?: boolean
  look?: K6Look
  /**
   * Turns a Catalog id into something the runtime can load.
   *
   * The engine never resolves an id itself and a manifest never carries an
   * address: whoever is running the World decides what an id means, checks
   * it, and hands back a URL. Creator can answer with a local file for
   * something not published yet.
   */
  resolveAsset?: (id: string) => Promise<string | null>
}

/** Things the engine says happened, for a client to act on. */
export type EngineEvents = {
  /** The body left the World and was put back at its spawn. */
  died: { reason: 'void' }
  /** A World finished loading and is being run. */
  opened: { world: WorldManifest }
}

export class Engine {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly controller = new Controller()

  private renderer: THREE.WebGLRenderer
  private clock = new THREE.Clock()
  private keyboard: Keyboard | null = null
  private frame = 0
  private running = false

  private avatar: K6 | null = null
  private world: BuiltWorld | null = null
  private listeners = new Map<keyof EngineEvents, Set<(data: never) => void>>()

  /** Where the camera sits behind the avatar, dragged by the player. */
  private orbit = { yaw: 0, pitch: 0.22, distance: 34 }

  constructor(private options: EngineOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas: options.canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2))

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.5, 4000)
    this.scene.add(this.camera)

    if (options.listen !== false) this.keyboard = new Keyboard(options.canvas)
    this.resize()
  }

  resize() {
    const canvas = this.options.canvas
    const width = canvas.clientWidth || canvas.width
    const height = canvas.clientHeight || canvas.height
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(height, 1)
    this.camera.updateProjectionMatrix()
  }

  /** Somebody who wants to know when something happens. */
  on<K extends keyof EngineEvents>(event: K, listener: (data: EngineEvents[K]) => void) {
    const set = this.listeners.get(event) ?? new Set()
    set.add(listener as (data: never) => void)
    this.listeners.set(event, set)
    return () => set.delete(listener as (data: never) => void)
  }

  private say<K extends keyof EngineEvents>(event: K, data: EngineEvents[K]) {
    for (const listener of this.listeners.get(event) ?? []) {
      (listener as (d: EngineEvents[K]) => void)(data)
    }
  }

  /** Puts a World in the scene, replacing whatever was there. */
  async open(raw: unknown) {
    const manifest = readManifest(raw)

    if (this.world) {
      this.scene.remove(this.world.group)
    }

    const built = buildWorld(manifest)
    this.world = built
    this.scene.add(built.group)
    this.controller.setSolids(built.solids)

    this.light(manifest)
    void this.dressSky(manifest)

    if (!this.avatar) {
      const source = await loadK6Source(this.options.avatarUrl ?? '/k6/k6.glb')
      this.avatar = new K6(source)
      if (this.options.look) this.avatar.paint(this.options.look)
      this.scene.add(this.avatar.object)
    }

    const { at, facing = 0 } = manifest.spawn
    this.controller.setSpawn(at[0], at[1], at[2], (facing * Math.PI) / 180)
    this.controller.respawn()
    this.orbit.yaw = this.controller.state.facing

    this.say('opened', { world: manifest })
    return built
  }

  /** Back to where this World starts people. */
  respawn() {
    this.controller.respawn()
    this.orbit.yaw = this.controller.state.facing
  }

  /**
   * How hard the machine is being asked to work.
   *
   * The pixel ratio is the one setting that actually moves the frame rate on
   * a machine that is struggling, so it is the one a player is offered.
   */
  setQuality(quality: number) {
    const held = Math.max(0.25, Math.min(1, quality))
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2) * held)
    this.resize()
  }

  /**
   * The sky, when a World names one.
   *
   * A horizontal cross is one image holding six faces, which is how somebody
   * draws a sky by hand. It is cut up here rather than asking a creator to
   * upload six files.
   */
  private async dressSky(manifest: WorldManifest) {
    const id = manifest.sky?.decal
    if (!id || !this.options.resolveAsset) return

    const url = await this.options.resolveAsset(id).catch(() => null)
    if (!url) return

    const image = await new Promise<HTMLImageElement | null>((done) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => done(img)
      img.onerror = () => done(null)
      img.src = url
    })
    if (!image) return

    // A cross is four wide and three tall; each face is a quarter by a third.
    const face = Math.floor(image.width / 4)
    const at: Record<string, [number, number]> = {
      px: [2, 1], nx: [0, 1], py: [1, 0], ny: [1, 2], pz: [1, 1], nz: [3, 1],
    }

    const sides = ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((name) => {
      const canvas = document.createElement('canvas')
      canvas.width = face
      canvas.height = face
      const paint = canvas.getContext('2d')
      const [col, row] = at[name]
      paint?.drawImage(image, col * face, row * face, face, face, 0, 0, face, face)
      return canvas
    })

    const sky = new THREE.CubeTexture(sides)
    sky.needsUpdate = true
    sky.colorSpace = THREE.SRGBColorSpace
    this.scene.background = sky
  }

  private light(manifest: WorldManifest) {
    this.scene.background = new THREE.Color(manifest.sky?.colour ?? '#0f1016')
    if (manifest.sky?.fog) {
      this.scene.fog = new THREE.Fog(manifest.sky.colour ?? '#0f1016', 40, manifest.sky.fog)
    }

    const old = this.scene.children.filter((child) => (child as THREE.Light).isLight)
    old.forEach((light) => this.scene.remove(light))

    const ambient = new THREE.HemisphereLight(0xdfe4ff, 0x23252d, manifest.light?.ambient ?? 1.5)
    this.scene.add(ambient)

    const sun = new THREE.DirectionalLight(0xffffff, manifest.light?.sun ?? 2)
    sun.position.set(...(manifest.light?.from ?? [40, 80, 30]))
    this.scene.add(sun)
  }

  /** One frame. Public so a test can step the world without a clock. */
  tick(dt: number, intent: Intent = stillIntent()) {
    const step = Math.min(dt, 1 / 20) // a slow frame must not teleport anybody

    this.orbit.yaw += intent.turn
    this.orbit.pitch = Math.max(-0.6, Math.min(1.1, this.orbit.pitch + intent.pitch))

    const state = this.controller.step(intent, this.orbit.yaw, step)

    // The fall and the correction both happen inside that step, so the only
    // way anybody hears about it is if the engine says so.
    if (this.controller.fellOut) {
      this.controller.fellOut = false
      this.orbit.yaw = state.facing
      this.say('died', { reason: 'void' })
    }

    if (this.avatar) {
      this.avatar.object.position.copy(state.position)
      this.avatar.object.rotation.y = state.facing
      this.avatar.settle({
        speed: state.speed,
        grounded: state.grounded,
        rising: state.rising,
        emote: intent.emote,
      }, step)
      this.avatar.update(step)
    }

    this.aimCamera(state.position)
    this.renderer.render(this.scene, this.camera)
    this.frame += 1
  }

  private aimCamera(at: THREE.Vector3) {
    const head = at.clone()
    head.y += K6_HEIGHT * 0.75

    // The yaw points the way the player is looking, so the camera sits the
    // other side of the head from it.
    const { yaw, pitch, distance } = this.orbit
    const back = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    ).multiplyScalar(-distance)

    this.camera.position.copy(head).add(back)
    this.camera.lookAt(head)
  }

  start() {
    if (this.running) return
    this.running = true
    this.clock.start()

    const loop = () => {
      if (!this.running) return
      this.tick(this.clock.getDelta(), this.keyboard?.read())
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
  }

  /** What a test or a debug overlay wants to know. */
  get status() {
    return {
      frame: this.frame,
      position: this.controller.state.position.toArray(),
      grounded: this.controller.state.grounded,
      speed: Number(this.controller.state.speed.toFixed(2)),
      parts: this.avatar ? [...this.avatar.parts.keys()] : [],
      world: this.world?.manifest.name ?? null,
    }
  }

  dispose() {
    this.stop()
    this.keyboard?.dispose()
    this.avatar?.dispose()
    this.renderer.dispose()
  }
}
