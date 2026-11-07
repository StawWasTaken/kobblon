/*
 * The chat bubble and the mark over a head, over a bright World and a dark
 * one.
 *
 * BubbleBoard draws into the canvas's parent and positions by projecting a
 * point, so the only honest way to look at it is with a real camera and a
 * real object - no React, no page, nothing it could be leaning on.
 */
import * as THREE from 'three'
import { BubbleBoard, type ChatLine } from '@/engine'

const SAID = [
  'E',
  'only the newest one keeps its tail',
  'families stay whole now 👨‍👩‍👧 and so do flags 🏳️‍🌈',
]

function board(holder: HTMLElement, light: boolean) {
  const panel = document.createElement('div')
  Object.assign(panel.style, {
    position: 'relative', height: '50vh',
    background: light
      ? 'linear-gradient(#eaf2ff, #ffffff)'
      : 'linear-gradient(#0b0d13, #171a24)',
  })
  const canvas = document.createElement('canvas')
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block' })
  panel.appendChild(canvas)
  holder.appendChild(panel)

  const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 100)
  camera.position.set(0, 1.5, 7)
  const who = new THREE.Object3D()
  // Low enough that the stack sits inside the panel rather than above it.
  who.position.set(0, -12, 0)

  const bubbles = new BubbleBoard(canvas)
  SAID.forEach((text, i) => {
    const line: ChatLine = {
      id: String(i), from: 'Staw', who: 'staw-id', text, kind: 'said', at: Date.now(),
    }
    bubbles.add(who, line)
  })

  /*
   * And the voice mark, which is the thing to look at here: above the
   * stack, not in it, and still drawn on the head with nothing said.
   */
  bubbles.mark(who, 'voice', { level: 0.8 })

  /*
   * Three levels side by side, which is the only way to see whether the
   * fill inside the glyph actually reads: one loud, one speaking, one on
   * the floor. The last is what a mark looks like at the quietest it is
   * ever drawn - it is never put up at all while somebody is silent.
   */
  const quiet = new THREE.Object3D()
  quiet.position.set(3.2, -12, 0)
  bubbles.mark(quiet, 'voice', { level: 0.18 })

  const floor = new THREE.Object3D()
  floor.position.set(-3.2, -12, 0)
  bubbles.mark(floor, 'voice', { level: 0 })

  /*
   * And the muted one, on a loop: the slashed drawing, held, gone, and put
   * back a moment later so there is always one to look at. Round 68 asked
   * for the swap to be readable before the bubble leaves, and the only way
   * to know whether it is is to watch it happen.
   */
  /*
   * The comparison Staw drew: one letter in a bubble, and the mark over
   * it. They have to be the same box, because that is what he asked for -
   * "as big as if there was one character in it".
   */
  const same = new THREE.Object3D()
  same.position.set(-6.4, -12, 0)
  bubbles.add(same, {
    id: 'one', from: 'Staw', who: 'staw-id', text: 'E', kind: 'said', at: Date.now(),
  })
  bubbles.mark(same, 'voice', { level: 0.7 })

  const muting = new THREE.Object3D()
  muting.position.set(6.4, -12, 0)
  const loop = () => {
    bubbles.mark(muting, 'voice', { level: 0.6 })
    setTimeout(() => bubbles.mark(muting, 'voice', { muted: true }), 1400)
    setTimeout(loop, 3000)
  }
  loop()

  const tick = () => {
    camera.aspect = (canvas.clientWidth || 2) / (canvas.clientHeight || 1)
    camera.updateProjectionMatrix()
    // Nothing is in a scene here, so nobody else updates these.
    camera.updateMatrixWorld(true)
    who.updateMatrixWorld(true)
    quiet.updateMatrixWorld(true)
    floor.updateMatrixWorld(true)
    muting.updateMatrixWorld(true)
    same.updateMatrixWorld(true)
    bubbles.update(camera)
    requestAnimationFrame(tick)
  }
  tick()
}

const root = document.getElementById('root')!
board(root, true)
board(root, false)
