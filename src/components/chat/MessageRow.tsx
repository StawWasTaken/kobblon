import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faPen, faTrash, faCheck, faXmark, faEllipsis, faCopy } from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Menu, type MenuItem } from '@/components/ui/Menu'
import { Confirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { RichText } from '@/components/chat/RichText'
import { stickerIn, useNamedPictures } from '@/lib/stickers'
import { Ago } from '@/components/chat/Ago'
import { NameMarks } from '@/components/brand/Verified'
import { colourOf } from '@/lib/mentions'
import type { ConversationMember, Message } from '@/types/db'
import { avatarOf } from '@/lib/avatars'

/**
 * A message that was taken back, or a run of them as one line.
 *
 * Six of these stacked up the right of a conversation is what Staw was
 * looking at when he said the deleted messages should "look better and if
 * theres a lot then regroup the text". They had been ghost bubbles: an
 * empty avatar column, an italic line pushed to one side, one per message.
 * Six rows of furniture for nothing - because a deleted message says
 * nothing about who sent it or what it was, and six of them say exactly
 * what one of them says.
 *
 * So it is centred rather than taken by a side. The side a bubble sits on
 * means who is talking, and this has nobody talking in it; drawing it as
 * though it did was the thing that made a tidy conversation look like a
 * broken one. It reads like the time separator above it, which is the
 * other line in here that is about the conversation rather than in it.
 *
 * The count is the whole of the grouping. A run is merged across senders
 * on purpose: nothing in the line is attributed, so "two people each
 * deleted three" has nothing to draw it with and would be inventing a
 * fact the row does not have.
 */
export function DeletedRun({ count }: { count: number }) {
  return (
    <div className="my-1 flex items-center justify-center px-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-line bg-ink/40 px-2.5 py-1 text-[11px] font-bold text-white/35">
        <Glyph icon={faTrash} className="text-[9px]" />
        {count === 1 ? 'Message deleted' : `${count} messages deleted`}
      </span>
    </div>
  )
}

/**
 * One message, with its sender's picture beside it. Your own can be changed
 * or taken back from the menu that appears on hover.
 *
 * This was flattened into a plain in-game line for one round, after Staw
 * asked for the dock to carry the applications' chat design. He looked at
 * it and said no: "i want the old bubbles with pfp back, but except that, u
 * can keep it like that". So the bubbles and the picture are what they
 * were, and everything else the round changed - the flat head, the GIF
 * chip, the calm send, the window's own proportions - stays.
 *
 * What the round did leave behind, because it was right and he did not ask
 * for it back: the name, the marks and the time read in the applications'
 * order, so a line of chat says the same things in the same order here as
 * it does in a World.
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
  const [asking, setAsking] = useState(false)
  const toast = useToast()
  /*
   * Ignoring somebody does not delete what they said, it keeps it out of
   * your way. A covered message is behind a blur until you tap it, and it
   * goes back under when the chat is next opened.
   */
  const [shown, setShown] = useState(false)
  /* Whether this message is a sticker, which decides whether it gets a
     bubble. Read from the same list `RichText` draws it from, so the two
     cannot disagree about what this message is. */
  const sticker = stickerIn(message.body, useNamedPictures())
  const hidden = Boolean(covered) && !mine && !shown

  /*
   * A removed message is drawn by `DeletedRun`, which the dock places for
   * a whole run of them at once. Nothing reaches here any more, and the
   * guard stays so that a caller that has not learned to group them shows
   * one line rather than the message somebody took back.
   */
  if (message.is_removed) return <DeletedRun count={1} />

  const save = async () => {
    if (!draft.trim() || draft.trim() === message.body) {
      setDraft(message.body)
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.body)
      toast('Message copied.', 'success')
    } catch {
      toast('Your browser would not let me copy that.', 'error')
    }
  }

  /*
   * One button rather than two.
   *
   * Edit and Delete had been a pair of faint sixteen-pixel glyphs floating
   * beside the bubble, which is two problems in one: the heaviest thing
   * you can do to a message sat a few pixels from the lightest, and both
   * were small enough to catch by accident. Staw: the edit and delete
   * feature "should be redesigned and fixed". It is the forum's menu now -
   * the same three dots, the same list, the same red at the bottom behind
   * a line - so a message behaves the same wherever one is written.
   *
   * And deleting asks first. It did not, and there is nothing behind it:
   * a message taken back cannot be put back.
   */
  const items: MenuItem[] = [
    { label: 'Copy text', icon: faCopy, onSelect: copy },
    { label: 'Edit', icon: faPen, onSelect: () => { setDraft(message.body); setEditing(true) } },
    {
      label: 'Delete', icon: faTrash, danger: true, separated: true,
      onSelect: () => setAsking(true),
    },
  ]

  return (
    <div
      className={cn(
        // Aligned to the top and nudged a little higher, so the picture
        // sits beside the cut corner that points at it rather than under
        // the end of the bubble.
        'group flex items-start gap-2',
        mine ? 'flex-row-reverse' : 'flex-row',
        grouped ? 'mt-0.5' : 'mt-2',
      )}
    >
      {/* One picture per run of messages; the rest line up under it. */}
      {grouped ? (
        <span className="w-6 shrink-0" aria-hidden="true" />
      ) : (
        <Link
          to={`/u/${sender?.username ?? ''}`}
          className="-mt-0.5 shrink-0"
          aria-label={sender?.display_name ?? 'Profile'}
        >
          <Avatar src={avatarOf(sender)} personId={message.sender_id} name={sender?.display_name ?? 'K'} size="xs" />
        </Link>
      )}

      <div className={cn('flex min-w-0 max-w-[78%] flex-col', mine && 'items-end')}>
        {/*
          * Who said it and when, over the first bubble of a run.
          *
          * The order is the applications' order, because a line of chat
          * should read the same in a World as it does here: the name,
          * then the marks their name carries, then the time written with
          * a dash. The name is coloured from the account id rather than
          * from the display name, so the colour survives a rename and two
          * people called "Kobby" do not share one.
          *
          * **The order never flips for your own messages.** It did, so
          * your own line read "- 5m you" with the badges on the far side
          * of the time. Staw: the time and the badges "only work when its
          * right to the displayname". He is right - they are things said
          * about that name, and a mark that has drifted two words away
          * from the name it belongs to is a mark on nothing. Your own
          * messages still sit on the right; it is the row that is aligned
          * there, not the words inside it that are reversed.
          */}
        {!grouped && !editing && (
          <span className="mb-0.5 flex max-w-full items-center gap-1 px-1 text-[11px] leading-none">
            <span
              className="truncate font-extrabold"
              style={{ color: colourOf(message.sender_id, sender?.display_name) }}
            >
              {sender?.display_name ?? 'Somebody'}
            </span>
            <NameMarks id={message.sender_id} className="text-[0.9em]" />
            <Ago at={message.created_at} className="shrink-0 font-bold text-muted/70" />
          </span>
        )}

        {editing ? (
          /*
           * The editor is the composer's field, not a bare input dropped
           * where the bubble was. Same border, same lit edge, same
           * rounding - editing a message is writing one, and the two
           * looking different was the thing that made this feel unbuilt.
           * The two keys that do the work are written under it, because
           * the buttons are small and Enter is what everybody reaches
           * for anyway.
           */
          <div className="flex w-full flex-col gap-1">
            <div className="flex items-center gap-1 rounded-xl border-2 border-brand/60 bg-ink/40 py-1 pl-1 pr-1">
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
                className="h-7 min-w-0 flex-1 bg-transparent px-2 text-sm focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <button
                type="button"
                onClick={save}
                disabled={busy}
                aria-label="Save"
                title="Save"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-bright disabled:opacity-50"
              >
                <Glyph icon={faCheck} className="text-[11px]" />
              </button>
              <button
                type="button"
                onClick={() => { setDraft(message.body); setEditing(false) }}
                aria-label="Cancel"
                title="Cancel"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Glyph icon={faXmark} className="text-[11px]" />
              </button>
            </div>
            <span className={cn('px-1 text-[10px] font-bold text-muted', mine && 'text-right')}>
              Enter to save · Esc to cancel
            </span>
          </div>
        ) : (
          <div
            className={cn(
              'relative text-sm leading-snug',
              /*
               * A sticker has no bubble. It is a drawing with its own
               * edges and its own transparency, and a panel behind it
               * turns it into a sticker stuck on a card - which is what
               * it looked like the first time this was drawn.
               *
               * Only when it is actually being shown: a message from
               * somebody being ignored is blurred and has to be pressed,
               * and that needs a shape to press.
               */
              !(sticker && !hidden) && 'rounded-2xl px-3 py-1.5',
              // The top corner nearest the avatar is cut short, so the bubble
              // points at whoever said it rather than floating beside them.
              !(sticker && !hidden) && (mine ? 'rounded-tr-[5px]' : 'rounded-tl-[5px]'),
              !(sticker && !hidden) && (mine ? 'bg-brand text-white' : 'bg-ink-hover text-white/90'),
              hidden && 'cursor-pointer select-none',
            )}
            onClick={hidden ? () => setShown(true) : undefined}
            role={hidden ? 'button' : undefined}
            tabIndex={hidden ? 0 : undefined}
            onKeyDown={hidden ? (e) => { if (e.key === 'Enter' || e.key === ' ') setShown(true) } : undefined}
            aria-label={hidden ? 'Message from somebody you are ignoring. Show it?' : undefined}
            title={hidden ? 'You are ignoring this person. Tap to read.' : undefined}
          >
            <p className={cn(
              'whitespace-pre-wrap [overflow-wrap:anywhere]',
              hidden && 'blur-[5px]',
            )}>
              {/* Marks and a picture, drawn from the text rather than built
                  as markup - `RichText` says why. */}
              <RichText text={message.body} people={people} me={me} />
              {/*
                * On the same line as the last word, not under it.
                *
                * It had been its own block, which put a word of furniture
                * on its own row under every message anybody had corrected
                * a typo in - and it was never seen anyway, because the
                * stamp behind it had not been written since 0170 (0312
                * puts the trigger back). Inline and in brackets is how
                * the forum already writes this, and how Staw asked for it
                * by name: "the '(edited)' thing".
                */}
              {message.edited_at && !hidden && (
                <span
                  title={`Edited ${new Date(message.edited_at).toLocaleString()}`}
                  className={cn(
                    'ml-1.5 align-baseline text-[10px] font-bold',
                    mine ? 'text-white/55' : 'text-white/35',
                  )}
                >
                  (edited)
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {mine && !editing && (
        <div className="shrink-0 self-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
          <Menu
            label="What to do with this message"
            align="left"
            items={items}
            trigger={
              <span className="grid h-6 w-6 place-items-center rounded-md text-white/35 transition-colors hover:bg-ink-hover hover:text-white">
                <Glyph icon={faEllipsis} className="text-[11px]" />
              </span>
            }
          />
        </div>
      )}

      <Confirm
        open={asking}
        onClose={() => setAsking(false)}
        onConfirm={onDelete}
        title="Delete this message?"
        lead="It will be taken out of the conversation for both of you. This cannot be undone."
        confirmText="Delete"
      />
    </div>
  )
}
