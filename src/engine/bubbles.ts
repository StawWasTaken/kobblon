import * as THREE from 'three'
import type { ChatLine } from './chat'
import { K6_HEIGHT } from './units'
import { ZOOM_FAR } from './experience'

/**
 * The gap between the top of somebody and the bottom of their bubble.
 *
 * It was `K6_HEIGHT * 1.05` measured from the feet, which is the top of a
 * *bare* head — so anybody in a tall hat wore their own bubble. Staw, who
 * wears one: "if theres accessories ontop of the head then we make sure
 * the gap between the chatbubble and the head is the same we have between
 * the chatbubble and the accessories." Same gap, measured from whatever is
 * actually up there.
 */
const ABOVE = K6_HEIGHT * 0.05

/** How often the top of somebody is measured again. */
const RE_MEASURE = 500

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

/**
 * How long a bubble stays.
 *
 * Fifteen seconds, which is what Staw asked for twice. It was the ceiling
 * before, and a ceiling is not what he asked for: at 45ms a character a
 * line needed 245 of them to reach fifteen seconds, so "eee" got four. The
 * reasoning for the scale was sound and the arithmetic made it a different
 * feature from the one requested.
 *
 * So it is the floor now. Fifteen seconds for anything, longer for
 * something long enough to need it, and a hard stop at twenty so one
 * enormous line cannot sit over somebody's head for most of a minute.
 */
const LEAST = 15000
const PER_CHARACTER = 45
const MOST = 20000

/** How many one person can have over them at once. */
const STACKED = 3

/** Past this, far enough away that a bubble is noise rather than news. */
const HEARD_WITHIN = 140

/**
 * How a bubble shrinks with distance.
 *
 * It did not, and that was the whole of "they feel like theyre on the
 * screen but they dont feel like they are hover the player heads in the
 * space of the world". The apps measured it: 107 by 38 at six stons and
 * 107 by 38 at sixty. A thing in a World gets smaller as you walk away
 * from it and a thing stuck to the glass does not, and that one property
 * was all that was left reading as furniture.
 *
 * Inside `PLAIN_WITHIN` it is full size, because a bubble growing as
 * somebody walks towards you is its own kind of wrong. Past that it falls
 * off with distance and stops at `SMALLEST`, so a bubble across a World is
 * small but still a thing you can read. The last quarter of the range is
 * spent fading, rather than a bubble blinking out of existence on a
 * threshold — which is what Roblox does and why nobody notices the
 * threshold.
 *
 * **`PLAIN_WITHIN` is `ZOOM_FAR` and must stay that way.** It was 14 while
 * the camera starts at 34, so `14/34 = 0.41` was already under the floor:
 * every bubble anybody saw was at `SMALLEST`, and Staw's "TOO SMALL TOO
 * SMALL" was the scaling working perfectly over a band nobody plays in.
 * Written as the constant rather than as the number so the two cannot drift
 * apart again — the default camera is the reference, not a figure somebody
 * picked.
 *
 * So: full size anywhere between first person and the default zoom, which
 * is where almost all play happens, and pulling the camera back is the only
 * thing that shrinks a bubble. That is the better story anyway — asking to
 * see more World is asking to see less of its furniture.
 *
 * `SMALLEST` is 0.55 rather than 0.42 because the floor is now reached only
 * by somebody who deliberately zoomed out, and at 0.42 a bubble is 15px
 * tall, which is not reading a message. It is noticing that somebody spoke.
 *
 * The font is deliberately not touched. `600 1rem/1.35 Inter` is the one
 * number the Workspace and the Launcher both read as "the size of chat",
 * and a bubble that is bigger because its type is bigger has stopped being
 * the same drawing.
 */
const PLAIN_WITHIN = ZOOM_FAR
const SMALLEST = 0.55
const FADES_FROM = HEARD_WITHIN * 0.75

/**
 * How a bubble looks, in one place and overridable.
 *
 * Every property here is set with `Object.assign(element.style, ...)`, and
 * inline beats a class — which is why restyling this from outside with CSS
 * does not work, and why the knobs are handed over instead. The Launcher
 * asked twice; this is the answer. Pass what you want changed, keep the
 * rest.
 */
export type BubbleLook = {
  background: string
  color: string
  /** The hairline. White over a snow level is invisible without one. */
  edge: string
  shadow: string
  radius: string
  font: string
  padding: string
  maxWidth: string
  /**
   * The tail, in pixels, and how far across the bubble it sits.
   *
   * Three numbers rather than one, because one made the half-base and the
   * depth the same — so a border triangle was always as deep as it was
   * wide, and could not round its point. The mark's nub is wide, shallow
   * and round, and at a bubble's width the triangle read as a pin stuck in
   * the bottom edge. Drawn as a path now, so it can be all three.
   *
   * `wide: 0` turns it off.
   */
  tail: { wide: number; deep: number; round: number }
  tailAt: string
}

/**
 * Staw's chat mark, as a bubble.
 *
 * White, text `#101012`, a rounded square that is not too rounded, and a
 * tail below and slightly left of centre. The dark version never needed an
 * edge; this one does, because a white bubble over a bright World has
 * nothing to end it against.
 */
/**
 * Measured off the mark rather than guessed at, which is what the last
 * version was.
 *
 * `ChatMark` is drawn in a 24 box: a body 20 wide by 13.85 tall, a corner
 * of 2.1, and a tail 8 wide and 3.26 deep centred on the body with a 1.06
 * arc rounding its point. So:
 *
 *   - the corner is 15.2% of the body's *height*. `0.55rem` on a bubble
 *     34px tall was nearer 26%, which is a pill where the mark is a
 *     rounded square, and that was most of "ugly".
 *   - the tail is centred. It was at 42%, and nobody could tell that was
 *     deliberate, which is the honest test for an off-centre detail.
 *   - the type is Inter, not `system-ui`. Every other word in this product
 *     is Inter and the operating system's font was the odd one out.
 *
 * The corner is in `em` so it stays 15.2% of the line box whatever size the
 * bubble is set to, rather than being right at one size.
 */
export const BUBBLE_LOOK: BubbleLook = {
  background: '#ffffff',
  color: '#101012',
  edge: '1px solid rgba(16, 16, 18, 0.12)',
  shadow: '0 10px 24px -14px rgba(0, 0, 0, 0.55)',
  radius: '0.32em',
  font: '600 1rem/1.35 Inter, system-ui, sans-serif',
  padding: '0.45rem 0.75rem',
  maxWidth: '22rem',
  /*
   * The mark's own share, not three quarters of it.
   *
   * The apps measured the first version at 0.73 of the nub's real size and
   * asked which I wanted. The mark is what Staw asked the bubble to look
   * like, and he had already seen and accepted the full-size nub, so it is
   * the full-size nub: 57.8% of the body's height rather than 42%.
   */
  tail: { wide: 22, deep: 9, round: 2.9 },
  tailAt: '50%',
}

/**
 * What goes inside a bubble.
 *
 * Nodes rather than a string, so a window that draws emoji as pictures can
 * hand over text nodes and `<img>` elements. Nothing here ever touches
 * `innerHTML`, and this hook does not change that: whatever it returns is
 * appended, so a renderer that builds markup out of a message has to have
 * built the nodes itself.
 */
export type BubbleContents = (line: ChatLine) => Node[]

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

  private look: BubbleLook
  private contents: BubbleContents | null
  /*
   * How high each subject reaches, and when that was last worked out.
   *
   * Measured rather than assumed, and measured again on a timer rather
   * than once: a hat put on halfway through a session changes the answer,
   * and a value read once and kept is the mistake this project makes most.
   * Cheap at a couple of times a second for the handful of people in
   * earshot.
   */
  private tops = new Map<THREE.Object3D, { y: number; at: number }>()
  private box = new THREE.Box3()

  /**
   * The layer sits over the canvas and never takes a click: a bubble is
   * something you read, not something you press, and one landing over a
   * door you were about to open must not stop you opening it.
   */
  constructor(private canvas: HTMLCanvasElement, options: {
    look?: Partial<BubbleLook>
    contents?: BubbleContents
  } = {}) {
    this.look = { ...BUBBLE_LOOK, ...options.look }
    this.contents = options.contents ?? null

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

  /**
   * How far up the world somebody reaches, hat and all.
   *
   * Falls back to a bare head's height if the object has nothing to
   * measure — an empty peg, or a body whose meshes have not landed yet.
   */
  private topOf(who: THREE.Object3D, now: number): number {
    const known = this.tops.get(who)
    if (known && now - known.at < RE_MEASURE) return known.y

    this.box.setFromObject(who)
    const floor = who.getWorldPosition(new THREE.Vector3()).y
    const y = Number.isFinite(this.box.max.y) && this.box.max.y > floor
      ? this.box.max.y
      : floor + K6_HEIGHT
    this.tops.set(who, { y, at: now })
    return y
  }

  /** Put one over somebody. `who` is whatever object follows their head. */
  add(who: THREE.Object3D, line: ChatLine) {
    const look = this.look
    const element = document.createElement('div')
    element.className = 'kob-bubble'
    // textContent, never innerHTML: a message is text, and a message that
    // could become markup is the whole of this class of bug. A renderer
    // handing over nodes is the same promise kept differently.
    if (this.contents) element.append(...this.contents(line))
    else element.textContent = line.text
    Object.assign(element.style, {
      position: 'absolute',
      // Measured from the layer's own corner, since the position lives in
      // the transform now.
      left: '0',
      top: '0',
      transform: 'translate(-50%, -100%)',
      maxWidth: look.maxWidth,
      padding: look.padding,
      borderRadius: look.radius,
      background: look.background,
      border: look.edge,
      color: look.color,
      font: look.font,
      textAlign: 'center',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      boxShadow: look.shadow,
      /*
       * Opacity only. The transform is written every frame now, and a
       * transition on a property set every frame is sliding by
       * construction: each move would be animated over 180ms and the
       * bubble would always trail the head it belongs to.
       */
      transition: 'opacity 180ms ease',
      opacity: '0',
    })

    /*
     * The tail, as a drawn path rather than a border triangle.
     *
     * A border triangle's half-base and depth are the same number, so it
     * cannot be wide and shallow, and it cannot round its point. The
     * mark's nub is both. An `<svg>` under the bubble can be all three,
     * and it is its own element rather than a pseudo-element because
     * there is no stylesheet here to put one in.
     */
    if (look.tail.wide > 0) {
      const { wide, deep, round } = look.tail
      const tail = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      tail.setAttribute('width', String(wide))
      tail.setAttribute('height', String(deep))
      tail.setAttribute('viewBox', `0 0 ${wide} ${deep}`)
      tail.dataset.tail = 'yes'
      Object.assign(tail.style, {
        position: 'absolute',
        left: look.tailAt,
        top: '100%',
        // Up by a pixel, so the hairline along the bubble's bottom edge
        // does not show through where the two meet.
        marginTop: '-1px',
        transform: 'translateX(-50%)',
        display: 'block',
        filter: 'drop-shadow(0 1px 0 rgba(16, 16, 18, 0.10))',
      })

      const nub = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      nub.setAttribute('fill', look.background)
      nub.setAttribute('d', [
        `M 0 0`,
        `L ${wide} 0`,
        `L ${wide / 2 + round} ${deep - round * 0.75}`,
        `Q ${wide / 2} ${deep} ${wide / 2 - round} ${deep - round * 0.75}`,
        'Z',
      ].join(' '))
      tail.appendChild(nub)
      element.appendChild(tail)
    }

    this.layer.appendChild(element)
    // Next frame, so the transition has something to move from.
    requestAnimationFrame(() => { element.style.opacity = '1' })

    const stack = this.over.get(who) ?? []
    stack.push({
      line,
      element,
      until: Date.now() + Math.min(Math.max(LEAST, line.text.length * PER_CHARACTER), MOST),
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
        this.tops.delete(who)
        continue
      }

      who.getWorldPosition(this.middle)
      const away = this.middle.distanceTo(this.toward)
      // Above whatever is on top of them, not above where a bare head
      // would have been.
      this.middle.y = this.topOf(who, now) + ABOVE

      const at = this.middle.clone().project(camera)
      // Behind the camera, too far to matter, or hidden because it is you.
      const shown = at.z < 1 && away < HEARD_WITHIN && who !== hide

      // Smaller the further off, and thinner over the last stretch.
      const near = Math.max(SMALLEST, Math.min(1, PLAIN_WITHIN / Math.max(away, 0.001)))
      const heard = away > FADES_FROM
        ? Math.max(0, 1 - (away - FADES_FROM) / (HEARD_WITHIN - FADES_FROM))
        : 1

      let lift = 0
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        const bubble = stack[i]
        const style = bubble.element.style
        if (!shown) { style.opacity = '0'; continue }

        // Older ones sit higher, smaller and fainter, so the newest reads
        // first without anything jumping when one goes.
        const age = stack.length - 1 - i
        // The two multiply, so an old bubble on somebody far away is
        // smaller than a new one on somebody standing next to you — which
        // it was not, and nobody had noticed yet.
        const size = (1 - age * 0.12) * near
        const fading = Math.max(0, Math.min(1, (bubble.until - now) / 600))

        /*
         * Everything in the transform, nothing in `left` and `top`.
         *
         * Those two make the browser lay out and paint every bubble every
         * frame, on the main thread, beside a canvas the GPU is
         * compositing — which is the usual reason a DOM overlay swims
         * against the scene it is meant to be stuck to. The same numbers
         * in a `translate3d` cost no layout at all.
         */
        const x = (at.x * 0.5 + 0.5) * width
        const y = (-at.y * 0.5 + 0.5) * height - lift
        style.transform =
          `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
          + ` translate(-50%, -100%) scale(${size.toFixed(3)})`
        style.opacity = `${(fading * heard * (1 - age * 0.25)).toFixed(3)}`

        /*
         * Only the newest keeps its tail. Three arrows pointing at one
         * head point at nothing, and a stack reads as a stack when the
         * ones above are plain.
         */
        const tail = bubble.element.querySelector('[data-tail]') as SVGElement | null
        if (tail) tail.style.display = age === 0 ? 'block' : 'none'

        lift += bubble.element.offsetHeight * size + 6
      }
    }
  }

  /** Everything over one person, gone. They left, or the World closed. */
  forget(who: THREE.Object3D) {
    for (const bubble of this.over.get(who) ?? []) this.drop(bubble)
    this.over.delete(who)
    this.tops.delete(who)
  }

  clear() {
    for (const stack of this.over.values()) for (const bubble of stack) this.drop(bubble)
    this.over.clear()
    this.tops.clear()
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
