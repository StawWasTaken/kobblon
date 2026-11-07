import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

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
  who.position.x = (i - (poses.length - 1) / 2) * 7
  scene.add(who)
  const mixer = new THREE.AnimationMixer(who)
  if (clips[name]) mixer.clipAction(clips[name]).play()
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
