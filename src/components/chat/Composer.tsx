import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faBold, faItalic, faUnderline, faStrikethrough, faPaperPlane, faFilm,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/brand/Icon'
import { FACE_YELLOW } from '@/components/social/Reactions'
import { EmojiCard, emojiHeld, loadEmoji } from '@/components/chat/EmojiCard'
import { GifCard } from '@/components/chat/GifCard'
import { gifsReady } from '@/lib/gifs'
import { WritingBox } from '@/components/chat/WritingBox'
import { wrap } from '@/lib/rich'
import type { Mark } from '@/lib/rich'
import { avatarOf } from '@/lib/avatars'
import { cn } from '@/lib/cn'
import type { ConversationMember } from '@/types/db'

const marks: { mark: Mark; icon: IconDefinition; label: string }[] = [
  { mark: 'bold', icon: faBold, label: 'Bold' },
  { mark: 'italic', icon: faItalic, label: 'Italic' },
  { mark: 'underline', icon: faUnderline, label: 'Underline' },
  { mark: 'strike', icon: faStrikethrough, label: 'Strikethrough' },
]

/** Where the countdown starts appearing: before that there is nothing to count. */
const COUNT_FROM = 200

type Pick = { key: string; take: string; label: string; hint?: string; lead: React.ReactNode }

/**
 * Everything somebody does while writing a message.
 *
 * The box, the weight, the emoji card, the two suggestion lists and the
 * send. They are one component because they all act on the same text and
 * the same caret - split across the dock they were separate things reaching
 * into one another's selection, which is how a formatting button ends up
 * wrapping the wrong words.
 *
 * The shape is the applications' chat card, which Staw asked for by name:
 * the row is the furniture rather than the field, with one lit edge in the
 * whole panel, and the card buttons light up with their own card so a
 * button and the card it opened read as the same thing.
 */
export function Composer({
  id, value, onChange, onSend, onSendText, sending, members, me, onCard,
}: {
  id: string
  value: string
  onChange: (next: string) => void
  onSend: () => void
  sending?: boolean
  /** Sends a message that is not what is in the box, which is what a GIF is. */
  onSendText?: (body: string) => void
  /** Who is in this conversation, for `@` and for the mention pills. */
  members?: ConversationMember[]
  me?: string | null
  /** Told when a card opens or shuts, so the window can make room for it. */
  onCard?: (open: boolean) => void
}) {
  /** Which card is open under the box, if either. */
  const [card, setCard] = useState<'emoji' | 'gif' | null>(null)
  /*
   * Whether GIFs work at all on this website, asked once per tab.
   *
   * The button is drawn only when the answer is yes. Klipy wants a key,
   * the key lives in the `gifs` function, and a GIF button over a card
   * that can never fill is exactly the control `docs/neoclassic.md`
   * forbids - so until the key is set there is no button rather than a
   * broken one.
   */
  const [gifs, setGifs] = useState(false)
  useEffect(() => {
    let live = true
    void gifsReady().then((yes) => { if (live) setGifs(yes) })
    return () => { live = false }
  }, [])
  const [here, setHere] = useState(false)
  const [caret, setCaret] = useState({ from: 0, to: 0 })
  const [bar, setBar] = useState<{ left: number; top: number } | null>(null)
  const [lit, setLit] = useState(0)
  const [emoji, setEmoji] = useState(emojiHeld())
  const wrote = useRef(value)
  wrote.current = value

  useEffect(() => { onCard?.(card !== null) }, [card, onCard])

  const people = useMemo(
    () => new Set((members ?? []).map((one) => one.username.toLowerCase())),
    [members],
  )

  /*
   * The mark bar is a portal to the body.
   *
   * It has to be outside the box: the box is a `contenteditable` and
   * anything inside one is writing as far as the browser is concerned, so
   * a bar drawn in it would be four buttons somebody can type over and
   * select. Placed from the selection's own rectangle and clamped to the
   * window, because a selection at the right edge put it off screen.
   */
  useEffect(() => {
    if (caret.from === caret.to) { setBar(null); return }
    const picked = window.getSelection()
    if (!picked || picked.rangeCount === 0) { setBar(null); return }
    const box = picked.getRangeAt(0).getBoundingClientRect()
    if (!box.width && !box.height) { setBar(null); return }
    setBar({
      left: Math.max(8, Math.min(box.left, window.innerWidth - 160)),
      top: Math.max(8, box.top - 42),
    })
  }, [caret])

  /*
   * What is being suggested, read at the caret.
   *
   * Only one list is ever open, and no state decides which: both triggers
   * are read from the words in front of the caret and the later of the two
   * wins, which is the right answer by definition - it is the one being
   * typed.
   */
  const suggesting = useMemo(() => {
    if (caret.from !== caret.to) return null
    const before = value.slice(0, caret.from)
    const emojiHit = /(?:^|\s):([a-z0-9_+-]{2,})$/.exec(before)
    const peopleHit = /(?:^|\s)@([a-z0-9_]*)$/.exec(before)
    const emojiAt = emojiHit ? before.length - emojiHit[1].length - 1 : -1
    const peopleAt = peopleHit ? before.length - peopleHit[1].length - 1 : -1
    if (emojiAt < 0 && peopleAt < 0) return null
    return emojiAt > peopleAt
      ? { kind: 'emoji' as const, word: emojiHit![1], at: emojiAt }
      : { kind: 'people' as const, word: peopleHit![1], at: peopleAt }
  }, [value, caret])

  /* The names are in hand; the emoji are a megabyte, so they arrive when
     somebody first types a colon rather than with the page. */
  useEffect(() => {
    if (suggesting?.kind === 'emoji' && !emoji) void loadEmoji().then(setEmoji)
  }, [suggesting?.kind, emoji])

  const picks = useMemo<Pick[]>(() => {
    if (!suggesting) return []

    if (suggesting.kind === 'people') {
      const want = suggesting.word.toLowerCase()
      return (members ?? [])
        .filter((one) =>
          one.username.toLowerCase().startsWith(want)
          || (one.display_name ?? '').toLowerCase().includes(want))
        .slice(0, 24)
        .map((one) => ({
          key: one.id,
          take: `@${one.username} `,
          label: one.display_name || one.username,
          hint: `@${one.username}`,
          lead: <Avatar src={avatarOf(one)} personId={one.id} name={one.display_name ?? 'K'} size="xs" />,
        }))
    }

    const want = suggesting.word.toLowerCase()
    if (!emoji) return []
    const out: Pick[] = []
    for (const group of emoji) {
      for (const one of group.emojis) {
        if (!one.slug.includes(want) && !one.name.includes(want)) continue
        out.push({
          key: one.slug,
          take: `${one.emoji} `,
          label: one.name,
          lead: <span className="text-[17px] leading-none">{one.emoji}</span>,
        })
        if (out.length >= 24) return out
      }
    }
    return out
  }, [suggesting, members, emoji])

  useEffect(() => { setLit(0) }, [suggesting?.kind, suggesting?.word])

  const take = (one: Pick) => {
    if (!suggesting) return
    const next = value.slice(0, suggesting.at) + one.take + value.slice(caret.from)
    const at = suggesting.at + one.take.length
    setCaret({ from: at, to: at })
    onChange(next)
  }

  const put = (mark: Mark) => {
    if (caret.from === caret.to) return
    const next = wrap(value, caret.from, caret.to, mark)
    setCaret({ from: next.from, to: next.to })
    onChange(next.text)
  }

  const addEmoji = (glyph: string) => {
    const at = caret.from
    const next = value.slice(0, at) + glyph + value.slice(caret.to)
    setCaret({ from: at + glyph.length, to: at + glyph.length })
    onChange(next)
  }

  const left = 2000 - value.length
  const ready = Boolean(value.trim()) && !sending

  return (
    <>
      {bar && createPortal(
        <div
          style={{ left: bar.left, top: bar.top }}
          className="fixed z-[95] flex items-center gap-0.5 rounded-xl border border-ink-line bg-ink-card p-1 shadow-pop"
        >
          {marks.map((one) => (
            <button
              key={one.mark}
              type="button"
              /* The selection has to survive the press, or bold then
                 italic land on two different sets of words. */
              onMouseDown={(e) => { e.preventDefault(); put(one.mark) }}
              title={one.label}
              aria-label={one.label}
              className="grid h-7 w-7 place-items-center rounded-lg text-xs text-white/60 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <Glyph icon={one.icon} />
            </button>
          ))}
        </div>,
        document.body,
      )}

      {/* Above the box, inside the panel: the two lists share one shape, so
          there is one thing to learn rather than two that nearly match. */}
      {suggesting && picks.length > 0 && (
        <div className="animate-pop-in shrink-0 border-t border-ink-line">
          <p className="px-3.5 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">
            {suggesting.kind === 'people' ? 'People' : 'Emoji'}
          </p>
          <div className="max-h-40 overflow-y-auto overflow-x-hidden pb-1 kob-scroll">
            {picks.map((one, at) => (
              <button
                key={one.key}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); take(one) }}
                onMouseEnter={() => setLit(at)}
                className={cn(
                  'flex w-full items-center gap-3 px-3.5 py-2 text-left text-[13px] transition-colors',
                  at === lit ? 'bg-white/10 text-white' : 'text-muted hover:bg-white/5',
                )}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center">{one.lead}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{one.label}</span>
                {one.hint && <span className="shrink-0 text-[11px] text-muted">{one.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {card === 'emoji' && (
        <EmojiCard onPick={addEmoji} onClose={() => setCard(null)} />
      )}

      {card === 'gif' && (
        <GifCard
          onPick={(url) => { setCard(null); onSendText?.(url) }}
          onClose={() => setCard(null)}
        />
      )}

      <div className="shrink-0 border-t border-ink-line p-2">
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border-2 bg-ink/40 py-2 pr-2 transition-colors',
            here ? 'border-brand/60' : 'border-ink-line',
          )}
          onFocus={() => setHere(true)}
          onBlur={() => setHere(false)}
        >
          <WritingBox
            id={id}
            value={value}
            onChange={onChange}
            onCaret={setCaret}
            want={caret}
            onSend={onSend}
            people={people}
            me={me}
            placeholder="Send a message"
            onKey={(e) => {
              if (!suggesting || !picks.length) return false
              if (e.key === 'ArrowDown') {
                e.preventDefault(); setLit((n) => (n + 1) % picks.length); return true
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault(); setLit((n) => (n - 1 + picks.length) % picks.length); return true
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault(); take(picks[lit]); return true
              }
              if (e.key === 'Escape') {
                /* The list closes and the words are left alone: somebody
                   who meant to type a colon has typed one. */
                e.preventDefault(); setCaret({ from: caret.from, to: caret.from }); setLit(0)
                return true
              }
              return false
            }}
          />

          {left <= COUNT_FROM && (
            <span className={cn(
              'shrink-0 text-[12px] font-bold tabular-nums',
              left <= 20 ? 'text-danger' : 'text-muted',
            )}>
              {left}
            </span>
          )}

          {/*
            * Both cards press on mousedown with the default prevented: the
            * box has to keep the caret, or opening a card moves where the
            * next emoji lands. A button is lit while its own card is open,
            * so a button and its card read as the same thing.
            */}
          {gifs && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setCard((on) => (on === 'gif' ? null : 'gif')) }}
              title="GIFs"
              aria-label="GIFs"
              aria-expanded={card === 'gif'}
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[15px] transition-colors',
                card === 'gif' ? 'bg-white/10 text-brand-bright' : 'text-muted hover:bg-white/10 hover:text-white',
              )}
            >
              <Glyph icon={faFilm} />
            </button>
          )}

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setCard((on) => (on === 'emoji' ? null : 'emoji')) }}
            title="Emoji"
            aria-label="Emoji"
            aria-expanded={card === 'emoji'}
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors',
              card === 'emoji' ? 'bg-white/10' : 'hover:bg-white/10',
            )}
          >
            {/* Kobblon's own face rather than a Font Awesome smiley: it is
                the one already used for reacting, and the two mean the
                same thing to the same person. Drawn as Staw drew it, with
                no tone over it - the lit background is what says the card
                is open. Yellow rather than the colour of the row around
                it, which is how the reaction button already draws this
                same face - the drawing itself is a silhouette and takes
                whichever colour it is given. */}
            <Icon name="reaction-smile" tone={FACE_YELLOW} className="h-5 w-5" />
          </button>

          {/*
            * Not `disabled`. A disabled button fires no mouse events, so it
            * would be the one state in the panel where hovering says
            * nothing at all about what the button is for.
            */}
          <button
            type="submit"
            aria-label="Send"
            aria-disabled={!ready}
            className={cn(
              'relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg transition-colors',
              ready ? 'bg-brand text-white' : 'bg-ink-hover text-white/45',
            )}
          >
            {ready && (
              <span
                aria-hidden="true"
                className="absolute -inset-3 animate-[spin_12s_linear_infinite] opacity-[0.18]"
                style={{
                  background:
                    'repeating-conic-gradient(from 0deg, #fff 0deg 3deg, transparent 3deg 18deg)',
                }}
              />
            )}
            <Glyph icon={faPaperPlane} className="relative text-[13px]" />
          </button>
        </div>
      </div>
    </>
  )
}
