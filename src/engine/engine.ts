import * as THREE from 'three'
import { Controller } from './controller'
import { Keyboard, stillIntent, type Intent } from './input'
import { K6, loadK6Source, type K6Look } from './k6'
import {
  applyDecals, buildWorld, readManifest, ZOOM_FAR, ZOOM_NEAR,
  type BuiltWorld, type WorldManifest,
} from './experience'
import { buildSky, type ResolveAsset, type Skybox } from './sky'
import { K6_HEIGHT } from './units'
import { SoundService } from './sound'

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
  resolveAsset?: ResolveAsset
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
  private sky: Skybox | null = null
  /** Everything this World makes a noise with. */
  readonly sound = new SoundService()
  private listeners = new Map<keyof EngineEvents, Set<(data: never) => void>>()

  /** Where the camera sits behind the avatar, dragged by the player. */
  private orbit = { yaw: 0, pitch: 0.22, distance: ZOOM_FAR }
  /** How far back this World lets the camera go. */
  private zoomMost = ZOOM_FAR
  private onWheel: ((event: WheelEvent) => void) | null = null

  constructor(private options: EngineOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas: options.canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2))

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.5, 4000)
    this.scene.add(this.camera)

    if (options.listen !== false) {
      this.keyboard = new Keyboard(options.canvas)
      this.onWheel = (event) => {
        event.preventDefault()
        // A notch is a notch whichever machine sent it, so the sign is read
        // and the size is the engine's.
        this.zoom(Math.sign(event.deltaY) * 2)
      }
      options.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    }
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
    // A World decides how much of itself is seen at once: a corridor is not
    // a hillside. Pulling back further than it allows is not offered.
    this.zoomMost = manifest.camera?.zoom?.most ?? ZOOM_FAR
    this.orbit.distance = Math.min(this.orbit.distance, this.zoomMost)
    void this.sound.load(built, this.camera, this.options.resolveAsset)
    // The World is standing before its pictures arrive, rather than after.
    void applyDecals(built, this.options.resolveAsset)

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

  /**
   * In and out, between the engine's near end and the World's far one.
   *
   * Public so that a Launcher's own controls, or a test, can do what the
   * wheel does without inventing a wheel event.
   */
  zoom(by: number) {
    this.orbit.distance = Math.max(ZOOM_NEAR, Math.min(this.zoomMost, this.orbit.distance + by))
    return this.orbit.distance
  }

  /** Where the camera is, for anybody who needs to know. */
  get distance() {
    return this.orbit.distance
  }

  /** The sky in the scene, for anybody who needs to look at it. */
  get skybox() {
    return this.sky
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
   * The sky, once whoever is running this has said what the id means.
   *
   * The cutting lives in sky.ts so that an editor drawing its own scene can
   * put up the same background without borrowing the whole engine.
   */
  private async dressSky(manifest: WorldManifest) {
    const sky = await buildSky(manifest, this.options.resolveAsset)
    // A World opened while this was loading has already set its own.
    if (this.world?.manifest !== manifest) {
      sky.box?.dispose()
      return
    }

    this.sky?.dispose()
    this.sky = sky.box

    this.scene.background = sky.colour
    if (sky.box) {
      sky.box.follow(this.camera)
      this.scene.add(sky.box.object)
    }

    /*
     * A sky is also the only thing in a World for metal to reflect. Without
     * this, anything shiny renders black and a creator thinks the material
     * is broken.
     */
    this.scene.environment = sky.environment
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
      /*
       * At the near end the camera is inside the head. Not faded and not
       * clipped: half a head drawn across the middle of the screen is worse
       * than no head, so it is not drawn.
       */
      this.avatar.object.visible = this.orbit.distance > ZOOM_NEAR + 0.5
    }

    this.aimCamera(state.position)
    // The sky travels with whoever is looking, sitting below their eye.
    this.sky?.follow(this.camera)
    this.renderer.render(this.scene, this.camera)
    this.frame += 1
  }

  private aimCamera(at: THREE.Vector3) {
    const head = at.clone()
    head.y += K6_HEIGHT * 0.75

    /*
     * Behind the head by the yaw, and above it by the pitch.
     *
     * The two are not the same sign: back is the opposite of where the
     * player is looking, but up is up. Multiplying the whole vector by minus
     * the distance put the camera below the head, which is why every view
     * was taken from knee height.
     */
    const { yaw, pitch, distance } = this.orbit
    const flat = Math.cos(pitch) * distance

    this.camera.position.set(
      head.x - Math.sin(yaw) * flat,
      head.y + Math.sin(pitch) * distance,
      head.z - Math.cos(yaw) * flat,
    )
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
      distance: Number(this.orbit.distance.toFixed(2)),
      drawn: this.avatar?.object.visible ?? false,
    }
  }

  dispose() {
    this.stop()
    this.keyboard?.dispose()
    if (this.onWheel) this.options.canvas.removeEventListener('wheel', this.onWheel)
    this.sound.dispose()
    this.avatar?.dispose()
    this.renderer.dispose()
  }
}
