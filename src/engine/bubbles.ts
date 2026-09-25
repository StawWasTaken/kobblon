import * as THREE from 'three'
import type { ChatLine } from './chat'
import { K6_HEIGHT } from './units'

/**
 * What somebody just said, over their head.
 *
 * Roblox's system: the last few things a person said stack above them, the
 * oldest drifting up and away, and they go on their own after a few seconds.
 * A bubble is readable at a distance and gone before it becomes clutter,
 * which is the whole job.
 *
 * Drawn as ordinary elements over the canvas rather than as sprites in the
 * scene. Text in a 3D texture is either blurry or expensive, and neither is
 * worth it for something that always faces the camera anyway: projecting a
 * point and putting a div there is sharper, cheaper, and styled with CSS
 * like the rest of Kobblon. The cost is that bubbles do not hide behind
 * walls, which is the same trade Roblox makes.
 */

/** How long a bubble stays, plus a moment for each word to be read. */
const LEAST = 4000
const PER_CHARACTER = 45
const MOST = 12000

/** How many one person can have over them at once. */
const STACKED = 3

/** Past this, far enough away that a bubble is noise rather than news. */
const HEARD_WITHIN = 140

type Bubble = {
  line: ChatLine
  element: HTMLElement
  until: number
}

export class BubbleBoard {
  private over = new Map<THREE.Object3D, Bubble[]>()
  private layer: HTMLElement
  private middle = new THREE.Vector3()
  private toward = new THREE.Vector3()

  /**
   * The layer sits over the canvas and never takes a click: a bubble is
   * something you read, not something you press, and one landing over a
   * door you were about to open must not stop you opening it.
   */
  constructor(private canvas: HTMLCanvasElement) {
    this.layer = document.createElement('div')
    this.layer.className = 'kob-bubbles'
    this.layer.setAttribute('aria-hidden', 'true')
    Object.assign(this.layer.style, {
      position: 'absolute', inset: '0', overflow: 'hidden',
      pointerEvents: 'none', zIndex: '5',
    })

    const holder = canvas.parentElement
    if (holder) {
      if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative'
      holder.appendChild(this.layer)
    }
  }

  /** Put one over somebody. `who` is whatever object follows their head. */
  add(who: THREE.Object3D, line: ChatLine) {
    const element = document.createElement('div')
    element.className = 'kob-bubble'
    // textContent, never innerHTML: a message is text, and a message that
    // could become markup is the whole of this class of bug.
    element.textContent = line.text
    Object.assign(element.style, {
      position: 'absolute',
      transform: 'translate(-50%, -100%)',
      maxWidth: '22rem',
      padding: '0.4rem 0.7rem',
      borderRadius: '0.9rem',
      background: 'rgba(17, 20, 28, 0.86)',
      color: '#f4f6fb',
      font: '600 0.9rem/1.35 system-ui, sans-serif',
      textAlign: 'center',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      boxShadow: '0 10px 24px -12px rgba(0,0,0,0.9)',
      transition: 'opacity 180ms ease, transform 180ms ease',
      opacity: '0',
    })

    this.layer.appendChild(element)
    // Next frame, so the transition has something to move from.
    requestAnimationFrame(() => { element.style.opacity = '1' })

    const stack = this.over.get(who) ?? []
    stack.push({
      line,
      element,
      until: Date.now() + Math.min(LEAST + line.text.length * PER_CHARACTER, MOST),
    })

    // The oldest goes when a fourth arrives, rather than growing a column
    // of text up the screen.
    while (stack.length > STACKED) this.drop(stack.shift()!)
    this.over.set(who, stack)
  }

  /**
   * Position every bubble, once a frame.
   *
   * `hide` is how first person works: your own bubbles are not drawn over
   * your own eyes. Somebody else's still are.
   */
  update(camera: THREE.Camera, hide?: THREE.Object3D) {
    const now = Date.now()
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    camera.getWorldPosition(this.toward)

    for (const [who, stack] of this.over) {
      for (const bubble of [...stack]) {
        if (now > bubble.until) {
          this.drop(bubble)
          stack.splice(stack.indexOf(bubble), 1)
        }
      }
      if (!stack.length) {
        this.over.delete(who)
        continue
      }

      who.getWorldPosition(this.middle)
      const away = this.middle.distanceTo(this.toward)
      this.middle.y += K6_HEIGHT * 1.05

      const at = this.middle.clone().project(camera)
      // Behind the camera, too far to matter, or hidden because it is you.
      const shown = at.z < 1 && away < HEARD_WITHIN && who !== hide

      let lift = 0
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        const bubble = stack[i]
        const style = bubble.element.style
        if (!shown) { style.opacity = '0'; continue }

        // Older ones sit higher, smaller and fainter, so the newest reads
        // first without anything jumping when one goes.
        const age = stack.length - 1 - i
        const size = 1 - age * 0.12
        const fading = Math.max(0, Math.min(1, (bubble.until - now) / 600))

        style.left = `${(at.x * 0.5 + 0.5) * width}px`
        style.top = `${(-at.y * 0.5 + 0.5) * height - lift}px`
        style.transform = `translate(-50%, -100%) scale(${size.toFixed(3)})`
        style.opacity = `${(fading * (1 - age * 0.25)).toFixed(3)}`

        lift += bubble.element.offsetHeight * size + 6
      }
    }
  }

  /** Everything over one person, gone. They left, or the World closed. */
  forget(who: THREE.Object3D) {
    for (const bubble of this.over.get(who) ?? []) this.drop(bubble)
    this.over.delete(who)
  }

  clear() {
    for (const stack of this.over.values()) for (const bubble of stack) this.drop(bubble)
    this.over.clear()
  }

  private drop(bubble: Bubble) {
    bubble.element.style.opacity = '0'
    // Let it fade rather than blink out. Removing the node is what matters;
    // when that happens is not.
    setTimeout(() => bubble.element.remove(), 200)
  }

  dispose() {
    this.clear()
    this.layer.remove()
  }
}
