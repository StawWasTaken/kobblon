import { useCallback, useEffect, useRef } from 'react'
import { markShapeOf, writingRunsOf } from '@/lib/rich'
import { mentionBits } from '@/lib/mentions'
import { cn } from '@/lib/cn'

/**
 * The box somebody writes in, with the weight showing as they type.
 *
 * Staw: "'*text*' will show the 'text' in italic, while keeping the '*' on
 * each side". A textarea cannot do that - text in one is one weight by
 * definition - so this is a `contenteditable` that draws the runs
 * `writingRunsOf` hands back: the words wearing their marks, the
 * delimiters kept and dimmed, and a mention of a real person as a pill.
 *
 * Three things are worth knowing before changing anything here, two of
 * them learned by the other session the hard way and passed over:
 *
 *   * **The writing is read recursively.** Everything the box draws is
 *     nested in spans, so anything reading the text back out has to walk
 *     into them. Reading only the top level reports a formatted message
 *     with its formatted words missing, which looks exactly like dropped
 *     keystrokes.
 *   * **It is rebuilt only when it has to be.** A rebuild mid-keystroke
 *     loses the keystroke, so the insides are redrawn on two things only:
 *     the weight changed shape, or the text arrived from outside (an
 *     emoji, a mark button, the box being cleared after a send). A letter
 *     typed inside something already italic changes neither.
 *   * **The caret is counted over the writing**, not over the DOM. Every
 *     offset here is an offset into the plain text, which is the same
 *     thing the parser counts in, so a mark button and the caret agree.
 */
export function WritingBox({
  id, value, onChange, onCaret, onSend, onKey, people, me, placeholder, want,
  max = 2000, className,
}: {
  id: string
  value: string
  onChange: (next: string) => void
  /** Where the caret or selection is, in offsets into the text. */
  onCaret?: (at: { from: number; to: number }) => void
  /**
   * Where the caret should be after a change that did not come from
   * typing - an emoji taken from the card, a mark put on, a name taken
   * from the list. Without it the box redraws and puts the caret back
   * where it last saw it, which is the middle of the word somebody has
   * just replaced: everything typed afterwards lands inside it.
   */
  want?: { from: number; to: number }
  onSend?: () => void
  /** First refusal on a key, for the suggestion lists. True means handled. */
  onKey?: (e: React.KeyboardEvent) => boolean
  /** Who can be mentioned here, lowercased usernames. */
  people?: Set<string>
  me?: string | null
  placeholder?: string
  max?: number
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const shape = useRef<string>('')
  const caret = useRef<{ from: number; to: number }>({ from: 0, to: 0 })

  /*
   * The whole writing, walking into every span the box drew.
   *
   * Two breaks are not writing and both have to be skipped, or the box
   * grows a line every time it is read: the one the browser leaves behind
   * in a box somebody has just emptied, and the filler one drawn after a
   * trailing newline so there is a line to put the caret on.
   */
  const read = useCallback((el: HTMLElement): string => {
    if (el.childNodes.length === 1 && el.firstChild?.nodeName === 'BR'
        && !(el.firstChild as HTMLElement).dataset?.filler) return ''

    let out = ''
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? ''
      else if (node.nodeName === 'BR') {
        if (!(node as HTMLElement).dataset?.filler) out += '\n'
      } else if (node.nodeType === Node.ELEMENT_NODE) out += read(node as HTMLElement)
    }
    return out
  }, [])

  /** The caret, as an offset into the writing. */
  const where = useCallback(() => {
    const el = box.current
    const picked = window.getSelection()
    if (!el || !picked || picked.rangeCount === 0) return null

    const upTo = (node: Node, offset: number) => {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
      let seen = 0
      let step: Node | null = walk.currentNode
      while (step) {
        if (step === node) {
          return step.nodeType === Node.TEXT_NODE ? seen + offset : seen
        }
        if (step.nodeType === Node.TEXT_NODE) seen += step.textContent?.length ?? 0
        else if (step.nodeName === 'BR') seen += 1
        step = walk.nextNode()
      }
      return seen
    }

    const range = picked.getRangeAt(0)
    if (!el.contains(range.startContainer)) return null
    const from = upTo(range.startContainer, range.startOffset)
    const to = range.collapsed ? from : upTo(range.endContainer, range.endOffset)
    return { from: Math.min(from, to), to: Math.max(from, to) }
  }, [])

  /**
   * Put the caret, or a whole selection, back at offsets into the writing.
   *
   * Both ends rather than only the start: a mark button acts on a
   * selection and then has to hand the same words back, or bold and then
   * italic are two marks on two different stretches of text.
   */
  const place = useCallback((from: number, to = from) => {
    const el = box.current
    if (!el) return

    /*
     * Breaks count as one character, the same as they do in `where`. A
     * walk over text nodes alone is out by one for every line above the
     * caret, which puts a second line's caret on the first line.
     */
    const spot = (at: number): [Node, number] => {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
      let seen = 0
      let last: [Node, number] = [el, 0]
      let node = walk.nextNode()

      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const long = node.textContent?.length ?? 0
          if (seen + long >= at) return [node, at - seen]
          seen += long
          last = [node, long]
        } else if (node.nodeName === 'BR' && !(node as HTMLElement).dataset?.filler) {
          const parent = node.parentNode as Node
          const which = Array.prototype.indexOf.call(parent.childNodes, node)
          if (at <= seen) return [parent, which]
          seen += 1
          last = [parent, which + 1]
        }
        node = walk.nextNode()
      }

      return last
    }

    const range = document.createRange()
    range.setStart(...spot(from))
    range.setEnd(...spot(to))
    const picked = window.getSelection()
    picked?.removeAllRanges()
    picked?.addRange(range)
  }, [])

  /** Draw the writing, marks and mentions and all. */
  const draw = useCallback((text: string) => {
    const el = box.current
    if (!el) return
    el.textContent = ''

    const piece = (words: string, classes: string) => {
      /*
       * Split on newlines here rather than relying on `white-space`: a
       * `contenteditable` that is handed a bare "\n" inside a span draws
       * nothing for it in some browsers, and a line somebody typed that
       * does not appear is worse than one that appears twice.
       */
      const lines = words.split('\n')
      lines.forEach((line, at) => {
        if (at > 0) el.append(document.createElement('br'))
        if (!line) return
        if (!classes) {
          el.append(document.createTextNode(line))
          return
        }
        const span = document.createElement('span')
        span.dataset.weight = '1'
        span.className = classes
        span.textContent = line
        el.append(span)
      })
    }

    for (const run of writingRunsOf(text)) {
      const dressed = [
        run.marks.includes('bold') && 'font-extrabold',
        run.marks.includes('italic') && 'italic',
        run.marks.includes('underline') && 'underline underline-offset-2',
        run.marks.includes('strike') && 'line-through',
        run.faint && 'text-muted',
      ].filter(Boolean).join(' ')

      if (run.faint || !people?.size) {
        piece(run.text, dressed)
        continue
      }

      for (const bit of mentionBits(run.text, (name) => people.has(name), me)) {
        piece(bit.text, 'at' in bit
          ? cn(dressed, 'rounded px-[0.2em] font-extrabold',
              bit.me ? 'bg-brand/35 text-white' : 'bg-brand/20 text-brand-bright')
          : dressed)
      }
    }

    /* A line break at the very end draws nothing on its own: the browser
       needs a second one before it will put a caret on the line that break
       opened. */
    if (text.endsWith('\n')) {
      const filler = document.createElement('br')
      filler.dataset.filler = '1'
      el.append(filler)
    }
  }, [people, me])

  /*
   * Redrawn on the two reasons only. `read` against the value is what
   * tells an outside change from a keystroke: after a keystroke the box
   * already holds the text, after an emoji it does not.
   */
  useEffect(() => {
    const el = box.current
    if (!el) return
    const held = read(el)
    const now = markShapeOf(value)
    const outside = held !== value

    if (outside || now !== shape.current) {
      const asked = outside && want ? want : caret.current
      const from = Math.min(asked.from, value.length)
      const to = Math.min(asked.to, value.length)
      draw(value)
      /*
       * Only when the box already has the caret. Putting a selection into
       * a `contenteditable` focuses it, so redrawing on mount - which is
       * every window the dock restores when a page loads - took the
       * keyboard away from whatever somebody was doing.
       */
      if (document.activeElement === el) place(from, to)
    }
    shape.current = now
    // `want` is deliberately not a reason to run: it is read when a change
    // to the text brings this round, never on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, draw, read, place])

  /** Put words in at the caret, and say where the caret went. */
  const put = (words: string) => {
    const { from, to } = caret.current
    const next = (value.slice(0, from) + words + value.slice(to)).slice(0, max)
    const now = { from: from + words.length, to: from + words.length }
    caret.current = now
    onCaret?.(now)
    onChange(next)
  }

  const tell = () => {
    const at = where()
    if (!at) return
    caret.current = at
    onCaret?.(at)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={box}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-label="Message"
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          const el = box.current
          if (!el) return
          let text = read(el)
          if (text.length > max) {
            text = text.slice(0, max)
            draw(text)
            place(text.length)
          }
          tell()
          onChange(text)
        }}
        onKeyUp={tell}
        onMouseUp={tell}
        onKeyDown={(e) => {
          if (onKey?.(e)) return
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSend?.()
            return
          }
          /*
           * The second line is put in by hand rather than left to the
           * browser. A `contenteditable` handed a shift and enter inserts
           * whatever that browser happens to insert - a `<br>` here, a
           * `<div>` there - and a stray element is the one thing that
           * makes this box rebuild itself mid-keystroke.
           */
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault()
            put('\n')
          }
        }}
        onPaste={(e) => {
          /*
           * Plain text, always. A `contenteditable` handed a copied web
           * page pastes that page's markup into it, which is both somebody
           * else's styling and a way to get elements into a message.
           */
          e.preventDefault()
          put(e.clipboardData.getData('text/plain').replace(/\r/g, ''))
        }}
        className={cn(
          'min-h-[1.65rem] whitespace-pre-wrap break-words px-3.5 text-[14px] leading-[1.65rem]',
          'focus:outline-none [overflow-wrap:anywhere]',
          className,
        )}
      />

      {/*
        * Drawn rather than an attribute, because a `contenteditable` has
        * none. Under the box and not in it, so it can never be typed over
        * or selected.
        */}
      {!value && placeholder && (
        <span className="pointer-events-none absolute inset-0 flex items-center truncate px-3.5 text-[14px] text-muted">
          {placeholder}
        </span>
      )}
    </div>
  )
}
