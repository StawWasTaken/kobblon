import * as THREE from 'three'
import { Controller } from './controller'
import { Keyboard, stillIntent, type Intent } from './input'
import { K6, loadK6Source, type K6Look } from './k6'
import {
  applyDecals, applyMeshes, buildWorld, readManifest, ZOOM_FAR, ZOOM_NEAR,
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

/*
 * How quickly the camera catches up with where it has been asked to be, and
 * how quickly it comes back out from behind something that was in the way.
 *
 * Both are the exponent of a decay, so they are "per second" rather than
 * "per frame": at 14, a zoom is three quarters done in a fifth of a second
 * and over before anybody would call it slow. Coming back out from a wall
 * is deliberately half that, because the camera that pops back the instant
 * a corner clears is worse than the one that takes a moment.
 */
const ZOOM_EASE = 14
const WALL_EASE = 7

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

  /**
   * Where the camera sits behind the avatar, dragged by the player.
   *
   * `distance` is where it has been asked to be. The camera does not go
   * there at once: `shown` chases it, and `held` is where it actually ends
   * up once whatever is in the way has had its say. Three numbers rather
   * than one is the whole of the smoothing, and it is why a wheel notch
   * reads as the camera moving rather than as the World jumping.
   */
  private orbit = { yaw: 0, pitch: 0.22, distance: ZOOM_FAR }
  private shown = ZOOM_FAR
  private held = ZOOM_FAR
  /** How far back this World lets the camera go. */
  private zoomMost = ZOOM_FAR
  private onWheel: ((event: WheelEvent) => void) | null = null
  private onKey: ((event: KeyboardEvent) => void) | null = null
  /** How many Worlds have been opened, so a late arrival knows it is late. */
  private opening = 0
  private onClick: (() => void) | null = null
  /** Used every frame to ask what is between somebody and their camera. */
  private look = new THREE.Raycaster()

  constructor(private options: EngineOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas: options.canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2))

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.5, 4000)
    this.scene.add(this.camera)

    if (options.listen !== false) {
      this.keyboard = new Keyboard(options.canvas)
      this.onWheel = (event) => {
        event.preventDefault()
        /*
         * The wheel was going the wrong way round and is flipped here
         * rather than argued with.
         *
         * The step grows with the distance: a notch that moves the camera
         * two stons is a crawl at thirty stons out and a lurch at three,
         * and classic Roblox's wheel feels the way it does because it
         * takes a fraction of where you already are rather than a fixed
         * amount.
         */
        const step = Math.max(1.5, this.orbit.distance * 0.22)
        this.zoom(-Math.sign(event.deltaY) * step)
      }
      options.canvas.addEventListener('wheel', this.onWheel, { passive: false })

      /*
       * I and O zoom, the way they always have. Somebody on a trackpad,
       * or on a laptop whose wheel does something clever, still gets to
       * choose where the camera sits.
       */
      this.onKey = (event: KeyboardEvent) => {
        if (event.code === 'KeyI') this.zoom(-Math.max(1.5, this.orbit.distance * 0.22))
        else if (event.code === 'KeyO') this.zoom(Math.max(1.5, this.orbit.distance * 0.22))
      }
      window.addEventListener('keydown', this.onKey)

      /*
       * A browser only hands over the pointer on the back of something
       * somebody did, so first person asks for it on a click rather than
       * the moment the camera gets close enough.
       */
      this.onClick = () => {
        if (this.firstPerson) this.keyboard?.setPointerLock(true)
      }
      options.canvas.addEventListener('click', this.onClick)
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

    /*
     * Which opening this is.
     *
     * A World's pictures, models, sounds and sky are all fetched after it is
     * standing, which is what lets it stand at all. That means every one of
     * them can come back after somebody has already left for another World,
     * and write into a World nobody is in — or, in the case of a sound,
     * start one playing on a service that has already been cleared and will
     * never be cleared again.
     *
     * A count rather than comparing the manifest, because opening the same
     * World twice is an ordinary thing to do and would defeat that.
     */
    const opening = (this.opening += 1)
    const stillWanted = () => this.opening === opening

    if (this.world) {
      this.scene.remove(this.world.group)
    }

    const built = buildWorld(manifest)
    this.world = built
    this.scene.add(built.group)
    this.controller.setSolids(built.solids)

    this.light(manifest)
    void this.dressSky(manifest, stillWanted)
    // A World decides how much of itself is seen at once: a corridor is not
    // a hillside. Pulling back further than it allows is not offered.
    this.zoomMost = manifest.camera?.zoom?.most ?? ZOOM_FAR
    this.orbit.distance = Math.min(this.orbit.distance, this.zoomMost)
    // A new World starts with the camera where it belongs rather than
    // gliding in from wherever the last one left it.
    this.shown = this.orbit.distance
    this.held = this.orbit.distance
    void this.sound.load(built, this.camera, this.options.resolveAsset, stillWanted)
    // The World is standing before its pictures arrive, rather than after.
    void applyDecals(built, this.options.resolveAsset, stillWanted)
    // Models arrive the same way pictures do: the World is open first.
    void applyMeshes(built, this.options.resolveAsset, stillWanted)

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

    /*
     * Zooming all the way in is how somebody asks for first person, and
     * zooming back out is how they ask to stop. The pointer follows that
     * rather than needing its own control.
     */
    if (!this.firstPerson) this.keyboard?.setPointerLock(false)
    return this.orbit.distance
  }

  /** Whether the camera is inside the head rather than behind it. */
  get firstPerson() {
    return this.orbit.distance <= ZOOM_NEAR + 0.01
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
  private async dressSky(manifest: WorldManifest, stillWanted: () => boolean = () => true) {
    const sky = await buildSky(manifest, this.options.resolveAsset)
    /*
     * A World opened while this was loading has already set its own. This
     * used to compare the manifest, which misses the case of the same World
     * being opened twice — an ordinary thing to do, and the reload button.
     */
    if (!stillWanted()) {
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
     *
     * The sky arrives after the World is already standing and already
     * drawn, and a material that was compiled without an environment does
     * not pick one up on its own. Every material in the scene is told to
     * build itself again, once, which is the difference between metal and
     * a dark grey box.
     */
    this.scene.environment = sky.environment
    this.scene.traverse((thing) => {
      const material = (thing as THREE.Mesh).material
      if (!material) return
      for (const one of Array.isArray(material) ? material : [material]) one.needsUpdate = true
    })
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
    /*
     * Almost all the way up and almost all the way down, about seventy five
     * degrees each way. The old range let somebody look a little above the
     * horizon and no further, which is why the camera felt like it was on
     * rails; you cannot look up at a tower you are standing under.
     */
    this.orbit.pitch = Math.max(-1.3, Math.min(1.3, this.orbit.pitch + intent.pitch))

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

    this.easeCamera(step)
    this.aimCamera(state.position, step)
    // The sky travels with whoever is looking, sitting below their eye.
    this.sky?.follow(this.camera)
    this.renderer.render(this.scene, this.camera)
    this.frame += 1
  }

  /**
   * How a camera moves when somebody has asked it to be somewhere else.
   *
   * Exponential rather than linear: it leaves quickly and arrives softly,
   * which is what every camera anybody has ever liked does, and it does not
   * care about the frame rate the way a fixed step per frame would. The
   * snap at the end is so that "all the way in" is exactly all the way in
   * rather than a thousandth of a ston short of it for ever.
   */
  private easeCamera(step: number) {
    const rate = 1 - Math.exp(-ZOOM_EASE * step)
    this.shown += (this.orbit.distance - this.shown) * rate
    if (Math.abs(this.shown - this.orbit.distance) < 0.01) this.shown = this.orbit.distance
  }

  private aimCamera(at: THREE.Vector3, step: number) {
    /*
     * The eye, not the chest. Zooming all the way in should put somebody
     * behind their own face rather than inside their ribcage.
     */
    const head = at.clone()
    head.y += K6_HEIGHT * 0.88

    /*
     * Behind the head by the yaw, and above it by the pitch.
     *
     * The two are not the same sign: back is the opposite of where the
     * player is looking, but up is up. Multiplying the whole vector by minus
     * the distance put the camera below the head, which is why every view
     * was taken from knee height.
     */
    const { yaw, pitch } = this.orbit

    /*
     * Where the camera would sit if nothing were in the way, and then where
     * it actually can. A camera that passes through a wall shows the inside
     * of the World, which is worse than being close to somebody's back.
     */
    /*
     * In at once, out slowly. A wall arriving between somebody and their
     * camera has to be obeyed on the frame it arrives, or the camera spends
     * that frame inside it; a wall leaving is nothing urgent, and easing
     * back out is the difference between a camera and a yo-yo.
     */
    const free = this.freeDistance(head, this.shown)
    this.held = free < this.held
      ? free
      : this.held + (free - this.held) * (1 - Math.exp(-WALL_EASE * step))
    if (Math.abs(this.held - free) < 0.01) this.held = free

    const wanted = this.held
    const flat = Math.cos(pitch) * wanted

    this.camera.position.set(
      head.x - Math.sin(yaw) * flat,
      head.y + Math.sin(pitch) * wanted,
      head.z - Math.cos(yaw) * flat,
    )
    this.camera.lookAt(head)

    /*
     * Fading out rather than blinking out. Coming in towards first person
     * the body thins as the camera reaches it and is gone before the camera
     * is inside it; only the person playing sees this, because only their
     * own avatar is being drawn from the inside.
     */
    if (this.avatar) {
      const fade = THREE.MathUtils.clamp((wanted - ZOOM_NEAR) / 3.5, 0, 1)
      this.avatar.object.visible = fade > 0.02
      this.avatar.fade(fade)
    }
  }

  /**
   * How far back the camera can actually go before something is in the way.
   *
   * Cast from the head outwards rather than from the camera inwards: a ray
   * that starts inside a wall finds nothing, which is exactly the case that
   * matters. What comes back is held a little short of whatever was hit, so
   * the near plane does not slice into it.
   */
  private freeDistance(head: THREE.Vector3, wanted: number) {
    if (!this.world) return wanted

    const { yaw, pitch } = this.orbit
    const away = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ).normalize()

    this.look.set(head, away)
    this.look.far = wanted
    const hits = this.look.intersectObject(this.world.group, true)

    for (const hit of hits) {
      // A decal is a picture on a wall, not a wall.
      const part = this.world.partOf.get(hit.object)
      if (part && part.kind !== 'box') continue
      if (part && part.solid === false) continue
      return Math.max(ZOOM_NEAR, hit.distance - 0.6)
    }

    return wanted
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
      firstPerson: this.firstPerson,
      locked: this.keyboard?.pointerLocked ?? false,
    }
  }

  dispose() {
    this.stop()
    this.keyboard?.dispose()
    if (this.onWheel) this.options.canvas.removeEventListener('wheel', this.onWheel)
    if (this.onKey) window.removeEventListener('keydown', this.onKey)
    if (this.onClick) this.options.canvas.removeEventListener('click', this.onClick)
    this.sound.dispose()
    this.avatar?.dispose()
    this.renderer.dispose()
  }
}
