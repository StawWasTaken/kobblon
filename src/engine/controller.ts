import * as THREE from 'three'
import { GRAVITY, K6_HEIGHT, K6_RADIUS } from './units'
import type { Intent } from './input'

/**
 * Moving K6 around a world made of boxes.
 *
 * This is deliberately not a physics engine. An avatar is an upright box that
 * slides along walls, stands on top of things and falls off them, which is
 * every movement a Kobblon experience needs before it needs ragdolls. A real
 * solver can replace this later behind the same shape of call.
 */

export type Solid = {
  /** In world stons, already accounting for the object's own transform. */
  box: THREE.Box3
  /**
   * Whether somebody can climb this rather than only walk into it.
   *
   * A truss. Its collision is still its box — a lattice is mostly holes and
   * a tower made of its bars would be hundreds of solids — so it is solid to
   * walk into and climbable from any side, which is what makes a truss tower
   * a tower rather than a cloud of beams.
   */
  climb?: boolean
}

export type ControllerState = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  /** Which way the body is facing, in radians. */
  facing: number
  grounded: boolean
  speed: number
  rising: boolean
  /** On a truss, going up or down it rather than falling off it. */
  climbing: boolean
}

/*
 * Speeds, taken from the platform everybody's hands already know rather
 * than picked by feel.
 *
 * A Roblox character is about five studs tall and walks at sixteen studs a
 * second, which is 3.2 of its own heights every second. K6 is ten stons
 * tall, so the same walk is thirty two stons a second. The old eleven was a
 * third of that, which is why walking felt like wading and running felt
 * slower than somebody else's walk.
 *
 * There is no run. One speed, the way the classic platforms had it: a
 * sprint key is a thing to hold down for ever, which is not a mechanic, it
 * is a tax.
 */
const WALK = 32

/*
 * And the jump that goes with it. Roblox jumps about 1.27 of its own height;
 * at Kobblon's gravity that is the speed you have to leave the ground at to
 * get 12.7 stons up.
 */
const JUMP = 35.3
/** How fast the body swings round to face where it is going. */
const TURN = 12
/*
 * Quick enough that a change of direction is instant at the new speed.
 * Ninety was tuned against a walk of eleven and would take a third of a
 * second to reach thirty two, which feels like ice.
 */
const ACCELERATE = 260
const FRICTION = 14
/**
 * How fast somebody goes up a truss, and how far from one counts as holding
 * on.
 *
 * Slower than walking, because climbing is. The reach is a little more than
 * the skin so that touching a truss holds you to it rather than needing to
 * be inside it, and so that letting go and pressing again does not drop you
 * on the frame between.
 */
const CLIMB = 14
const REACH = 0.6

/** A step this size is walked up rather than bumped into. */
const STEP = 1.4
/**
 * Boxes that only touch are not overlapping. Without this, standing on a
 * block counts as being inside it, and a step exactly as tall as the step
 * height becomes a wall.
 */
const SKIN = 0.02
/** Below this, there is no World left to be in. */
const VOID = -200

export class Controller {
  readonly state: ControllerState = {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    facing: 0,
    grounded: false,
    speed: 0,
    rising: false,
    climbing: false,
  }

  /** Whether the jump key has been let go since the last jump. */
  private box = new THREE.Box3()

  /** Where this World puts somebody, and where it puts them back. */
  private spawn = { at: new THREE.Vector3(), facing: 0 }

  /** Set when the body left the world, for the engine to act on and clear. */
  fellOut = false

  constructor(private solids: Solid[] = []) {}

  /** The World says where its ground is; nothing here guesses. */
  setSpawn(x: number, y: number, z: number, facing = 0) {
    this.spawn.at.set(x, y, z)
    this.spawn.facing = facing
  }

  /** Back to the spawn, standing still. */
  respawn() {
    this.state.position.copy(this.spawn.at)
    this.state.velocity.set(0, 0, 0)
    this.state.facing = this.spawn.facing
    this.state.grounded = false
  }

  setSolids(solids: Solid[]) {
    this.solids = solids
  }

  placeAt(x: number, y: number, z: number, facing = 0) {
    this.state.position.set(x, y, z)
    this.state.velocity.set(0, 0, 0)
    this.state.facing = facing
  }

  /** The avatar's box at a given foot position. */
  private boxAt(at: THREE.Vector3, into = this.box) {
    return into.set(
      new THREE.Vector3(at.x - K6_RADIUS, at.y, at.z - K6_RADIUS),
      new THREE.Vector3(at.x + K6_RADIUS, at.y + K6_HEIGHT, at.z + K6_RADIUS),
    )
  }

  /** True while a jump off a truss is still carrying somebody away from it. */
  private letGo = false

  /** Whether there is something climbable within arm's reach. */
  private climbable(at: THREE.Vector3) {
    const box = this.boxAt(at, new THREE.Box3())
    box.expandByScalar(REACH)
    return this.solids.some((solid) => solid.climb && solid.box.intersectsBox(box))
  }

  /**
   * What is in the way, which a truss never is.
   *
   * A climbable solid is a volume you are meant to be inside, so it is not
   * collision at all: you grab it rather than bump into it, and the bars it
   * is drawn from are mostly holes anyway. Anything else and the moment
   * somebody lets go while inside one, the collision resolution has to put
   * them somewhere they are not inside — which it did, by teleporting them
   * out of the bottom of the tower, twenty stons in one frame.
   *
   * Walking into a truss still stops you, because touching one starts you
   * climbing it before you are through it.
   */
  private hits(at: THREE.Vector3) {
    const box = this.boxAt(at, new THREE.Box3())
    box.min.addScalar(SKIN)
    box.max.subScalar(SKIN)
    return this.solids.filter((solid) => !solid.climb && solid.box.intersectsBox(box))
  }

  /**
   * One step of the world. `cameraYaw` is where the camera is looking, so
   * that forward means forward from where the player is sitting.
   */
  step(intent: Intent, cameraYaw: number, dt: number) {
    const { position, velocity } = this.state

    /*
     * What the player asked for, turned into a direction in the world.
     *
     * Kobblon's forward is +Z: K6 is modelled facing that way, so a facing of
     * zero, a yaw of zero and a press of forward all mean the same direction.
     * Get this wrong and the avatar walks towards the camera.
     */
    const wanted = new THREE.Vector3(-intent.x, 0, intent.z)
    if (wanted.lengthSq() > 0) {
      wanted.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw)
    }

    /*
     * A truss within reach means climbing, unless they have just jumped off
     * it. Any side of it: a tower is approached from wherever somebody
     * happens to be standing, and a ladder you can only mount from the north
     * is a ladder people walk around.
     */
    const holding = this.climbable(position)
    const climbing = !!holding && !this.letGo

    if (this.state.climbing && !climbing) this.letGo = false
    this.state.climbing = climbing

    if (climbing) {
      /*
       * Up and down the truss, and nothing pulling down. Forward is up,
       * which is what a hand on a ladder does; sideways still slides along
       * it so somebody can move round a tower without dropping off.
       */
      /*
       * Forward is up. Nothing drives them into the lattice, because a
       * truss is not collision any more and pressing forward would walk
       * them through it and out the far side. Left and right slide along
       * it, so a tower can be worked round without letting go.
       */
      velocity.y = intent.z * CLIMB
      const along = new THREE.Vector3(-intent.x, 0, 0)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw)
        .multiplyScalar(CLIMB * 0.6)
      velocity.x = along.x
      velocity.z = along.z

      if (intent.jump) {
        // Off, and away from it, rather than straight up into it again.
        velocity.y = JUMP * 0.8
        this.letGo = true
        this.state.climbing = false
      }

      this.slide(position, new THREE.Vector3(velocity.x * dt, 0, 0), 'x')
      this.slide(position, new THREE.Vector3(0, 0, velocity.z * dt), 'z')
      /*
       * Climbing moves straight up rather than through `fall`, so that the
       * truss's own box does not stop somebody going up the inside of it —
       * and at the top it steps onto whatever is up there instead of
       * sliding back down, which is the difference between a ladder that
       * works and one everybody avoids.
       */
      const above = position.clone()
      above.y += velocity.y * dt
      if (!this.hits(above).length) position.copy(above)

      this.state.grounded = this.hits(
        new THREE.Vector3(position.x, position.y - SKIN * 2, position.z),
      ).length > 0
      this.state.speed = Math.abs(velocity.y) + Math.hypot(velocity.x, velocity.z)
      this.state.rising = velocity.y > 0

      if (this.state.speed > 0.5 && wanted.lengthSq() > 0) {
        const want = Math.atan2(wanted.x, wanted.z)
        let turn = want - this.state.facing
        while (turn > Math.PI) turn -= Math.PI * 2
        while (turn < -Math.PI) turn += Math.PI * 2
        this.state.facing += turn * Math.min(1, TURN * dt)
      }

      return this.state
    }

    // Back on the ground, the jump that left a truss is spent.
    if (this.state.grounded) this.letGo = false

    const target = wanted.multiplyScalar(WALK)

    // -- accelerate towards it on the floor, drift in the air
    const grip = this.state.grounded ? 1 : 0.28
    const flat = new THREE.Vector3(velocity.x, 0, velocity.z)
    const push = target.clone().sub(flat)
    const change = Math.min(ACCELERATE * grip * dt, push.length())
    if (push.lengthSq() > 0) flat.addScaledVector(push.normalize(), change)

    if (target.lengthSq() === 0 && this.state.grounded) {
      const slow = Math.max(0, 1 - FRICTION * dt)
      flat.multiplyScalar(slow)
    }

    velocity.x = flat.x
    velocity.z = flat.z

    /*
     * Jumping, whenever there is something underfoot.
     *
     * Held rather than tapped: letting somebody bounce across a World by
     * holding the key is what the platforms this is built after do, and
     * making them release and press again reads as a cooldown nobody asked
     * for.
     */
    if (intent.jump && this.state.grounded) {
      velocity.y = JUMP
      this.state.grounded = false
    }

    velocity.y -= GRAVITY * dt

    // -- move one axis at a time so a wall stops one direction, not all three
    this.slide(position, new THREE.Vector3(velocity.x * dt, 0, 0), 'x')
    this.slide(position, new THREE.Vector3(0, 0, velocity.z * dt), 'z')
    this.fall(position, velocity.y * dt)

    // -- face the way we are going, without snapping
    const moving = new THREE.Vector2(velocity.x, velocity.z)
    this.state.speed = moving.length()
    if (this.state.speed > 0.5) {
      const want = Math.atan2(velocity.x, velocity.z)
      let turn = want - this.state.facing
      while (turn > Math.PI) turn -= Math.PI * 2
      while (turn < -Math.PI) turn += Math.PI * 2
      this.state.facing += turn * Math.min(1, TURN * dt)
    }

    this.state.rising = velocity.y > 0
    return this.state
  }

  /** Moves along one axis, and steps up over anything short enough. */
  private slide(position: THREE.Vector3, by: THREE.Vector3, axis: 'x' | 'z') {
    if (by[axis] === 0) return
    const next = position.clone().add(by)
    const blocked = this.hits(next)
    if (!blocked.length) { position.copy(next); return }

    // Try again from a step higher: a kerb should not stop somebody walking.
    const stepped = next.clone()
    stepped.y += STEP
    if (!this.hits(stepped).length) {
      const top = Math.max(...blocked.map((solid) => solid.box.max.y))
      if (top - position.y <= STEP) {
        position.copy(next)
        position.y = top
        return
      }
    }

    this.state.velocity[axis] = 0
  }

  /** Moves up or down, landing on whatever is underneath. */
  private fall(position: THREE.Vector3, by: number) {
    if (by === 0) return
    const next = position.clone()
    next.y += by

    const blocked = this.hits(next)
    if (!blocked.length) {
      // Going down and about to touch: settle onto it rather than hovering a
      // skin's width above it and falling that width again next frame.
      if (by < 0) {
        const probe = next.clone()
        probe.y -= SKIN * 3
        const under = this.hits(probe)
        if (under.length) {
          position.copy(next)
          position.y = Math.max(...under.map((solid) => solid.box.max.y))
          this.state.velocity.y = 0
          this.state.grounded = true
          return
        }
      }

      position.copy(next)
      this.state.grounded = false
      /*
       * Out of the World. This is a death rather than a correction: the
       * engine puts the body back at the spawn and says so, so the Launcher
       * can tell the player and Creator can tell a creator their World has a
       * hole in it. Nothing outside could see this: the fall and the
       * correction happen inside one step.
       */
      if (position.y < VOID) {
        this.fellOut = true
        this.respawn()
      }
      return
    }

    if (by < 0) {
      // landing: stand on the highest thing we went through
      position.y = Math.max(...blocked.map((solid) => solid.box.max.y))
      this.state.grounded = true
    } else {
      // a ceiling: stop rising, keep the feet where they are
      position.y = Math.min(...blocked.map((solid) => solid.box.min.y)) - K6_HEIGHT
    }
    this.state.velocity.y = 0
  }

}
