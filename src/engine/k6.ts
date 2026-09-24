import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * K6, in the engine.
 *
 * The model is loaded once and handed out as clones, because a world with
 * twenty avatars in it should not fetch twenty files. Cloning a skinned mesh
 * means rebinding its skeleton, which three.js does not do for you.
 */

/** The six body parts. There is no seventh, and a hand is not one of them. */
export const K6_PARTS = ['Head', 'Torso', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg'] as const
export type K6Part = (typeof K6_PARTS)[number]

export type K6Look = Partial<Record<K6Part, string>>

export type K6Motion = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'wave'

let source: Promise<THREE.Group & { animations: THREE.AnimationClip[] }> | null = null

/** Loads the avatar once per page, whoever asks. */
export function loadK6Source(url: string) {
  if (!source) {
    source = new GLTFLoader().loadAsync(url).then((gltf) => {
      const scene = gltf.scene as THREE.Group & { animations: THREE.AnimationClip[] }
      scene.animations = gltf.animations
      return scene
    })
  }
  return source
}

/** Forgets the loaded avatar, which only a test or a hot reload wants. */
export function forgetK6Source() {
  source = null
}

/**
 * One avatar in a scene: its object, its parts by name, and the small state
 * machine that decides which clip should be playing.
 */
export class K6 {
  readonly object: THREE.Group
  readonly parts = new Map<K6Part, THREE.SkinnedMesh>()
  readonly mixer: THREE.AnimationMixer

  private actions = new Map<K6Motion, THREE.AnimationAction>()
  private motion: K6Motion = 'idle'
  private landingFor = 0

  constructor(source: THREE.Group & { animations: THREE.AnimationClip[] }) {
    this.object = cloneRigged(source) as THREE.Group
    this.mixer = new THREE.AnimationMixer(this.object)

    this.object.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.SkinnedMesh
        if (K6_PARTS.includes(mesh.name as K6Part)) this.parts.set(mesh.name as K6Part, mesh)
      }
    })

    for (const clip of source.animations) {
      const action = this.mixer.clipAction(clip)
      action.clampWhenFinished = true
      this.actions.set(clip.name as K6Motion, action)
    }

    this.play('idle', 0)
  }

  /** Paints one body part, which is the smallest piece of dressing an avatar. */
  paint(look: K6Look) {
    for (const [name, colour] of Object.entries(look) as [K6Part, string][]) {
      const mesh = this.parts.get(name)
      if (!mesh) continue
      const material = (mesh.material as THREE.MeshStandardMaterial).clone()
      material.color.set(colour)
      mesh.material = material
    }
  }

  play(motion: K6Motion, fade = 0.18) {
    if (motion === this.motion) return
    const next = this.actions.get(motion)
    if (!next) return

    const current = this.actions.get(this.motion)
    next.reset()
    next.setLoop(
      motion === 'jump' || motion === 'land' ? THREE.LoopOnce : THREE.LoopRepeat,
      Infinity,
    )
    next.enabled = true
    next.setEffectiveWeight(1)
    next.play()
    if (current && fade > 0) next.crossFadeFrom(current, fade, false)

    this.motion = motion
  }

  /**
   * What the body should be doing, worked out from what it is doing. The
   * controller says where it is and whether it is on the floor; this decides
   * what that looks like.
   */
  settle(state: { speed: number; grounded: boolean; rising: boolean; emote: boolean }, dt: number) {
    if (this.landingFor > 0) {
      this.landingFor -= dt
      if (this.landingFor > 0) return
    }

    if (!state.grounded) {
      this.play(state.rising ? 'jump' : 'fall')
      return
    }

    if (this.motion === 'fall' || this.motion === 'jump') {
      this.play('land', 0.05)
      this.landingFor = 0.22
      return
    }

    if (state.emote && state.speed < 0.5) { this.play('wave'); return }
    if (state.speed > 14) this.play('run')
    else if (state.speed > 0.6) this.play('walk')
    else this.play('idle')
  }

  update(dt: number) {
    this.mixer.update(dt)
  }

  /**
   * How solid this K6 is drawn, for the person looking out of it.
   *
   * Coming in towards first person the body thins and then is not drawn at
   * all, so that nobody ends up looking at the inside of their own chest.
   * Only whoever is playing this avatar ever calls it: everybody else's K6
   * stays solid.
   */
  fade(amount: number) {
    const held = Math.max(0, Math.min(1, amount))
    for (const mesh of this.parts.values()) {
      const material = mesh.material as THREE.MeshStandardMaterial
      material.transparent = held < 0.999
      material.opacity = held
      // A half see through body must not hide what is behind it.
      material.depthWrite = held > 0.999
    }
  }

  dispose() {
    this.mixer.stopAllAction()
    this.object.removeFromParent()
  }
}
