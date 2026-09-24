/**
 * What the player is asking for, and nothing about what it means.
 *
 * The controller reads this; it never reads the keyboard. That is what lets
 * the same controller be driven by a test, by a gamepad later, or by another
 * player's packets over the network.
 */
export type Intent = {
  /** -1 to 1 across and along the camera's idea of forward. */
  x: number
  z: number
  jump: boolean
  run: boolean
  /** How far the camera has been dragged this frame, in radians. */
  turn: number
  pitch: number
  emote: boolean
}

export const stillIntent = (): Intent => ({
  x: 0, z: 0, jump: false, run: false, turn: 0, pitch: 0, emote: false,
})

const KEYS: Record<string, keyof Intent | 'left' | 'right' | 'forward' | 'back'> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  KeyE: 'emote',
}

/** Reads a keyboard and a dragged mouse into an intent, once per frame. */
export class Keyboard {
  private down = new Set<string>()
  private dragX = 0
  private dragY = 0
  private dragging = false
  private locked = false
  private stop: (() => void)[] = []

  constructor(private element: HTMLElement) {
    const keyDown = (e: KeyboardEvent) => {
      if (KEYS[e.code]) { this.down.add(e.code); e.preventDefault() }
    }
    const keyUp = (e: KeyboardEvent) => this.down.delete(e.code)
    const blur = () => this.down.clear()

    const pointerDown = (e: PointerEvent) => {
      this.dragging = true
      element.setPointerCapture(e.pointerId)
    }
    const pointerUp = () => { this.dragging = false }
    const pointerMove = (e: PointerEvent) => {
      /*
       * Locked, the mouse has no position: it only reports how far it
       * moved, and every bit of that is looking around. Unlocked, only a
       * drag counts, or the view would swing about whenever somebody
       * crossed the window on the way to something else.
       */
      if (!this.locked && !this.dragging) return
      this.dragX += e.movementX
      this.dragY += e.movementY
    }

    /*
     * First person: the pointer is taken and held in the middle, so the
     * mouse turns the head for ever instead of running out of screen. The
     * browser only grants this from something somebody did, which is why it
     * is asked for on a click rather than the moment the camera gets close.
     */
    const lockChanged = () => {
      this.locked = document.pointerLockElement === element
    }

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    element.addEventListener('pointerdown', pointerDown)
    window.addEventListener('pointerup', pointerUp)
    window.addEventListener('pointermove', pointerMove)
    document.addEventListener('pointerlockchange', lockChanged)

    this.stop = [
      () => window.removeEventListener('keydown', keyDown),
      () => window.removeEventListener('keyup', keyUp),
      () => window.removeEventListener('blur', blur),
      () => element.removeEventListener('pointerdown', pointerDown),
      () => window.removeEventListener('pointerup', pointerUp),
      () => window.removeEventListener('pointermove', pointerMove),
      () => document.removeEventListener('pointerlockchange', lockChanged),
    ]
  }

  read(): Intent {
    const held = (name: string) => [...this.down].some((code) => KEYS[code] === name)
    const intent: Intent = {
      x: (held('right') ? 1 : 0) - (held('left') ? 1 : 0),
      z: (held('forward') ? 1 : 0) - (held('back') ? 1 : 0),
      jump: held('jump'),
      // There is no sprint any more. The field stays so that a World or an
      // application built against the old shape does not fall over.
      run: false,
      emote: held('emote'),
      /*
       * Dragging right turns the camera right. It was the other way round,
       * which is the one thing about a camera nobody forgives.
       */
      turn: this.dragX * 0.005,
      pitch: -this.dragY * 0.005,
    }
    this.dragX = 0
    this.dragY = 0
    return intent
  }

  /** Whether the mouse is being held in the middle of the window. */
  get pointerLocked() {
    return this.locked
  }

  /**
   * Take the pointer, or give it back.
   *
   * A browser refuses this unless somebody has just done something, and
   * refusing is normal rather than an error: it happens when the window is
   * not focused, or twice in quick succession.
   */
  setPointerLock(on: boolean) {
    if (on && !this.locked) {
      this.element.requestPointerLock?.()
    } else if (!on && this.locked) {
      document.exitPointerLock?.()
    }
  }

  dispose() {
    this.stop.forEach((off) => off())
    this.element.blur?.()
  }
}
