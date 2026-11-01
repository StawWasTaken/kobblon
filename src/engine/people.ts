import * as THREE from 'three'
import { K6, loadK6Source, type K6Look } from './k6'

/**
 * Other people, in this World.
 *
 * The engine could already draw twenty bodies: `K6` is a class, not a
 * singleton, `loadK6Source` is cached so twenty bodies are one download of
 * `k6.glb`, and `BubbleBoard` has been keyed on `THREE.Object3D` since it was
 * written. What was missing was the seam - nothing outside `Engine` could
 * hand it a second body. This is that seam and nothing more; there is no
 * network code here and there never will be, because the engine does not
 * know what a socket is and should not learn.
 *
 * Three things about the shape, all of them asked for by the Launcher and
 * all of them deliberate:
 *
 *   * **`placeAt` takes a position, not a velocity.** The wire is
 *     authoritative about where somebody is. Integrating a velocity here
 *     would drift between updates and then snap back, which reads as
 *     everybody else teleporting.
 *   * **The engine owns the smoothing**, because only the engine knows its
 *     own frame times. `placeAt` is "the wire says they are here"; getting
 *     there over about a tenth of a second is this file's business. The
 *     Launcher sends what it was told and does no easing of its own.
 *   * **`moving` is separate from `placeAt`**, because `K6.settle` already
 *     wants exactly this and because the two arrive at different rates. It
 *     also means a dropped packet leaves a body standing still rather than
 *     walking on the spot for ever - see `STALE` below.
 */
export type PersonMotion = {
  /** Stons a second, the same number `ControllerState.speed` carries. */
  speed: number
  grounded: boolean
  rising: boolean
}

export type Person = {
  /** The account this body belongs to. Not a slot: a slot is the wire's. */
  readonly id: string
  /**
   * What follows their head, for `BubbleBoard` and anything else that hangs
   * something over somebody.
   *
   * It exists from the moment `someoneElse` returns, before `k6.glb` has
   * landed, so a name can go up at once. `BubbleBoard.topOf` falls back to a
   * bare head's height for an object with nothing in it yet, which is the
   * case this leans on.
   */
  readonly object: THREE.Object3D
  /** Their body, once it has loaded. Null for the first frames. */
  readonly body: K6 | null
  /** Where the wire says they are, in stons, and which way they face, in radians. */
  placeAt(x: number, y: number, z: number, facing: number): void
  /** How they are moving, so the animation picks itself. */
  moving(state: PersonMotion): void
  look(look: K6Look): void
  emote(name: string): void
  /** They left the room. The body goes, and the handle is spent. */
  leave(): void
  /** Whether `leave` has been called. */
  readonly gone: boolean
}

/**
 * How quickly a body slides to where the wire last said it was.
 *
 * Exponential, like every other ease in this engine, and tuned against a
 * 15Hz tick: about a tenth of a second, so a body arrives before the next
 * update rather than lagging a whole one behind it.
 */
const EASE = 18

/**
 * Further than this in one update and it is not a walk, it is a respawn, a
 * teleport, or the first thing we were ever told about them. Easing across
 * it would draw somebody skating through the scenery.
 */
const A_JUMP = 24

/**
 * How long a movement state is believed.
 *
 * Positions come ten to twenty times a second and `moving` comes with them.
 * If one stops arriving the honest answer is that we do not know, and a body
 * standing still is a better wrong answer than a body running on the spot
 * for the rest of the visit. This is the guard that watches the right event:
 * the clock, not the arrival.
 */
const STALE = 0.5

export class Someone implements Person {
  readonly object = new THREE.Group()
  private k6: K6 | null = null
  private left = false

  /** Where the wire last said they were, which is where we are heading. */
  private wanted = new THREE.Vector3()
  private facing = 0
  /** Whether we have been told anything at all yet, so the first word snaps. */
  private told = false

  private motion: PersonMotion = { speed: 0, grounded: true, rising: false }
  private heard = 0

  /**
   * What to do to the body when it arrives.
   *
   * A look or an emote can be asked for in the same breath as the handle is
   * made, which is a tenth of a second before `k6.glb` is parsed. Kept and
   * applied on landing rather than dropped - this project's oldest trap is a
   * value read before the thing that uses it exists, and throwing the value
   * away instead is the same bug wearing a hat.
   */
  private wantedLook: K6Look | null = null
  private wantedEmote: string | null = null

  constructor(
    readonly id: string,
    parent: THREE.Object3D,
    avatarUrl: string,
    /** Whether this body is still wanted - the engine's own opening count. */
    private stillWanted: () => boolean,
  ) {
    this.object.name = `person:${id}`
    parent.add(this.object)
    void this.build(avatarUrl)
  }

  private async build(avatarUrl: string) {
    const source = await loadK6Source(avatarUrl)
    /*
     * Two ways this can be unwanted by now, and both have happened to other
     * asynchronous work in this engine: they left while the body was
     * loading, or another World opened. Neither throws, and a body added to
     * a scene nobody is in is the sound bug again with a mesh instead of a
     * noise.
     */
    if (this.left || !this.stillWanted()) return
    const body = new K6(source)
    this.object.add(body.object)
    this.k6 = body
    if (this.wantedLook) body.paint(this.wantedLook)
    if (this.wantedEmote) {
      body.emote(this.wantedEmote)
      this.wantedEmote = null
    }
  }

  get body() { return this.k6 }
  get gone() { return this.left }

  placeAt(x: number, y: number, z: number, facing: number) {
    if (this.left) return
    // A NaN from a decoder would poison the position for the rest of the
    // visit, and three frames later the body is at the origin and nobody
    // knows why. Refused at the door instead.
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)
        || !Number.isFinite(facing)) return

    this.wanted.set(x, y, z)
    this.facing = facing
    if (!this.told || this.object.position.distanceTo(this.wanted) > A_JUMP) {
      this.object.position.copy(this.wanted)
      this.object.rotation.y = facing
      this.told = true
    }
  }

  moving(state: PersonMotion) {
    if (this.left) return
    this.motion = {
      speed: Number.isFinite(state.speed) ? Math.max(state.speed, 0) : 0,
      grounded: state.grounded,
      rising: state.rising,
    }
    this.heard = 0
  }

  look(look: K6Look) {
    if (this.left) return
    this.wantedLook = { ...this.wantedLook, ...look }
    this.k6?.paint(look)
  }

  emote(name: string) {
    if (this.left) return
    if (this.k6) this.k6.emote(name)
    else this.wantedEmote = name
  }

  /** The engine's frame, not the wire's. */
  step(dt: number) {
    if (this.left) return

    const rate = 1 - Math.exp(-EASE * dt)
    this.object.position.lerp(this.wanted, rate)
    // The short way round, so somebody turning past north does not spin.
    const turn = Math.atan2(
      Math.sin(this.facing - this.object.rotation.y),
      Math.cos(this.facing - this.object.rotation.y),
    )
    this.object.rotation.y += turn * rate

    this.heard += dt
    const believed = this.heard < STALE
      ? this.motion
      : { speed: 0, grounded: true, rising: false }

    if (this.k6) {
      this.k6.settle({ ...believed, emote: false }, dt)
      this.k6.update(dt)
    }
  }

  leave() {
    if (this.left) return
    this.left = true
    this.k6?.dispose()
    this.k6 = null
    this.object.removeFromParent()
  }
}
