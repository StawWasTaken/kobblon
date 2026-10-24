import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Glyph } from '@/components/brand/Glyph'
import { faImage, faXmark, faPaperPlane } from '@fortawesome/free-solid-svg-icons'
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

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={compact ? 3 : 7}
        maxLength={12000}
        autoFocus={autoFocus && !withTitle}
        className="w-full resize-y rounded-xl border border-white/10 bg-ink px-4 py-3 text-[15px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/25 focus:border-brand-bright"
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
