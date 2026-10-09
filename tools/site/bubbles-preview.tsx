/*
 * The chat bubble, over a bright World and a dark one.
 *
 * BubbleBoard draws into the canvas's parent and positions by projecting a
 * point, so the only honest way to look at it is with a real camera and a
 * real object — no React, no page, nothing it could be leaning on.
 */
import * as THREE from 'three'
import { BubbleBoard, type ChatLine } from '@/engine'

const SAID = [
  'hey',
  'this is what fifteen seconds of someone talking looks like over a head',
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

  const tick = () => {
    camera.aspect = (canvas.clientWidth || 2) / (canvas.clientHeight || 1)
    camera.updateProjectionMatrix()
    // Nothing is in a scene here, so nobody else updates these.
    camera.updateMatrixWorld(true)
    who.updateMatrixWorld(true)
    bubbles.update(camera)
    requestAnimationFrame(tick)
  }
  tick()
}

const root = document.getElementById('root')!
board(root, true)
board(root, false)
