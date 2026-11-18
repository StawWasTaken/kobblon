import { useState } from 'react'
import { faCommentDots, faPen } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'

/** As long as a thought may be, matching `profiles_thought_check`. */
export const THOUGHT_LIMIT = 120

/*
 * A thought: the one line somebody has over their head.
 *
 * It is drawn as a thinking bubble rather than a speaking one - a round
 * shape with two circles trailing down to the picture - because it is what
 * they are thinking rather than something they said to you. The Launcher
 * draws the same thing over a player in a World; this is that in two
 * dimensions, in the one place it belongs: their own profile.
 *
 * Everywhere else somebody is listed it is a line with no bubble at all,
 * because a page of bubbles is a page of noise.
 */
export function ThoughtBubble({ thought, mine, onEdit, className }: {
  thought?: string | null
  /** Your own page: an empty bubble invites you to write one. */
  mine?: boolean
  onEdit?: () => void
  className?: string
}) {
  const said = thought?.trim()
  if (!said && !mine) return null

  const body = (
    <>
      <span
        className={cn(
          'block max-w-[14rem] rounded-2xl border-2 border-ink-line bg-ink-card px-3 py-2',
          'text-center text-xs font-bold leading-snug',
          said ? 'text-white/85' : 'text-muted',
          mine && 'transition-colors group-hover:border-brand/60 group-hover:bg-ink-hover',
        )}
      >
        {said || 'What are you thinking?'}
        {mine && (
          <Glyph icon={faPen} className="ml-1.5 align-middle text-tiny text-white/35" />
        )}
      </span>

      {/* The two circles that make it a thought rather than a sentence. */}
      <span className="mt-1 flex flex-col items-center gap-1">
        <span className="h-3.5 w-3.5 rounded-full border-2 border-ink-line bg-ink-card" />
        <span className="-ml-3 h-2 w-2 rounded-full border-2 border-ink-line bg-ink-card" />
      </span>
    </>
  )

  if (!mine) return <span className={cn('flex flex-col items-center', className)}>{body}</span>

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={said ? 'Change your thought' : 'Write a thought'}
      className={cn('group flex flex-col items-center', className)}
    >
      {body}
    </button>
  )
}

/**
 * The same thing with no bubble, for a row in a list: one line, cut off
 * where it runs out of room.
 */
export function ThoughtLine({ thought, className }: { thought?: string | null; className?: string }) {
  const said = thought?.trim()
  if (!said) return null

  return (
    <p className={cn('flex min-w-0 items-center gap-1.5 text-xs text-white/60', className)}>
      <Glyph icon={faCommentDots} className="shrink-0 text-mini text-white/30" />
      <span className="truncate">{said}</span>
    </p>
  )
}

/**
 * Writing one, taking it down.
 *
 * The limit is the database's, said out loud rather than enforced quietly:
 * a box that silently stops taking letters reads as broken.
 */
export function ThoughtDialog({ open, onClose, thought, onSave }: {
  open: boolean
  onClose: () => void
  thought?: string | null
  onSave: (next: string | null) => Promise<void>
}) {
  const [text, setText] = useState(thought ?? '')
  const [saving, setSaving] = useState(false)

  const save = async (next: string | null) => {
    setSaving(true)
    try {
      await onSave(next)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your thought"
      description="One line over your head, on your profile. Take it down whenever you like."
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => save(text.trim() || null)}
            disabled={saving || text.trim() === (thought ?? '').trim()}
          >
            Save
          </Button>
          {!!thought?.trim() && (
            <Button variant="ghost" onClick={() => save(null)} disabled={saving}>
              Take it down
            </Button>
          )}
        </div>
      }
    >
      <Input
        label="Thought"
        labelNote={`${text.trim().length}/${THOUGHT_LIMIT}`}
        value={text}
        maxLength={THOUGHT_LIMIT}
        autoFocus
        placeholder="What are you thinking?"
        onChange={(e) => setText(e.target.value)}
      />
    </Dialog>
  )
}
