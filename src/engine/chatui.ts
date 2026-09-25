import { ChatService, MOST_CHARACTERS, type ChatLine } from './chat'

/**
 * The chat window.
 *
 * Roblox's system, Kobblon's design. What is copied is the behaviour nobody
 * notices until it is missing: the window is quiet until somebody talks,
 * fades out when they stop, comes back the moment a line arrives, and opens
 * for typing on a keystroke rather than a click so your hands never leave
 * the keyboard. What is not copied is the look.
 *
 * Plain DOM, because the engine has no framework and should not gain one to
 * draw eleven elements. The Launcher can hide this and draw its own against
 * `ChatService` if it would rather.
 */

/** How long the window stays up after the last thing anybody said. */
const QUIET_AFTER = 30000

const CSS = `
.kob-chat {
  position: absolute; left: 1rem; top: 1rem; width: min(26rem, 42vw);
  display: flex; flex-direction: column; gap: 0.4rem;
  font: 500 0.85rem/1.45 system-ui, sans-serif; z-index: 6;
  transition: opacity 400ms ease;
}
.kob-chat[data-quiet="true"] { opacity: 0.25; }
.kob-chat[data-typing="true"] { opacity: 1; }
.kob-chat-lines {
  display: flex; flex-direction: column; gap: 0.15rem;
  max-height: 32vh; overflow-y: auto; overscroll-behavior: contain;
  padding: 0.5rem 0.6rem; border-radius: 0.7rem;
  background: rgba(17, 20, 28, 0.72); color: #eef1f7;
  scrollbar-width: thin;
}
.kob-chat-line { overflow-wrap: anywhere; }
.kob-chat-who { color: #6c8cff; font-weight: 700; }
.kob-chat-line[data-kind="system"] { color: #8f98ab; font-style: italic; }
.kob-chat-line[data-kind="whisper"] .kob-chat-who { color: #25D68C; }
.kob-chat-box {
  display: none; align-items: center; gap: 0.5rem;
  padding: 0.35rem 0.5rem; border-radius: 0.7rem;
  background: rgba(17, 20, 28, 0.92);
}
.kob-chat[data-typing="true"] .kob-chat-box { display: flex; }
.kob-chat-input {
  flex: 1; background: none; border: 0; color: #f4f6fb; font: inherit; outline: none;
}
.kob-chat-left { color: #8f98ab; font-variant-numeric: tabular-nums; font-size: 0.75rem; }
.kob-chat-left[data-low="true"] { color: #ffb020; }
`

export class ChatWindow {
  private root: HTMLElement
  private list: HTMLElement
  private input: HTMLInputElement
  private left: HTMLElement
  private quietAt = 0
  private stop: (() => void)[] = []

  constructor(private chat: ChatService, canvas: HTMLCanvasElement) {
    const holder = canvas.parentElement ?? document.body
    if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative'

    if (!document.getElementById('kob-chat-css')) {
      const style = document.createElement('style')
      style.id = 'kob-chat-css'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    this.root = document.createElement('div')
    this.root.className = 'kob-chat'
    this.root.dataset.typing = 'false'

    this.list = document.createElement('div')
    this.list.className = 'kob-chat-lines'
    this.list.setAttribute('role', 'log')
    this.list.setAttribute('aria-live', 'polite')

    const box = document.createElement('div')
    box.className = 'kob-chat-box'

    this.input = document.createElement('input')
    this.input.className = 'kob-chat-input'
    this.input.maxLength = MOST_CHARACTERS * 2 // trimmed properly on send
    this.input.placeholder = 'Say something'
    this.input.setAttribute('aria-label', 'Say something')

    this.left = document.createElement('div')
    this.left.className = 'kob-chat-left'

    box.append(this.input, this.left)
    this.root.append(this.list, box)
    holder.appendChild(this.root)

    for (const line of chat.lines) this.draw(line)
    if (chat.note) chat.tell(chat.note)

    this.stop.push(chat.on('line', (line) => {
      this.draw(line)
      this.quietAt = Date.now() + QUIET_AFTER
    }))

    /*
     * A keystroke opens it, the way it does in every game that does this
     * well. Slash opens it with the slash already typed, because that is
     * how somebody starts a command.
     */
    const onKey = (e: KeyboardEvent) => {
      if (this.chat.typing) {
        if (e.key === 'Escape') { this.close(); e.preventDefault() }
        return
      }
      if (e.key === '/' || e.key === 'Enter') {
        this.open(e.key === '/' ? '/' : '')
        e.preventDefault()
      }
    }

    const onSubmit = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const typed = this.input.value
      this.input.value = ''
      this.count()
      if (typed.trim()) this.run(typed)
      this.close()
    }

    const onType = () => this.count()

    window.addEventListener('keydown', onKey)
    this.input.addEventListener('keydown', onSubmit)
    this.input.addEventListener('input', onType)
    this.stop.push(
      () => window.removeEventListener('keydown', onKey),
      () => this.input.removeEventListener('keydown', onSubmit),
      () => this.input.removeEventListener('input', onType),
    )

    this.count()
    this.quietAt = Date.now() + QUIET_AFTER
  }

  /** Commands. Only the ones that do something. */
  private run(typed: string) {
    if (!typed.startsWith('/')) {
      this.chat.send(typed)
      return
    }

    const [word] = typed.slice(1).split(' ')

    if (word === 'help') {
      this.chat.tell('/help shows this. /clear empties the window. Anything else is said out loud.')
      return
    }
    if (word === 'clear') {
      this.list.replaceChildren()
      return
    }
    /*
     * No /w yet. A whisper needs somebody to whisper to, and there is no
     * server, so it would be a command that looks like it works and does
     * nothing — which is worse than not having it.
     */
    this.chat.tell(`There is no /${word.slice(0, 20)}. Try /help.`)
  }

  open(withText = '') {
    this.chat.setTyping(true)
    this.root.dataset.typing = 'true'
    this.input.value = withText
    this.count()
    this.input.focus()
  }

  close() {
    this.chat.setTyping(false)
    this.root.dataset.typing = 'false'
    this.input.blur()
  }

  /** Called once a frame by the engine, to fade when nobody is talking. */
  update() {
    const quiet = !this.chat.typing && Date.now() > this.quietAt
    this.root.dataset.quiet = String(quiet)
  }

  private count() {
    const used = [...this.input.value].length
    const left = MOST_CHARACTERS - used
    this.left.textContent = left <= 40 ? String(left) : ''
    this.left.dataset.low = String(left <= 0)
  }

  private draw(line: ChatLine) {
    const row = document.createElement('div')
    row.className = 'kob-chat-line'
    row.dataset.kind = line.kind

    if (line.kind !== 'system') {
      const who = document.createElement('span')
      who.className = 'kob-chat-who'
      // textContent throughout: a name is text too, and a name is the field
      // somebody would try this on.
      who.textContent = `${line.from}: `
      row.appendChild(who)
    }

    row.appendChild(document.createTextNode(line.text))
    this.list.appendChild(row)

    // Only follow the bottom if they were already at the bottom: yanking
    // somebody away from what they were reading is how a chat window
    // becomes something people close.
    const atBottom = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 40
    if (atBottom) this.list.scrollTop = this.list.scrollHeight

    while (this.list.childElementCount > 200) this.list.firstElementChild?.remove()
  }

  dispose() {
    this.stop.forEach((off) => off())
    this.root.remove()
  }
}
