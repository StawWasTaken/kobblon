import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Glyph } from '@/components/brand/Glyph'
import {
  faImage, faXmark, faPaperPlane, faHeading, faBold, faItalic, faStrikethrough,
  faQuoteRight, faCode, faListUl, faListOl, faMinus, faCircleInfo,
} from '@fortawesome/free-solid-svg-icons'
import { Link } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { forumImageUrl, uploadForumImage } from '@/lib/api'
import { cn } from '@/lib/cn'

/**
 * Writing something, with pictures.
 *
 * One composer for a topic and for a reply, because they are the same act
 * with a different number of fields, and two of these is two places for
 * "four pictures at most" to be a different number.
 *
 * **The pictures go up before the post does.** A file that is uploaded as
 * part of submitting means a failed upload loses what somebody typed, and
 * a post with half its attachments is worse than one that refused. So each
 * picture is put up as it is chosen, the thumbnail shows what is actually
 * stored rather than a local preview that may never have landed, and the
 * post carries the paths.
 *
 * The ceiling is enforced here *and* in the database. Not belt and braces
 * for its own sake: this one is so somebody is told before they wait for an
 * upload, and that one is because a rule that only exists in a browser is
 * not a rule.
 */
const MOST = 4
const BIGGEST = 2 * 1024 * 1024

/*
 * The toolbar.
 *
 * Each of these writes a mark that `Markup` reads back, and that is the
 * whole rule it had to satisfy: a button that produces something nothing
 * renders is a control that implies the runtime does something it does not.
 * The set is small because the renderer's is small, and they are the same
 * list on purpose - the day one grows, the other has to in the same change.
 *
 * `wrap` goes either side of what is selected; `line` goes at the front of
 * the line. A picture is not here: it is an attachment, which goes through
 * our bucket and our size limit rather than a URL somebody pasted, so it
 * keeps the button it already had.
 */
type Mark =
  | { icon: typeof faBold; title: string; wrap: string }
  | { icon: typeof faBold; title: string; line: string }
  | { icon: typeof faBold; title: string; block: string }

const MARKS: Mark[][] = [
  [
    { icon: faHeading, title: 'Heading', line: '## ' },
    { icon: faBold, title: 'Bold', wrap: '**' },
    { icon: faItalic, title: 'Italic', wrap: '*' },
    { icon: faStrikethrough, title: 'Crossed out', wrap: '~~' },
  ],
  [
    { icon: faQuoteRight, title: 'Quote', line: '> ' },
    { icon: faCode, title: 'Code', wrap: '`' },
  ],
  [
    { icon: faListUl, title: 'List', line: '- ' },
    { icon: faListOl, title: 'Numbered list', line: '1. ' },
    { icon: faMinus, title: 'A line across', block: '\n---\n' },
  ],
]

export function Composer({
  placeholder, action, withTitle, busy, onSend, onCancel, autoFocus, compact,
}: {
  placeholder: string
  /** What the button says. "Post it", "Reply". */
  action: string
  withTitle?: { value: string; onChange: (next: string) => void }
  busy?: boolean
  onSend: (body: string, images: string[]) => Promise<void> | void
  onCancel?: () => void
  autoFocus?: boolean
  compact?: boolean
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const file = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [putting, setPutting] = useState(false)

  /*
   * Signed out, this is not a disabled box: a textarea you cannot type in
   * is a thing that looks broken. It is the sentence saying what to do, and
   * the way to do it.
   */
  if (!profile) {
    return (
      <div className="rounded-2xl border border-white/10 bg-ink-card/60 p-5 text-center">
        <p className="text-sm text-white/60">
          You need an account to post on the forum. Reading it needs nothing.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button to="/signup" size="sm" variant="yes">Make an account</Button>
          <Button to="/login" size="sm" variant="subtle">Log in</Button>
        </div>
      </div>
    )
  }

  const choose = async (chosen: FileList | null) => {
    if (!chosen?.length) return
    const room = MOST - images.length
    if (room <= 0) {
      toast('Four pictures at most.', 'info')
      return
    }

    setPutting(true)
    try {
      for (const one of Array.from(chosen).slice(0, room)) {
        if (!one.type.startsWith('image/')) {
          toast('Pictures only.', 'info')
          continue
        }
        if (one.size > BIGGEST) {
          toast(`${one.name} is over two megabytes.`, 'info')
          continue
        }
        const path = await uploadForumImage(one, profile.id)
        setImages((had) => [...had, path])
      }
    } catch (wrong) {
      toast(wrong instanceof Error ? wrong.message : 'That picture did not go up.', 'error')
    } finally {
      setPutting(false)
      if (file.current) file.current.value = ''
    }
  }

  /*
   * Applying a mark.
   *
   * It goes through the textarea's own selection rather than keeping a
   * cursor of our own, because the cursor that matters is the one the
   * person can see, and a second one kept in state is a value captured
   * before the thing that decides it - they move the caret, we do not hear
   * about it, and the next button writes in the wrong place.
   */
  const put = (mark: Mark) => {
    const node = box.current
    if (!node) return
    const from = node.selectionStart
    const to = node.selectionEnd
    const chosen = body.slice(from, to)

    let next: string
    let caret: number

    if ('wrap' in mark) {
      next = body.slice(0, from) + mark.wrap + (chosen || '') + mark.wrap + body.slice(to)
      caret = from + mark.wrap.length + chosen.length
    } else if ('block' in mark) {
      next = body.slice(0, from) + mark.block + body.slice(to)
      caret = from + mark.block.length
    } else {
      // At the front of every line the selection touches, not just the first.
      const lineFrom = body.lastIndexOf('\n', from - 1) + 1
      const head = body.slice(0, lineFrom)
      const middle = body.slice(lineFrom, to)
      const tail = body.slice(to)
      const marked = middle.split('\n').map((one) => mark.line + one).join('\n')
      next = head + marked + tail
      caret = head.length + marked.length
    }

    setBody(next)
    /* After React has written the new value, or the caret is set on the old
       one and jumps back the moment it re-renders. */
    requestAnimationFrame(() => {
      node.focus()
      node.setSelectionRange(caret, caret)
    })
  }

  const send = async () => {
    if (!body.trim()) return
    await onSend(body.trim(), images)
    setBody('')
    setImages([])
  }

  const titleTooShort = withTitle ? withTitle.value.trim().length < 6 : false

  return (
    <div className={cn(
      'rounded-2xl border border-white/10 bg-ink-card/60',
      compact ? 'p-3' : 'p-4 sm:p-5',
    )}>
      {withTitle && (
        <input
          value={withTitle.value}
          onChange={(e) => withTitle.onChange(e.target.value)}
          placeholder="What is it about? Say it in one line."
          maxLength={140}
          autoFocus={autoFocus}
          className="mb-3 w-full rounded-xl border border-white/10 bg-ink px-4 py-3 font-display text-lg font-extrabold text-white outline-none transition-colors placeholder:font-bold placeholder:text-white/25 focus:border-brand-bright"
        />
      )}

      <div className="mb-px flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-white/10 bg-ink-raised/60 px-2 py-1.5">
        {MARKS.map((group, at) => (
          <span key={at} className="flex items-center gap-0.5">
            {at > 0 && <span className="mx-1 h-4 w-px bg-white/10" />}
            {group.map((mark) => (
              <button
                key={mark.title}
                type="button"
                title={mark.title}
                aria-label={mark.title}
                onClick={() => put(mark)}
                className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Glyph icon={mark.icon} className="text-xs" />
              </button>
            ))}
          </span>
        ))}
      </div>

      <textarea
        ref={box}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={compact ? 3 : 7}
        maxLength={12000}
        autoFocus={autoFocus && !withTitle}
        className="w-full resize-y rounded-b-xl border border-white/10 bg-ink px-4 py-3 text-[15px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/25 focus:border-brand-bright"
      />

      {images.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {images.map((path) => (
            <li key={path}>
              <Thumb path={path} onDrop={() => setImages((had) => had.filter((p) => p !== path))} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => choose(e.target.files)}
        />
        <Button
          size="sm"
          variant="subtle"
          icon={faImage}
          onClick={() => file.current?.click()}
          disabled={putting || images.length >= MOST}
          loading={putting}
        >
          {images.length ? `${images.length}/${MOST}` : 'Add a picture'}
        </Button>

        <span className="ml-auto flex items-center gap-2">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          )}
          <Button
            size="sm"
            variant="yes"
            icon={faPaperPlane}
            onClick={send}
            loading={busy}
            disabled={!body.trim() || titleTooShort || putting}
          >
            {action}
          </Button>
        </span>
      </div>

      {withTitle && titleTooShort && withTitle.value.trim().length > 0 && (
        <p className="mt-2 text-xs text-white/40">A title wants at least six characters.</p>
      )}

      {/*
       * What the rules are, before it is posted rather than after.
       *
       * It links the Community Guidelines, which is a page that exists -
       * there is no separate set of forum rules and saying there was would
       * be inventing a page. Kobby reads every post either way, and saying
       * so is fairer than letting somebody find out.
       */}
      {withTitle && (
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-white/35">
          <Glyph icon={faCircleInfo} className="mt-0.5 shrink-0 text-white/25" />
          <span>
            Kobby reads everything posted here, and the{' '}
            <Link to="/guidelines" className="font-bold text-white/55 underline-offset-2 hover:text-brand-bright hover:underline">
              Community Guidelines
            </Link>{' '}
            apply the same as everywhere else on Kobblon.
          </span>
        </p>
      )}
    </div>
  )
}

function Thumb({ path, onDrop }: { path: string; onDrop: () => void }) {
  return (
    <span className="group relative block h-20 w-20 overflow-hidden rounded-xl border border-white/10 bg-media">
      <img
        src={forumImageUrl(path)}
        alt="Attached"
        className="h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={onDrop}
        aria-label="Take this picture off"
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-lg bg-ink/80 text-white/70 opacity-0 transition-opacity hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Glyph icon={faXmark} className="text-xs" />
      </button>
    </span>
  )
}
