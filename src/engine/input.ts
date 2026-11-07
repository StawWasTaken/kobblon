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
  /**
   * Shift was pressed this frame, asking for shiftlock on or off.
   *
   * An edge rather than a held state: shiftlock is a mode you turn on and
   * leave on, the way classic Roblox does it, so what the engine needs to
   * know is that the key went down - not that it is still down.
   */
  lock: boolean
}

export const stillIntent = (): Intent => ({
  x: 0, z: 0, jump: false, run: false, turn: 0, pitch: 0, emote: false, lock: false,
})

const KEYS: Record<string, keyof Intent | 'left' | 'right' | 'forward' | 'back'> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
}

/*
 * No emote key, deliberately.
 *
 * `KeyE: 'emote'` was here and was never asked for. Staw asked for the chat
 * command - "/e wave" and "/emote wave" - and `/e` being the short form of a
 * typed word turned into a physical button, which is the only thing that
 * connected them. `Engine.emote(name)` is the path that was wanted and it
 * still works; `Intent.emote` stays, because a gamepad or another player's
 * packets want a way to say "this body is emoting" that is not a chat line.
 *
 * E is also spoken for: it is the default key of the ProximityPrompt that is
 * coming, which every person who has touched Roblox already has in their
 * hands. So this is not a key to reassign to another letter - and the prompt
 * cannot take an entry in this table either, because its key is set per
 * prompt by whoever built the World. What is pressed has to be matched
 * against whatever the nearest prompt asks for, which is a different
 * mechanism from this one.
 */

/** Reads a keyboard and a dragged mouse into an intent, once per frame. */
export class Keyboard {
  private down = new Set<string>()
  private dragX = 0
  private dragY = 0
  private dragging = false
  private locked = false
  /**
   * Whether the pointer currently held is held *for this drag*.
   *
   * The thing the release has to know. First person and shiftlock hold the
   * pointer, and a drag that let go on the way out would drop theirs -
   * which is round 270's zoom bug exactly: two owners, one of them
   * clearing the other's lock. So a release only gives back what it took.
   *
   * Nothing sets this now that a drag does not lock, which is the point:
   * the release cannot reach `exitPointerLock` at all, so first person and
   * shiftlock keep their lock through any number of right drags.
   */
  private lockIsOurs = false
  /** Asked at the end of a drag: does anything else want the pointer? */
  private keeper: (() => boolean) | null = null
  private typingNow = false
  /** Set when Shift goes down, taken by the next `read`. */
  private lockAsked = false
  private stop: (() => void)[] = []

  constructor(private element: HTMLElement) {
    const keyDown = (e: KeyboardEvent) => {
      /*
       * While somebody is typing, the keyboard is not ours - and muting the
       * intent was never enough to say that. This listener called
       * `preventDefault` on every key it knew before anything read the
       * intent, so with a cursor in a chat box the space bar typed no
       * space, the arrows would not move the caret, and W, A, S and D could
       * not be written: the four letters hardest to do without. The
       * Launcher worked around it by taking the keyboard at the box, which
       * is stronger but means the engine's own `setTyping` was the
       * documented path to a thing it did not actually do. It does now.
       */
      if (this.typingNow) return
      // Not on auto-repeat: holding Shift must not flicker the mode.
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) this.lockAsked = true
      if (KEYS[e.code]) { this.down.add(e.code); e.preventDefault() }
    }
    const keyUp = (e: KeyboardEvent) => this.down.delete(e.code)
    const blur = () => this.down.clear()

    /*
     * The right button turns the camera, and only the right button. Left is
     * for pointing at things in a World, and a left drag that swung the view
     * about would make clicking on anything a gamble.
     */
    const pointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return
      this.dragging = true
      /*
       * Capture, and only capture. It keeps the *events* coming here, which
       * is why a drag does not break when the mouse leaves the canvas.
       *
       * A drag deliberately does not take the pointer lock, which it did
       * briefly in round 283. A lock hides the real cursor, and nothing can
       * hold a visible one still, so holding the arrow still means drawing a
       * copy of it - and a copy of the system arrow is always slightly the
       * wrong arrow. Staw looked at it and kept the real cursor. The frozen
       * cursor on Roblox is a frozen *system* cursor: a native application
       * can do that and a page cannot.
       */
      element.setPointerCapture(e.pointerId)
      e.preventDefault()
    }

    // Otherwise the menu opens on top of the World every time somebody looks
    // to the right.
    const contextMenu = (e: Event) => e.preventDefault()
    const pointerUp = (e: PointerEvent) => {
      /*
       * The right button coming up, or the last button of any kind.
       * This listens on the window and so hears every release there is -
       * and letting go of a left click in the middle of a right drag
       * would otherwise end the turn and hand back a pointer the drag is
       * still using.
       */
      if (e.button !== 2 && e.buttons !== 0) return
      this.dragging = false
      if (!this.lockIsOurs) return
      this.lockIsOurs = false
      // Unless first person or shiftlock wants it kept.
      if (!this.keeper?.()) document.exitPointerLock?.()
    }
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
    element.addEventListener('contextmenu', contextMenu)
    window.addEventListener('pointerup', pointerUp)
    window.addEventListener('pointermove', pointerMove)
    document.addEventListener('pointerlockchange', lockChanged)

    this.stop = [
      () => window.removeEventListener('keydown', keyDown),
      () => window.removeEventListener('keyup', keyUp),
      () => window.removeEventListener('blur', blur),
      () => element.removeEventListener('pointerdown', pointerDown),
      () => element.removeEventListener('contextmenu', contextMenu),
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
       * Negated, because `orbit.yaw += intent.turn` and a bigger yaw swings
       * the camera left. Dragging right has to turn the camera right; it
       * did the opposite for as long as there has been a camera.
       */
      turn: -this.dragX * 0.005,
      /*
       * Dragging down looks down. Both axes were the wrong way round, and
       * they are fixed one at a time because each was reported separately.
       */
      pitch: this.dragY * 0.005,
      lock: this.lockAsked,
    }
    this.lockAsked = false
    this.dragX = 0
    this.dragY = 0
    return intent
  }

  /**
   * Say whether somebody is typing, and the keyboard stops being read.
   *
   * Nothing is prevented, nothing is added to what is held, and anything
   * already held is released by its own keyup, which still arrives. The
   * engine calls this from `ChatService`'s typing event, so a window that
   * does the one documented thing - `chat.setTyping(true)` - gets this for
   * free. A window drawing its own chat against a bare `Keyboard` calls it
   * itself.
   */
  setTyping(typing: boolean) {
    this.typingNow = typing
  }

  /** Whether the keyboard is somebody's text rather than the World's. */
  get typing() {
    return this.typingNow
  }

  /** Whether the mouse is being held in the middle of the window. */
  get pointerLocked() {
    return this.locked
  }

  /**
   * Who to ask, at the end of a right drag, whether the pointer stays.
   *
   * The engine knows and this does not: `firstPerson || shiftlockOn`.
   * Left unset, a drag gives the pointer back every time, which is the
   * right answer for anything mounting the input on its own.
   */
  setPointerKeeper(asking: (() => boolean) | null) {
    this.keeper = asking
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
