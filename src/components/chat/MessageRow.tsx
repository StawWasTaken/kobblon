import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faPen, faTrash, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/cn'
import { RichText } from '@/components/chat/RichText'
import { Ago } from '@/components/chat/Ago'
import { NameMarks } from '@/components/brand/Verified'
import { colourOf } from '@/lib/mentions'
import type { ConversationMember, Message } from '@/types/db'

/**
 * One message, written as a line rather than drawn as a bubble.
 *
 * Staw, with three pictures of the applications' in-game chat: adapt that
 * design here. So a message is what it is there - the name in its own
 * colour, the marks that name carries, how long ago, and then the words -
 * and the bubbles and the row of faces down the side are gone. They were
 * the thing making the dock read as a different product from the chat in a
 * World, which is the whole complaint.
 *
 * What is kept is ours and has no equivalent there: your own can still be
 * changed or taken back from the buttons that appear on hover, and a
 * message from somebody you are ignoring is still behind a blur.
 */
export function MessageRow({
  message, sender, mine, grouped, covered, people, me, onEdit, onDelete,
}: {
  message: Message
  sender?: ConversationMember
  /** Usernames who may be mentioned here, lowercased. */
  people?: Set<string>
  me?: string | null
  mine: boolean
  /** Follows another message from the same person, so it needs no picture. */
  grouped?: boolean
  /** From somebody you are ignoring: kept covered until you ask to see it. */
  covered?: boolean
  onEdit: (body: string) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.body)
  const [busy, setBusy] = useState(false)
  /*
   * Ignoring somebody does not delete what they said, it keeps it out of
   * your way. A covered message is behind a blur until you tap it, and it
   * goes back under when the chat is next opened.
   */
  const [shown, setShown] = useState(false)
  const hidden = Boolean(covered) && !mine && !shown

  if (message.is_removed) {
    return <p className="px-1.5 py-[3px] text-xs italic text-white/30">Message deleted</p>
  }

  const save = async () => {
    if (!draft.trim() || draft.trim() === message.body) {
      setEditing(false)
      return
    }
    setBusy(true)
    try {
      await onEdit(draft)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="group relative flex items-start gap-1.5 rounded-md px-1.5 py-[3px] transition-colors hover:bg-white/[0.03]">
      {editing ? (
        <div className="flex w-full items-center gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') { setDraft(message.body); setEditing(false) }
            }}
            autoFocus
            maxLength={2000}
            aria-label="Edit your message"
            className="h-8 min-w-0 flex-1 rounded-lg border border-brand-bright bg-ink-raised px-2.5 text-sm"
          />
          <button
            onClick={save}
            disabled={busy}
            aria-label="Save"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-space-bright hover:bg-ink-hover"
          >
            <Glyph icon={faCheck} className="text-xs" />
          </button>
          <button
            onClick={() => { setDraft(message.body); setEditing(false) }}
            aria-label="Cancel"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/40 hover:bg-ink-hover"
          >
            <Glyph icon={faXmark} className="text-xs" />
          </button>
        </div>
      ) : (
        <p
          className={cn(
            // One paragraph, so the words run on after the name and wrap
            // under it the way a line of chat does. `anywhere` because a
            // name nobody can break is still a word somebody will send.
            'min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-[1.5] text-white/85',
            '[overflow-wrap:anywhere]',
            hidden && 'cursor-pointer select-none',
          )}
          onClick={hidden ? () => setShown(true) : undefined}
          role={hidden ? 'button' : undefined}
          tabIndex={hidden ? 0 : undefined}
          onKeyDown={hidden ? (e) => { if (e.key === 'Enter' || e.key === ' ') setShown(true) } : undefined}
          aria-label={hidden ? 'Message from somebody you are ignoring. Show it?' : undefined}
          title={hidden ? 'You are ignoring this person. Tap to read.' : undefined}
        >
          {/*
            * Who said it, in the applications' order: the name, the marks
            * their name carries, then how long ago with a dash. Only on
            * the first of a run - the rest are the same person still
            * talking, and repeating the name on every line is how a short
            * exchange becomes a wall of names. The colour comes from the
            * account id rather than the display name, so it survives a
            * rename and two people called "Kobby" do not share one.
            */}
          {!grouped && (
            <>
              <Link
                to={`/u/${sender?.username ?? ''}`}
                className="font-extrabold hover:underline"
                style={{ color: colourOf(message.sender_id, sender?.display_name) }}
              >
                {mine ? 'you' : sender?.display_name ?? 'Somebody'}
              </Link>
              <NameMarks id={message.sender_id} className="ml-0.5 text-[0.85em]" />
              <Ago at={message.created_at} className="mx-1 text-[11px] font-bold text-muted/70" />
            </>
          )}
          <span className={cn(hidden && 'blur-[5px]')}>
            {/* Marks and a picture, drawn from the text rather than built
                as markup - `RichText` says why. */}
            <RichText text={message.body} people={people} me={me} />
          </span>
          {message.edited_at && (
            <span className="ml-1 text-[10px] text-white/35">edited</span>
          )}
        </p>
      )}

      {mine && !editing && (
        <div className="absolute right-1 top-0 flex shrink-0 gap-0.5 rounded-md bg-ink-card/90 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Tooltip label="Edit" side="top">
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit this message"
              className="grid h-6 w-6 place-items-center rounded-md text-white/35 hover:bg-ink-hover hover:text-white"
            >
              <Glyph icon={faPen} className="text-[10px]" />
            </button>
          </Tooltip>
          <Tooltip label="Delete" side="top">
            <button
              onClick={onDelete}
              aria-label="Delete this message"
              className="grid h-6 w-6 place-items-center rounded-md text-white/35 hover:bg-ink-hover hover:text-white"
            >
              <Glyph icon={faTrash} className="text-[10px]" />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
