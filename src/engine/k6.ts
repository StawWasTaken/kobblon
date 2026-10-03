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

/**
 * The box a face fills on the head.
 *
 * The old square, times 1.2, which is exactly what Staw asked for after
 * seeing the first go: "the faces are TOO BIG, go back to how it was before
 * but 1.2x bigger". Written as a multiple of the old number rather than as a
 * new fraction of the head, so what it is a change *from* is readable.
 *
 * It had been two changes at once - a bigger box, and the picture cropped to
 * its own drawing - and the two multiplied. The crop is gone (see `setFace`)
 * and this is the whole of how big a face is now.
 *
 * `FACE_ACROSS` is the width as seen from the front, in stons. The surface
 * is curved, so the picture is wrapped over rather more than that: the arc
 * is worked out from the chord.
 */
const FACE_ACROSS = K6_FACE_SIZE * 1.2
const FACE_TALL = K6_FACE_SIZE * 1.2

/** The head is a cylinder, so this is what a face is bent around. */
const HEAD_RADIUS = BODY.Head.d / 2

const FACE_GAP = 0.02

/**
 * How big a worn thing should be, and which way it sits off its socket.
 *
 * `across` is the widest the thing may be, in stons, measured against the
 * body part it hangs on. `out` is the direction it moves to rest against the
 * body rather than inside it: a hat goes up off the top of the head, a
 * backpack goes back off the shoulders, and both of those are a half of the
 * thing's own size once it has been scaled.
 */
const WORN_FIT: Record<K6Point, { across: number; out: readonly [number, number, number] }> = {
  hat: { across: BODY.Head.w * 1.3, out: [0, 1, 0] },
  face: { across: K6_FACE_SIZE, out: [0, 0, 1] },
  neck: { across: BODY.Torso.w * 0.9, out: [0, 0, 0] },
  back: { across: BODY.Torso.w, out: [0, 0, -1] },
  front: { across: BODY.Torso.w * 0.7, out: [0, 0, 1] },
  leftHand: { across: BODY.LeftArm.w * 1.4, out: [0, -1, 0] },
  rightHand: { across: BODY.RightArm.w * 1.4, out: [0, -1, 0] },
  waist: { across: BODY.Torso.w * 1.1, out: [0, -1, 0] },
}

/**
 * Sits an uploaded model on a socket: the right size, and actually there.
 *
 * Two things, and the second one is the bug nobody saw coming. Scaling was
 * already done - a hat modelled in metres is a hat the size of a building -
 * but a model is also **drawn around whatever origin its author worked at**,
 * and that origin is not the middle of the hat. Scaling an off-centre model
 * scales its offset too, which is how a bicorne ended up floating an arm's
 * length to the right of the head: correctly sized, correctly parented, and
 * nowhere near the body.
 *
 * So: scale, then measure where the thing actually is, then move it so its
 * own middle lands on the socket, then push it along `out` by half its size
 * so it rests on the part rather than halfway through it.
 *
 * Here rather than in the page because the website, the card drawing and the
 * Workspace all put accessories on bodies, and three separate ideas of where
 * a hat goes is three different-looking avatars for one person.
 */
/**
 * How a maker placed a thing, on top of the automatic fit.
 *
 * `p` in stons, `r` in degrees, `s` a multiplier on the fitted size. Applied
 * **after** the fit rather than instead of it, which is the whole design:
 * every number is zero for an item nobody has touched, so an accessory that
 * is never adjusted sits exactly where the measuring put it.
 */
export type WornFit = {
  p?: readonly [number, number, number]
  r?: readonly [number, number, number]
  s?: number
}

export function fitToSocket(model: THREE.Object3D, point: K6Point, placed?: WornFit | null) {
  const fit = WORN_FIT[point]
  if (!fit) return model

  /*
   * Scale, then turn, then measure, then place. The order is the whole of
   * it, and it is why there is no arithmetic correcting for anything here.
   *
   * The first version turned the model last, which turns it about its own
   * origin - and a model's origin is wherever its author left it, which for
   * an uploaded hat is routinely outside the hat. So a few degrees of turn
   * swung the thing off the head in an arc. Staw's words: it should turn on
   * itself.
   *
   * Measuring *after* the turn fixes that without a correction term,
   * because the centring is then centring the turned shape. Whatever a
   * rotation does to where the geometry sits, the next line puts its middle
   * back on the socket.
   */
  /*
   * All three, and the third one is the bug Staw found.
   *
   * Position and rotation were reset and scale was not, while the line
   * below *multiplies* the scale - so fitting the same model a second time
   * multiplied again. Switching accessories does exactly that, and the
   * thing came out at the square of the size it should be, or a sixteenth
   * of it, depending which way the maker's resize went.
   *
   * The rule this breaks is the one worth naming: a function that puts an
   * object somewhere must set every part of where it is, not the parts that
   * happened to need setting the first time it was written. Two out of
   * three is a function that works once.
   */
  model.position.set(0, 0, 0)
  model.rotation.set(0, 0, 0)
  model.scale.set(1, 1, 1)
  model.updateMatrixWorld(true)

  const first = new THREE.Box3().setFromObject(model)
  const span = first.getSize(new THREE.Vector3())
  const widest = Math.max(span.x, span.y, span.z)
  if (widest > 1e-6) model.scale.multiplyScalar(fit.across / widest)

  // The maker's resize multiplies what the measuring worked out rather than
  // replacing it, so an accessory nobody has touched is exactly as before.
  const grow = placed?.s ?? 1
  if (grow !== 1 && Number.isFinite(grow) && grow > 0) model.scale.multiplyScalar(grow)

  const [rx, ry, rz] = placed?.r ?? [0, 0, 0]
  if (rx || ry || rz) {
    const turn = Math.PI / 180
    model.rotation.set(rx * turn, ry * turn, rz * turn)
  }

  model.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(model)
  const middle = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  model.position.sub(middle)
  model.position.add(new THREE.Vector3(
    (fit.out[0] * size.x) / 2,
    (fit.out[1] * size.y) / 2,
    (fit.out[2] * size.z) / 2,
  ))

  const [px, py, pz] = placed?.p ?? [0, 0, 0]
  if (px || py || pz) model.position.add(new THREE.Vector3(px, py, pz))

  return model
}

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
  private worn = new Map<K6Point, THREE.Object3D[]>()
  private face: THREE.Mesh | null = null
  private decal: THREE.Mesh | null = null
  /** Which parts have been given template coordinates, so it is done once. */
  private wrapped = new Set<string>()
  private clothes = new Map<Clothing, THREE.Texture>()
  /** The colour each part was painted, under whatever it is wearing. */
  private skin = new Map<K6Part, string>()

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
   * Puts something on, on its own: whatever was hanging there comes off.
   *
   * Two hats was a bug for a year and is a style now - Staw asked for it -
   * but a socket that *replaces* is still what most callers want, so that
   * stayed the plain verb and adding got its own. A shirt, a face and a
   * haircut can only ever be one, and nothing should have to remember to
   * clear first to get that.
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
    this.worn.set(point, [thing])
  }

  /**
   * Puts something on **beside** what is already there.
   *
   * The same socket, so both are measured and seated the same way and both
   * follow the bone. Two hats overlap, which is exactly what was asked for:
   * "even if itll look ugly, its possible".
   */
  wearAlso(point: K6Point, thing: THREE.Object3D) {
    const socket = this.sockets.get(point)
    if (!socket) return
    socket.add(thing)
    this.worn.set(point, [...(this.worn.get(point) ?? []), thing])
  }

  /**
   * Takes off everything in a slot, and hands it all back so a caller can
   * free it.
   *
   * An array rather than one object, and it returns them all rather than the
   * first: a caller that frees what it is given would otherwise leak every
   * hat but one, which is the kind of leak nobody sees until a page has been
   * open an hour.
   */
  takeOff(point: K6Point): THREE.Object3D[] {
    const had = this.worn.get(point) ?? []
    for (const one of had) one.removeFromParent()
    this.worn.delete(point)
    return had
  }

  /** Takes off one particular thing, wherever it is hanging. */
  takeOffOne(thing: THREE.Object3D): boolean {
    for (const [point, things] of this.worn) {
      if (!things.includes(thing)) continue
      thing.removeFromParent()
      const left = things.filter((one) => one !== thing)
      if (left.length) this.worn.set(point, left)
      else this.worn.delete(point)
      return true
    }
    return false
  }

  /** What is in each slot, for anybody who needs to know without guessing. */
  wearing(): ReadonlyMap<K6Point, readonly THREE.Object3D[]> {
    return this.worn
  }

  /**
   * The face, which is a picture **on** the head rather than in front of it.
   *
   * It was a flat square standing a fingernail off the front, which reads as
   * a sticker from anywhere but dead ahead and comes away from the head at
   * the corners. Staw: "make that the faces really are onto the head, not
   * infront (like the image is curvy literally onto the head)". So it is a
   * slice of a cylinder of exactly the head's radius, a hair proud of it,
   * centred on the head's own axis - which is why it is pushed back a radius
   * from the face socket, since that socket sits on the front surface.
   *
   * The arc is the one whose *chord* is `FACE_ACROSS`: wrapping a picture
   * over an arc of that length would draw a face wider than the head looks,
   * because an arc is longer than the chord under it. This way a face is as
   * wide from the front as it says it is, and the extra is spent curving
   * away round the sides, which is what a face on a head does.
   *
   * The picture is drawn whole. A first go cropped each one to the part of
   * its file that was actually drawn on, so that two faces with different
   * margins came out the same size - and the crop multiplied with the
   * bigger box and made every face far too big. A face is its file, laid in
   * this box, the way it always was.
   *
   * Null takes it off, and the texture is left for whoever owns it to
   * dispose: this did not load it and does not know who else is using it.
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

      const radius = HEAD_RADIUS + FACE_GAP
      // The angle whose chord is the width we want the face to read as.
      const arc = 2 * Math.asin(Math.min(FACE_ACROSS / 2 / radius, 1))

      /*
       * An open-ended cylinder, which is a curved sheet when you only ask
       * for a slice of one. Its `u` runs with the angle and its `v` runs up
       * it, so the picture lands the right way up and the right way round -
       * at theta zero the surface faces +Z, which is the front, and theta
       * grows towards +X, which is the way `u` grows.
       */
      this.face = new THREE.Mesh(
        new THREE.CylinderGeometry(
          radius, radius, FACE_TALL,
          // Enough segments that the curve is a curve rather than a fold.
          24, 1, true, -arc / 2, arc,
        ),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      )
      this.face.name = 'face'
      // Back onto the head's axis: the socket is on the front surface, and a
      // cylinder is measured from its middle.
      this.face.position.z = -HEAD_RADIUS
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
      mesh.material = material
      // Remembered, because a part wearing clothing is drawn white and has
      // to get its colour back when the clothing comes off.
      this.skin.set(name, colour)
    }
    this.redress()
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

  /**
   * A tdecal: any picture, stuck straight onto the front of the torso.
   *
   * Staw's one that anybody can make. Not clothing - it does not go through
   * a template and does not wrap round the sides - so it is a plane in front
   * of the chest rather than a texture on the body, which is also what lets
   * it sit over a shirt instead of fighting it for the torso's one map.
   *
   * The size of the torso's front face exactly, so whatever the picture is
   * gets stretched over it.
   */
  stick(picture: THREE.Texture | null) {
    if (!picture) {
      if (this.decal) {
        this.decal.removeFromParent()
        ;(this.decal.material as THREE.Material).dispose()
        this.decal.geometry.dispose()
        this.decal = null
      }
      return
    }

    picture.colorSpace = THREE.SRGBColorSpace
    /*
     * The whole front of the torso, stretched to fit it.
     *
     * It used to keep the picture's own shape and sit a little inside the
     * edges, which made a t-decal a sticker somebody put on a shirt. Staw:
     * a t-decal *is* the front of the torso. So the plane is the torso's
     * face exactly, and a picture that is not that shape is stretched -
     * which is the deal, and the reason a square one looks right.
     */
    const wide = BODY.Torso.w
    const tall = BODY.Torso.h

    if (this.decal) {
      this.decal.geometry.dispose()
      this.decal.geometry = new THREE.PlaneGeometry(wide, tall)
    } else {
      const socket = this.sockets.get('front')
      if (!socket) return
      this.decal = new THREE.Mesh(
        new THREE.PlaneGeometry(wide, tall),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      )
      this.decal.name = 'tdecal'
      // A hair in front of the chest, like the face is in front of the head.
      this.decal.position.z = 0.02
      socket.add(this.decal)
    }

    const material = this.decal.material as THREE.MeshBasicMaterial
    material.map = picture
    material.needsUpdate = true
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

      /*
       * White under a picture, and the painted colour under nothing.
       *
       * three.js multiplies `map` by `color`, so a shirt on a torso painted
       * navy came out navy-times-shirt - Staw: the body colour modifies the
       * clothes and it should not. Skin is a colour; clothing is a picture;
       * a picture tinted by what is underneath it is not the picture
       * somebody drew.
       *
       * Set every time rather than only on a change of map, because the
       * colour and the map change for different reasons - painting a part
       * does not change what it wears, and that is exactly the case where
       * the old colour would survive underneath.
       */
      const want = picture ? '#ffffff' : (this.skin.get(name) ?? null)
      if (want && material.color.getHexString() !== want.replace('#', '')) {
        material.color.set(want)
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
    this.stick(null)
    for (const point of [...this.worn.keys()]) this.takeOff(point)
    this.object.removeFromParent()
  }
}
