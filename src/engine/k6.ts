import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js'
import {
  COVERS, templateFor, wrapToTemplate, type BodyPart, type Clothing,
} from './clothes'
import { blockify, PLACES } from './body'
import { BODY } from './clothes'

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

/*
 * The four places on a part something can hang from, worked out from the
 * body table rather than written down beside it.
 *
 * These were measured numbers once, copied off the rig. Then the rig's
 * proportions changed and they did not, which put a hat a quarter of a ston
 * inside a skull. Reading them from the same table the geometry is built
 * from means a change to the body moves the hat with it.
 */
const middleOf = (part: keyof typeof BODY) => PLACES[part].middle
const top = (part: keyof typeof BODY): readonly [number, number, number] =>
  [middleOf(part)[0], middleOf(part)[1] + BODY[part].h / 2, middleOf(part)[2]]
const bottom = (part: keyof typeof BODY): readonly [number, number, number] =>
  [middleOf(part)[0], middleOf(part)[1] - BODY[part].h / 2, middleOf(part)[2]]
const front = (part: keyof typeof BODY): readonly [number, number, number] =>
  [middleOf(part)[0], middleOf(part)[1], middleOf(part)[2] + BODY[part].d / 2]
const back = (part: keyof typeof BODY): readonly [number, number, number] =>
  [middleOf(part)[0], middleOf(part)[1], middleOf(part)[2] - BODY[part].d / 2]

/**
 * Where something worn hangs off the body.
 *
 * The names are the slots a Catalog sells into, so adding a slot here and
 * adding one to the shop is the same thought. Each one is a bone to follow
 * and a place in the body's rest pose - measured off the model rather than
 * guessed, because a hat half a ston into the skull is the kind of wrong
 * that only shows up on somebody else's screen.
 *
 * The offsets below are read in the rest pose and turned into bone-local
 * space when an avatar is built, so a bone that is modelled rotated still
 * puts the hat on the head rather than beside it.
 */
export const K6_POINTS = {
  /** On top of the head: hats, hair, crowns. */
  hat: { bone: 'J_Head', at: top('Head') },
  /** The front of the head, where a face goes. */
  face: { bone: 'J_Head', at: front('Head') },
  /** Round the neck: scarves, collars, chains. */
  neck: { bone: 'J_Neck', at: top('Torso') },
  /** Behind the shoulders: wings, backpacks, capes. */
  back: { bone: 'J_Chest', at: back('Torso') },
  /** On the chest, in front. */
  front: { bone: 'J_Chest', at: front('Torso') },
  /** The end of each arm. There are no hands on K6; this is where one ends. */
  leftHand: { bone: 'J_ShoulderL', at: bottom('LeftArm') },
  rightHand: { bone: 'J_ShoulderR', at: bottom('RightArm') },
  /** Round the middle. */
  waist: { bone: 'J_Hips', at: bottom('Torso') },
} as const

export type K6Point = keyof typeof K6_POINTS

/**
 * How big the front of the head is, so a face fills it.
 *
 * The head measures 2.68 across and 2.5 through, and a face that is the
 * whole width of it reads as a sticker wrapped round the corners. A shade
 * narrower, and standing a hair proud of the surface so it never fights the
 * head for the same pixels.
 */
export const K6_FACE_SIZE = Math.min(BODY.Head.w, BODY.Head.h) * 0.85
const FACE_GAP = 0.02

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

  /** The bone for each slot, found once, and what is hanging on each. */
  private sockets = new Map<K6Point, THREE.Object3D>()
  private worn = new Map<K6Point, THREE.Object3D>()
  private face: THREE.Mesh | null = null
  /** Which parts have been given template coordinates, so it is done once. */
  private wrapped = new Set<string>()
  private clothes = new Map<Clothing, THREE.Texture>()

  constructor(source: THREE.Group & { animations: THREE.AnimationClip[] }) {
    this.object = cloneRigged(source) as THREE.Group
    // Blocky, and to the clone: see the note in `body.ts` about why this
    // never touches the loaded source.
    blockify(this.object)
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

    this.buildSockets()
    this.play('idle', 0)
  }

  /*
   * One empty object per slot, parented to its bone and placed where the
   * slot is in the rest pose.
   *
   * Through `worldToLocal` rather than by writing offsets in bone space by
   * hand: a bone can be modelled with any orientation, and an offset written
   * for one of them is wrong for the next. The numbers in `K6_POINTS` are
   * measured off the body standing still, which is the one frame of
   * reference a person can check with a ruler.
   */
  private buildSockets() {
    const bones = new Map<string, THREE.Bone>()
    this.object.traverse((child) => {
      if ((child as THREE.Bone).isBone) bones.set(child.name, child as THREE.Bone)
    })
    this.object.updateMatrixWorld(true)

    for (const [name, where] of Object.entries(K6_POINTS) as [K6Point, { bone: string; at: readonly number[] }][]) {
      const bone = bones.get(where.bone)
      if (!bone) continue
      const socket = new THREE.Object3D()
      socket.name = `socket:${name}`
      socket.position.copy(
        bone.worldToLocal(new THREE.Vector3(where.at[0], where.at[1], where.at[2])),
      )
      bone.add(socket)
      this.sockets.set(name, socket)
    }
  }

  /**
   * Puts something on. Whatever was in that slot comes off first, because a
   * slot holds one thing - two hats is a bug, not a style.
   *
   * The object is taken as it is and not scaled: a Catalog item is modelled
   * to fit K6, and an avatar that quietly resizes what it is given is an
   * avatar nobody can model for.
   */
  wear(point: K6Point, thing: THREE.Object3D) {
    const socket = this.sockets.get(point)
    if (!socket) return
    this.takeOff(point)
    socket.add(thing)
    this.worn.set(point, thing)
  }

  /** Takes off whatever is in a slot, and hands it back so a caller can free it. */
  takeOff(point: K6Point): THREE.Object3D | null {
    const had = this.worn.get(point) ?? null
    if (had) {
      had.removeFromParent()
      this.worn.delete(point)
    }
    return had
  }

  /** What is in each slot, for anybody who needs to know without guessing. */
  wearing(): ReadonlyMap<K6Point, THREE.Object3D> {
    return this.worn
  }

  /**
   * The face, which is a picture on the front of the head rather than a
   * thing hung off it.
   *
   * A plane in the face slot, standing a hair proud of the head so the two
   * never fight for the same pixels - which reads as the face flickering
   * when somebody walks. Null takes it off, and the texture is left for
   * whoever owns it to dispose: this did not load it and does not know who
   * else is using it.
   */
  setFace(picture: THREE.Texture | null) {
    if (!picture) {
      if (this.face) {
        this.face.removeFromParent()
        ;(this.face.material as THREE.Material).dispose()
        this.face.geometry.dispose()
        this.face = null
      }
      return
    }

    picture.colorSpace = THREE.SRGBColorSpace

    if (!this.face) {
      const socket = this.sockets.get('face')
      if (!socket) return
      this.face = new THREE.Mesh(
        new THREE.PlaneGeometry(K6_FACE_SIZE, K6_FACE_SIZE),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      )
      this.face.name = 'face'
      this.face.position.z = FACE_GAP
      socket.add(this.face)
    }

    const material = this.face.material as THREE.MeshBasicMaterial
    material.map = picture
    material.needsUpdate = true
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

  /**
   * Puts a shirt or trousers on: one picture, laid over several parts by the
   * template.
   *
   * Both at once is ordinary - a shirt covers the torso and so do trousers -
   * so the torso ends up wearing two pictures, and the one on top is the one
   * drawn last. Trousers under shirt, the way clothes work, so a shirt tucked
   * over a waistband looks like a shirt over a waistband.
   *
   * Null takes that layer off. The texture is left for whoever loaded it to
   * dispose: this did not fetch it and does not know who else is wearing it.
   */
  dress(kind: Clothing, picture: THREE.Texture | null) {
    if (picture) this.clothes.set(kind, picture)
    else this.clothes.delete(kind)

    for (const part of COVERS[kind]) {
      const mesh = this.parts.get(part as K6Part)
      if (!mesh) continue
      this.wrapOnce(mesh, part, kind)
    }

    this.redress()
  }

  /** What is being worn as clothing, by layer. */
  wearingClothes(): ReadonlyMap<Clothing, THREE.Texture> {
    return this.clothes
  }

  /*
   * Template coordinates, computed the first time a part is asked to wear
   * something and kept.
   *
   * Once per part per kind, not once per change of shirt: the coordinates
   * depend on the body and the template, and neither changes when somebody
   * puts on a different shirt. Doing it on every change was the obvious
   * version and would have rewritten six geometries every time a person
   * clicked through a Catalog.
   */
  private wrapOnce(mesh: THREE.SkinnedMesh, part: string, kind: Clothing) {
    const mark = `${kind}:${part}`
    if (this.wrapped.has(mark)) return
    const box = new THREE.Box3().setFromBufferAttribute(
      mesh.geometry.getAttribute('position') as THREE.BufferAttribute,
    )
    wrapToTemplate(
      mesh.geometry,
      part as BodyPart,
      templateFor(kind),
      box.getCenter(new THREE.Vector3()),
    )
    this.wrapped.add(mark)
  }

  /*
   * Draws the layers that are on, in order.
   *
   * One material per part with one map is all three.js gives for free, so a
   * part covered by both a shirt and trousers wears the topmost of the two.
   * Being honest about that rather than pretending: the alternative is a
   * second pass per part, which is twenty more draw calls per avatar in a
   * World that may hold twenty of them, and that is a trade to make when
   * somebody asks for it rather than now.
   */
  private redress() {
    for (const [name, mesh] of this.parts) {
      const over = (['trousers', 'shirt'] as const)
        .filter((kind) => this.clothes.has(kind)
          && (COVERS[kind] as readonly string[]).includes(name))
      const top = over[over.length - 1]
      const material = mesh.material as THREE.MeshStandardMaterial
      const picture = top ? this.clothes.get(top) ?? null : null

      if (material.map !== picture) {
        material.map = picture
        if (picture) {
          picture.channel = 1
          picture.colorSpace = THREE.SRGBColorSpace
          picture.needsUpdate = true
        }
        material.needsUpdate = true
      }
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
    this.setFace(null)
    for (const point of [...this.worn.keys()]) this.takeOff(point)
    this.object.removeFromParent()
  }
}
