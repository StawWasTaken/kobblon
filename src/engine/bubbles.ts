import * as THREE from 'three'
import type { ChatLine } from './chat'
import { K6_HEIGHT } from './units'
import { ZOOM_FAR } from './experience'

/**
 * The gap between the top of somebody and the bottom of their bubble.
 *
 * It was `K6_HEIGHT * 1.05` measured from the feet, which is the top of a
 * *bare* head - so anybody in a tall hat wore their own bubble. Staw, who
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
 * threshold - which is what Roblox does and why nobody notices the
 * threshold.
 *
 * **`PLAIN_WITHIN` is `ZOOM_FAR` and must stay that way.** It was 14 while
 * the camera starts at 34, so `14/34 = 0.41` was already under the floor:
 * every bubble anybody saw was at `SMALLEST`, and Staw's "TOO SMALL TOO
 * SMALL" was the scaling working perfectly over a band nobody plays in.
 * Written as the constant rather than as the number so the two cannot drift
 * apart again - the default camera is the reference, not a figure somebody
 * picked.
 *
 * So: full size anywhere between first person and the default zoom, which
 * is where almost all play happens, and pulling the camera back is the only
 * thing that shrinks a bubble. That is the better story anyway - asking to
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
 * inline beats a class - which is why restyling this from outside with CSS
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
   * depth the same - so a border triangle was always as deep as it was
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

/**
 * A mark over somebody's head: not something they said, something they are
 * doing.
 *
 * Staw, twice: "we still dont see the voicechat bubblechat ontop of your
 * head when making noise." The Launcher asked for this in rounds 51 and 53
 * and was right to ask here rather than build it: this board already owns
 * the projection. It holds the object, it walks it to screen space inside
 * `update`, it measures how high somebody reaches rather than assuming a
 * bare head, and it knows to draw nothing when the camera is inside the
 * head it is drawing over. A second projector beside this one would read
 * the same camera a frame late and disagree with it about hats.
 *
 * Three rules, which are the ones the Launcher set out:
 *
 * - **A mark sits above the stack, not inside it.** It is placed over
 *   whatever bubbles are there, and it does not expire with them.
 * - **It never pushes a bubble down.** Marks are positioned off the stack's
 *   height and add nothing to it, so switching a microphone on cannot move
 *   somebody's words.
 * - **It stays until it is taken off.** `unmark` is the only thing that
 *   ends one, because the thing it stands for - a live microphone - ends
 *   when the device does and not on a timer.
 *
 * The glyph is drawn here rather than handed in, for the same reason the
 * bubble is: a microphone over a head is part of how a person looks in a
 * World, so it is one drawing in one place. A window that needs a kind this
 * build cannot draw asks `MARK_KINDS` first - the same shape as the
 * Launcher's own `emotes` ask, and for the same reason. An unknown kind is
 * ignored rather than drawn blank.
 */
export type MarkLook = {
  /** The chip's side, in pixels. */
  size: number
  background: string
  color: string
  radius: string
  edge: string
  shadow: string
}

export const MARK_LOOK: MarkLook = {
  size: 26,
  background: '#ffffff',
  color: '#101012',
  radius: '0.32em',
  edge: '1px solid rgba(16, 16, 18, 0.12)',
  shadow: '0 10px 24px -14px rgba(0, 0, 0, 0.55)',
}

/** The gap over the top bubble, which is the gap between two bubbles. */
const MARK_GAP = 6

/** Filled glyphs, by kind. Font Awesome's solid microphone, as its path. */
const GLYPHS: Record<string, { box: string; path: string }> = {
  voice: {
    box: '0 0 384 512',
    path: 'M192 0C139 0 96 43 96 96l0 128c0 53 43 96 96 96s96-43 96-96l0-128c0-53-43-96-96-96zM48 184c0-13.3-10.7-24-24-24S0 170.7 0 184l0 40c0 97.9 73.3 178.7 168 190.5l0 49.5-48 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l144 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-48 0 0-49.5c94.7-11.8 168-92.6 168-190.5l0-40c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 40c0 79.5-64.5 144-144 144S48 303.5 48 224l0-40z',
  },
}

/** The kinds this build can draw, so a caller can refuse rather than guess. */
export const MARK_KINDS = Object.keys(GLYPHS)

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

  /** What is marked over each person, by kind. Nothing here expires. */
  private marked = new Map<THREE.Object3D, Map<string, HTMLElement>>()
  private markLook: MarkLook

  /**
   * The layer sits over the canvas and never takes a click: a bubble is
   * something you read, not something you press, and one landing over a
   * door you were about to open must not stop you opening it.
   */
  constructor(private canvas: HTMLCanvasElement, options: {
    look?: Partial<BubbleLook>
    contents?: BubbleContents
    mark?: Partial<MarkLook>
  } = {}) {
    this.look = { ...BUBBLE_LOOK, ...options.look }
    this.markLook = { ...MARK_LOOK, ...options.mark }
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
   * measure - an empty peg, or a body whose meshes have not landed yet.
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
   * Put a mark over somebody, and leave it there.
   *
   * `who` is the same object a bubble goes over. `kind` is one of
   * `MARK_KINDS`; anything else is ignored, because a chip with nothing in
   * it is worse than no chip. Marking the same kind twice does nothing, so
   * a caller may say it every frame if that is easier than tracking it.
   */
  mark(who: THREE.Object3D, kind: string) {
    const glyph = GLYPHS[kind]
    if (!glyph) return

    const already = this.marked.get(who)
    if (already?.has(kind)) return

    const look = this.markLook
    const element = document.createElement('div')
    element.className = `kob-mark kob-mark-${kind}`
    Object.assign(element.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${look.size}px`,
      height: `${look.size}px`,
      display: 'grid',
      placeItems: 'center',
      borderRadius: look.radius,
      background: look.background,
      border: look.edge,
      boxShadow: look.shadow,
      font: BUBBLE_LOOK.font,
      transform: 'translate(-50%, -100%)',
      transition: 'opacity 180ms ease',
      opacity: '0',
    })

    const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    drawing.setAttribute('viewBox', glyph.box)
    drawing.setAttribute('fill', look.color)
    drawing.setAttribute('aria-hidden', 'true')
    Object.assign(drawing.style, {
      width: `${Math.round(look.size * 0.52)}px`,
      height: `${Math.round(look.size * 0.52)}px`,
      display: 'block',
    })
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    line.setAttribute('d', glyph.path)
    drawing.appendChild(line)
    element.appendChild(drawing)

    this.layer.appendChild(element)
    requestAnimationFrame(() => { element.style.opacity = '1' })

    const marks = already ?? new Map<string, HTMLElement>()
    marks.set(kind, element)
    this.marked.set(who, marks)
  }

  /** Take one off. The only thing that ends a mark. */
  unmark(who: THREE.Object3D, kind: string) {
    const marks = this.marked.get(who)
    const element = marks?.get(kind)
    if (!marks || !element) return
    this.fadeOut(element)
    marks.delete(kind)
    if (!marks.size) this.marked.delete(who)
  }

  /** Which marks are on somebody right now. */
  marksOn(who: THREE.Object3D): string[] {
    return [...(this.marked.get(who)?.keys() ?? [])]
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

    /*
     * Both maps, because a mark does not come with a bubble. Somebody with
     * a live microphone and nothing said is not in `over` at all, and a
     * loop over bubbles alone is how a mark would be placed once and then
     * left behind by the head it belongs to.
     */
    const subjects = new Set<THREE.Object3D>([...this.over.keys(), ...this.marked.keys()])

    for (const who of subjects) {
      const stack = this.over.get(who) ?? []
      for (const bubble of [...stack]) {
        if (now > bubble.until) {
          this.drop(bubble)
          stack.splice(stack.indexOf(bubble), 1)
        }
      }
      if (!stack.length) {
        this.over.delete(who)
        // A mark holds the measurement open: it is still being drawn over
        // this head whether or not anything was said.
        if (!this.marked.has(who)) {
          this.tops.delete(who)
          continue
        }
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
        // smaller than a new one on somebody standing next to you - which
        // it was not, and nobody had noticed yet.
        const size = (1 - age * 0.12) * near
        const fading = Math.max(0, Math.min(1, (bubble.until - now) / 600))

        /*
         * Everything in the transform, nothing in `left` and `top`.
         *
         * Those two make the browser lay out and paint every bubble every
         * frame, on the main thread, beside a canvas the GPU is
         * compositing - which is the usual reason a DOM overlay swims
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

      /*
       * The marks, over the top of all of it.
       *
       * `lift` is read rather than added to, which is the rule: a mark is
       * placed above whatever height the stack reached and contributes
       * nothing to it, so switching a microphone on never moves anybody's
       * words. Several sit in a row rather than a column, because a column
       * of chips over a head is a tower and there are only ever a couple.
       */
      const marks = this.marked.get(who)
      if (marks?.size) {
        const x = (at.x * 0.5 + 0.5) * width
        const y = (-at.y * 0.5 + 0.5) * height - lift - (lift > 0 ? MARK_GAP : 0)
        const side = this.markLook.size + 4
        const spread = (marks.size - 1) * side * 0.5
        let i = 0
        for (const element of marks.values()) {
          const style = element.style
          if (!shown) { style.opacity = '0'; i += 1; continue }
          const across = (i * side - spread) * near
          style.transform =
            `translate3d(${(x + across).toFixed(1)}px, ${y.toFixed(1)}px, 0)`
            + ` translate(-50%, -100%) scale(${near.toFixed(3)})`
          style.opacity = heard.toFixed(3)
          i += 1
        }
      }
    }
  }

  /** Everything over one person, gone. They left, or the World closed. */
  forget(who: THREE.Object3D) {
    for (const bubble of this.over.get(who) ?? []) this.drop(bubble)
    this.over.delete(who)
    this.tops.delete(who)
    // Marks too. A mark never expires, so leaving somebody out of this is
    // a microphone drawn for ever over a head that has gone.
    for (const element of this.marked.get(who)?.values() ?? []) this.fadeOut(element)
    this.marked.delete(who)
  }

  clear() {
    for (const stack of this.over.values()) for (const bubble of stack) this.drop(bubble)
    this.over.clear()
    this.tops.clear()
    for (const marks of this.marked.values()) for (const element of marks.values()) this.fadeOut(element)
    this.marked.clear()
  }

  private drop(bubble: Bubble) {
    this.fadeOut(bubble.element)
  }

  private fadeOut(element: HTMLElement) {
    element.style.opacity = '0'
    // Let it fade rather than blink out. Removing the node is what matters;
    // when that happens is not.
    setTimeout(() => element.remove(), 200)
  }

  dispose() {
    this.clear()
    this.layer.remove()
  }
}
