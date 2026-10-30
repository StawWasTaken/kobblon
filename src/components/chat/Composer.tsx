import { useEffect, useRef, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import {
  faBold, faItalic, faUnderline, faStrikethrough, faFaceSmile, faPaperPlane,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { EmojiCard } from '@/components/chat/EmojiCard'
import { wrap } from '@/lib/rich'
import type { Mark } from '@/lib/rich'
import { cn } from '@/lib/cn'

const marks: { mark: Mark; icon: IconDefinition; label: string }[] = [
  { mark: 'bold', icon: faBold, label: 'Bold' },
  { mark: 'italic', icon: faItalic, label: 'Italic' },
  { mark: 'underline', icon: faUnderline, label: 'Underline' },
  { mark: 'strike', icon: faStrikethrough, label: 'Strikethrough' },
]

/**
 * The box somebody writes in.
 *
 * Three things live here that used to be one bare input: the marks
 * (`**bold**` and the rest), the emoji card, and sending. They are
 * together because they all act on the same text and the same cursor -
 * split across the dock they were three components reaching into one
 * another's selection, which is how a formatting button ends up wrapping
 * the wrong words.
 *
 * The mark bar appears when something is selected and goes away when
 * nothing is. A permanent row of four buttons over a one-line chat box is
 * a toolbar in a window the size of a phone; a bar that turns up when you
 * have chosen words is the same feature without the furniture.
 */
export function Composer({ id, value, onChange, onSend, sending }: {
  id: string
  value: string
  onChange: (next: string) => void
  onSend: () => void
  sending?: boolean
}) {
  const box = useRef<HTMLTextAreaElement>(null)

  /*
   * A textarea does not grow with what is in it, so a second line is a
   * line somebody cannot see while they are writing it. Measured after
   * every change: height to nothing first, so the scroll height is what
   * the text needs rather than what the box currently is.
   */
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`
  }, [value])
  const [picking, setPicking] = useState(false)
  const [chosen, setChosen] = useState<{ from: number; to: number } | null>(null)

  /** Where the cursor is, kept as it moves so a button can act on it. */
  const watch = () => {
    const el = box.current
    if (!el) return
    const { selectionStart, selectionEnd } = el
    setChosen(selectionStart === selectionEnd ? null : { from: selectionStart, to: selectionEnd })
  }

  const put = (mark: Mark) => {
    const el = box.current
    if (!el || !chosen) return
    const next = wrap(value, chosen.from, chosen.to, mark)
    onChange(next.text)
    // After React has written the new value, put the selection back around
    // the same words - otherwise the cursor lands at the end and the next
    // mark wraps nothing.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(next.from, next.to)
      setChosen({ from: next.from, to: next.to })
    })
  }

  const addEmoji = (emoji: string) => {
    const el = box.current
    const at = el ? el.selectionStart : value.length
    onChange(value.slice(0, at) + emoji + value.slice(at))
    setPicking(false)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + emoji.length, at + emoji.length)
    })
  }

  return (
    <div className="relative">
      {chosen && (
        <div className="absolute -top-10 left-1 z-10 flex items-center gap-0.5 rounded-xl border border-ink-line bg-ink-card p-1 shadow-pop">
          {marks.map((one) => (
            <button
              key={one.mark}
              type="button"
              // Pressing must not take the selection away before it acts.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => put(one.mark)}
              title={one.label}
              aria-label={one.label}
              className="grid h-7 w-7 place-items-center rounded-lg text-xs text-white/60 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <Glyph icon={one.icon} />
            </button>
          ))}
        </div>
      )}

      {picking && <EmojiCard onPick={addEmoji} onClose={() => setPicking(false)} />}

      <div className="flex items-end gap-1.5">
        <label className="sr-only" htmlFor={id}>Message</label>
        <textarea
          ref={box}
          id={id}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onSelect={watch}
          onKeyUp={watch}
          onBlur={() => setChosen(null)}
          onKeyDown={(e) => {
            // Enter sends; shift and enter is a second line, like everywhere.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          maxLength={2000}
          /*
           * A chat box is not a form field worth remembering. Left to
           * itself the browser keeps every line anybody has sent and
           * offers them back in a dropdown, which puts one person's
           * messages on screen in front of the next person to use the
           * computer.
           */
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck
          name={id}
          placeholder="Send a message"
          className={cn(
            'max-h-28 min-h-[2.25rem] min-w-0 flex-1 resize-none rounded-2xl border border-ink-line bg-ink-raised',
            'px-3.5 py-2 text-sm leading-snug placeholder:text-white/30 focus:border-brand-bright focus:outline-none',
          )}
        />

        <button
          type="button"
          onClick={() => setPicking((on) => !on)}
          title="Emoji"
          aria-label="Emoji"
          aria-expanded={picking}
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/50 transition-colors',
            'hover:bg-ink-hover hover:text-white',
            picking && 'bg-ink-hover text-white',
          )}
        >
          <Glyph icon={faFaceSmile} />
        </button>

        <button
          type="submit"
          disabled={!value.trim() || sending}
          aria-label="Send"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-bright disabled:opacity-40"
        >
          <Glyph icon={faPaperPlane} className="text-xs" />
        </button>
      </div>
    </div>
  )
}
