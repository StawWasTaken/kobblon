import type { Intent } from './input'

/**
 * Talking, in a World.
 *
 * Roblox's system rather than Roblox's look: a line of text goes up over the
 * speaker's head for a few seconds and into a window that fades when nobody
 * is talking. Everything below is about the rules around that — who may say
 * what, how often, and what happens to text nobody wrote by hand.
 *
 * **Where the honesty is.** Kobblon has no server, so there is nowhere for a
 * message to go. This service is the whole of chat except the part that
 * carries a message between two people, and that part is an interface with a
 * local implementation: what you say, you hear. It is not pretending to be
 * multiplayer and the window says as much the first time it opens. When
 * there is a server, a transport is written against `ChatTransport` and
 * nothing else here changes.
 */

export type ChatKind =
  /** Somebody talking. */
  | 'said'
  /** The World or the client talking: joins, leaves, refusals. */
  | 'system'
  /** Told to you alone. */
  | 'whisper'

export type ChatLine = {
  id: string
  /** Who said it. A display name, never a user id. */
  from: string
  /** What they said, as text. Never markup; see `clean`. */
  text: string
  kind: ChatKind
  /** When it was said, by this machine's clock. */
  at: number
  /** The name of whoever it was meant for, on a whisper. */
  to?: string
}

/**
 * How a message gets from one person to another.
 *
 * The one thing chat needs that Kobblon does not have yet. A Launcher with a
 * server behind it implements this; until then `LocalEcho` stands in, and it
 * does not lie about what it is.
 */
export type ChatTransport = {
  /** Send what this player typed. */
  send(text: string): void | Promise<void>
  /** Hear everything, including your own words coming back. */
  listen(heard: (line: ChatLine) => void): () => void
  /** What the transport would like the window to say about itself, if anything. */
  note?: string
}

/** The longest a message may be. Roblox's number, and it is a good one. */
export const MOST_CHARACTERS = 200

/** How many lines are kept. Past this the oldest go. */
const KEPT = 200

/*
 * Flood protection.
 *
 * A burst of three is deliberate: somebody answering a question quickly is
 * not a flood, and a limit that punishes fast typists is a limit people
 * route around. After the burst it is one message every three quarters of a
 * second.
 *
 * This is the client being polite to itself. It is **not** a defence: a
 * client is somebody else's computer and this one can be edited. When there
 * is a server, the server enforces this, and it enforces it again rather
 * than trusting that this ran.
 */
const BURST = 3
const EVERY = 750

/**
 * Text, made safe to put in a page.
 *
 * Not by escaping it — by never treating it as markup in the first place.
 * Every message is written into the document with `textContent`, so a
 * message reading `<script>` is five words nobody has to think about. This
 * only removes what would break the *layout*: control characters, the
 * zero-width tricks used to hide text inside other text, and runs of
 * whitespace long enough to push a window off screen.
 *
 * Length is counted in code points rather than UTF-16 units, so an emoji is
 * one character and a limit of two hundred means two hundred of what a
 * person can see.
 */
export function clean(raw: string): string {
  const out: string[] = []
  for (const one of raw) {
    const code = one.codePointAt(0) ?? 0
    // Written as numbers rather than as a regular expression of escapes,
    // because these are exactly the characters that do not survive being
    // copied between files by hand.
    const control = code < 0x20 || (code >= 0x7f && code <= 0x9f)
    const invisible = (code >= 0x200b && code <= 0x200f)   // zero width, and the two direction marks
      || code === 0x2028 || code === 0x2029                // line and paragraph separators
      || code === 0xfeff                                   // byte order mark
      || (code >= 0x202a && code <= 0x202e)                // the overrides text is hidden with
      || (code >= 0x2066 && code <= 0x2069)                // and the isolates
    if (control || invisible) continue
    out.push(one)
  }

  const flat = out.join('').replace(/\s+/g, ' ').trim()
  return [...flat].slice(0, MOST_CHARACTERS).join('')
}

/** Hearing yourself, because there is nobody else to hear you yet. */
export class LocalEcho implements ChatTransport {
  private heard = new Set<(line: ChatLine) => void>()

  readonly note = 'There is no server yet, so this is you talking to yourself.'

  constructor(private who: string) {}

  send(text: string) {
    const line: ChatLine = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: this.who,
      text,
      kind: 'said',
      at: Date.now(),
    }
    for (const one of this.heard) one(line)
  }

  listen(heard: (line: ChatLine) => void) {
    this.heard.add(heard)
    return () => { this.heard.delete(heard) }
  }
}

export type ChatEvents = {
  /** A line arrived, from anyone, including this player. */
  line: ChatLine
  /** This client refused to send something, and why. */
  refused: { why: string }
  /** The window opened or closed. Movement is muted while it is open. */
  typing: { typing: boolean }
}

export class ChatService {
  readonly lines: ChatLine[] = []
  private listeners = new Map<keyof ChatEvents, Set<(data: never) => void>>()
  private stopListening: (() => void) | null = null
  private sentAt: number[] = []
  private open = false

  constructor(private transport: ChatTransport) {
    this.stopListening = transport.listen((line) => this.take(line))
  }

  /** Swap the transport, for when a World is joined and a server exists. */
  use(transport: ChatTransport) {
    this.stopListening?.()
    this.transport = transport
    this.stopListening = transport.listen((line) => this.take(line))
  }

  get note() {
    return this.transport.note
  }

  /** Whether the player is typing, which is when movement keys are theirs. */
  get typing() {
    return this.open
  }

  /**
   * Say whether the player is typing. **Not optional.**
   *
   * The engine mutes the movement intent while this is true, so a window
   * that forgets to say it leaves every keystroke going to the World: "wasd"
   * walks you off a roof, and the person it happens to does not report it as
   * a chat bug, they report that the engine stopped responding. Anything
   * drawing its own chat window calls this around its input's focus.
   */
  setTyping(typing: boolean) {
    if (this.open === typing) return
    this.open = typing
    this.say('typing', { typing })
  }

  /**
   * Send what this player typed.
   *
   * Returns why it was refused, or null if it went. Refusals are said out
   * loud rather than swallowed: a message that vanishes with no explanation
   * is the thing that makes somebody type it again, louder.
   */
  send(raw: string): string | null {
    const text = clean(raw)
    if (!text) return 'Nothing to say.'

    const now = Date.now()
    this.sentAt = this.sentAt.filter((one) => now - one < EVERY * BURST)
    if (this.sentAt.length >= BURST) {
      const why = 'Slow down a moment.'
      this.say('refused', { why })
      this.tell(why)
      return why
    }
    this.sentAt.push(now)

    void this.transport.send(text)
    return null
  }

  /** A line from the World or the client itself, shown only to this player. */
  tell(text: string) {
    this.take({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: 'Kobblon',
      text: clean(text),
      kind: 'system',
      at: Date.now(),
    })
  }

  private take(line: ChatLine) {
    // Everything arriving is somebody else's writing, including a server's.
    const safe: ChatLine = { ...line, text: clean(line.text), from: clean(line.from).slice(0, 40) }
    if (!safe.text) return
    this.lines.push(safe)
    if (this.lines.length > KEPT) this.lines.splice(0, this.lines.length - KEPT)
    this.say('line', safe)
  }

  on<K extends keyof ChatEvents>(event: K, listener: (data: ChatEvents[K]) => void) {
    const set = this.listeners.get(event) ?? new Set()
    set.add(listener as (data: never) => void)
    this.listeners.set(event, set)
    return () => { set.delete(listener as (data: never) => void) }
  }

  private say<K extends keyof ChatEvents>(event: K, data: ChatEvents[K]) {
    for (const listener of this.listeners.get(event) ?? []) {
      (listener as (d: ChatEvents[K]) => void)(data)
    }
  }

  dispose() {
    this.stopListening?.()
    this.listeners.clear()
  }
}

/**
 * While somebody is typing, the keyboard is theirs and not the World's.
 *
 * Without this, saying "wasd" walks you off a roof. It is applied to the
 * intent rather than by unbinding keys, so that a key held down when the
 * window opened does not stay held for ever.
 */
export function muted(intent: Intent): Intent {
  return { ...intent, x: 0, z: 0, jump: false, run: false, emote: false }
}
