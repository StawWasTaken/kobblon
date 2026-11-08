import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { blockify } from '../../../src/engine/body'

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(1000, 620)
renderer.setClearColor(0x101012)
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.add(new THREE.HemisphereLight(0xdfe4ff, 0x22242c, 2.1))
const key = new THREE.DirectionalLight(0xffffff, 2.2)
key.position.set(6, 12, 8)
scene.add(key)

const camera = new THREE.PerspectiveCamera(32, 1000 / 620, 0.1, 200)

const gltf = await new GLTFLoader().loadAsync('/k6.glb')
const clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]))

/*
 * One row of bodies. `poses` is the clips and `t` the moments, and the row
 * is the longer of the two with the shorter one repeated - so
 * `?poses=idle,walk,run` compares three clips at one moment, and
 * `?poses=kobdance&t=0,0.2,0.4,0.6` is one clip as a filmstrip, which is
 * the only way to see whether a dance reads as a cycle rather than a pose.
 */
const query = new URLSearchParams(location.search)
const clipNames = (query.get('poses') || 'idle').split(',')
const moments = (query.get('t') || '0.4').split(',').map(Number)
/*
 * The joints that move nothing on a real avatar.
 *
 * **This is on by default, and it is not a simulation of some other rig -
 * it is what `blockify` in `src/engine/body.ts` does to every avatar in
 * every World.** Each of the six parts is one box bound entirely to one
 * bone: LeftArm to `J_ShoulderL`, LeftLeg to `J_HipL`, and so on. Nothing
 * is bound to an elbow, a knee or an ankle, and nothing hangs below one, so
 * a channel on those bones is loaded, interpolated and thrown away.
 *
 * Dropping those channels here is exactly equivalent, and it is the default
 * because the preview's job is to show what a player sees. It did the
 * opposite for four rounds: `k6.glb` loaded raw has proper skinning, so the
 * preview bent elbows that no avatar has ever bent, and round 286's wave -
 * whose entire motion was in the forearm - looked like a wave here and
 * played in a World as an arm held out stiff. Staw found it in a screenshot.
 *
 * `?full=1` loads the rig unblocked, which is worth looking at exactly once
 * when you want to know how much of a clip is being thrown away.
 */
const DEAD = ['Elbow', 'Knee', 'Ankle']
const dropped = query.get('full') ? [] : (query.get('drop') || DEAD.join(',')).split(',').filter(Boolean)
const thin = (clip) => {
  if (!dropped.length) return clip
  const cut = clip.clone()
  cut.tracks = cut.tracks.filter(
    (one) => !dropped.some((part) => one.name.includes(part)),
  )
  return cut
}
const columns = Math.max(clipNames.length, moments.length)
const poses = Array.from({ length: columns }, (_, i) => clipNames[i % clipNames.length])

const mixers = []
poses.forEach((name, i) => {
  const who = gltf.scene.clone(true)
  // a cloned skinned mesh needs its skeleton rebound
  const bones = {}
  who.traverse((o) => { if (o.isBone) bones[o.name] = o })
  who.traverse((o) => {
    if (o.isSkinnedMesh) {
      const skeleton = new THREE.Skeleton(
        o.skeleton.bones.map((b) => bones[b.name]), o.skeleton.boneInverses,
      )
      o.bind(skeleton, o.bindMatrix)
    }
  })
  /*
   * The same call every avatar in every World goes through. Not an
   * imitation of it - the function itself, imported from the engine.
   *
   * Dropping the dead channels above was only half of what blockify does:
   * it also replaces the file's skinned tubes with one rigid box per bone.
   * A preview that kept the tubes still showed an arm that bends and
   * stretches where a player sees a plank swinging from the shoulder, so a
   * pose could read here and look like nothing in a World. Staw found that
   * one in a screenshot too.
   */
  blockify(who)
  who.position.x = (i - (poses.length - 1) / 2) * 7
  scene.add(who)
  const mixer = new THREE.AnimationMixer(who)
  if (clips[name]) mixer.clipAction(thin(clips[name])).play()
  mixer.setTime(moments[i % moments.length])
  mixers.push(mixer)
})

/*
 * Far enough back that the whole body is in frame including the feet. It
 * used to frame to the row's width alone, which cut the head off a clip
 * with its arms up and the feet off every clip there is.
 */
const span = Math.max(16, poses.length * 9)
camera.position.set(0, 5.6, span * 1.6)
camera.lookAt(0, 4.6, 0)

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x1a1b20 }),
)
floor.rotation.x = -Math.PI / 2
scene.add(floor)

renderer.render(scene, camera)
window.k6ready = true
