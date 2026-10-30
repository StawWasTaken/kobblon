import { useEffect, useMemo, useRef, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

export type EmojiGroup = {
  name: string
  slug: string
  emojis: { emoji: string; name: string; slug: string; emoji_version: string }[]
}

/*
 * The emoji list, loaded once for the whole tab.
 *
 * It is a few hundred kilobytes of names, so it is imported when somebody
 * first wants it rather than carried in the bundle - and held afterwards,
 * because the card and the `:` suggestions both read it and loading it
 * twice would be a second copy of the same megabyte.
 *
 * One rule carried over from the applications' card and worth keeping: the
 * list is ahead of the drawings. Anything newer than Unicode 15 is left
 * out, because an emoji the machine cannot draw is a blank square somebody
 * presses and sends.
 */
let held: EmojiGroup[] | null = null
let loading: Promise<EmojiGroup[]> | null = null

export function loadEmoji(): Promise<EmojiGroup[]> {
  if (held) return Promise.resolve(held)
  if (loading) return loading
  loading = import('unicode-emoji-json/data-by-group.json')
    .then((all) => {
      const rows = Object.values(all.default ?? all) as EmojiGroup[]
      held = rows.map((group) => ({
        ...group,
        emojis: group.emojis.filter((one) => Number(one.emoji_version) <= 15),
      }))
      return held
    })
    .catch(() => {
      held = []
      return held
    })
  return loading
}

/** What is already in hand, for a list that cannot wait for a promise. */
export const emojiHeld = () => held

/**
 * The emoji card.
 *
 * The shape is the applications' card, class for class where a class means
 * the same thing on both sides: the card is part of the panel rather than
 * something floating over it, it has its own search and its own strip of
 * categories, and the cells are a grid that fills whatever width the
 * window is.
 *
 * The one deliberate difference is what is drawn in the cells. Theirs
 * draws Twemoji pictures; ours writes the character and lets the Twemoji
 * *font* draw it, which the whole website already loads for exactly this
 * reason. Same drawings, no element inserted into anybody's text.
 *
 * Everything here presses on `mousedown` with the default prevented. The
 * box has to keep the caret: an emoji inserted after the box has lost it
 * lands at the start of the message, or nowhere.
 */
export function EmojiCard({ onPick, onClose }: {
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  const [groups, setGroups] = useState<EmojiGroup[] | null>(emojiHeld())
  const [term, setTerm] = useState('')
  const [only, setOnly] = useState<string | null>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    void loadEmoji().then((all) => { if (live) setGroups(all) })
    return () => { live = false }
  }, [])

  const shown = useMemo(() => {
    if (!groups) return []
    const want = term.trim().toLowerCase()
    return groups
      .filter((group) => !only || group.slug === only)
      .map((group) => ({
        ...group,
        emojis: want ? group.emojis.filter((one) => one.name.includes(want)) : group.emojis,
      }))
      .filter((group) => group.emojis.length)
  }, [groups, term, only])

  /* A category chosen scrolls back to the top, or it looks like nothing
     happened when the strip is pressed while the list is halfway down. */
  useEffect(() => { list.current?.scrollTo({ top: 0 }) }, [only, term])

  return (
    <div className="animate-pop-in flex h-[19rem] shrink-0 flex-col border-t border-ink-line">
      <div className="px-2.5 pb-1.5 pt-2">
        <div className="flex items-center gap-2 rounded-lg border border-ink-line bg-ink/40 px-2.5 py-1.5">
          <Glyph icon={faMagnifyingGlass} className="text-[11px] text-muted" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            /* Every key is stopped here: the dock listens for keys of its
               own, and typing "k" into a search field should not trip one. */
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Search emoji"
            aria-label="Search emoji"
            className="min-w-0 flex-1 bg-transparent text-[13px] placeholder:text-muted focus:outline-none"
          />
        </div>
      </div>

      {groups && groups.length > 0 && (
        <div className="flex gap-1 overflow-x-auto px-2.5 pb-1.5 kob-scroll">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOnly(null)}
            className={cn(
              'shrink-0 rounded-md px-2 py-1 text-[11px] font-extrabold transition-colors',
              only === null ? 'bg-brand/25 text-brand-bright' : 'text-muted hover:bg-white/5',
            )}
          >
            All
          </button>
          {groups.map((group) => (
            <button
              key={group.slug}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOnly(group.slug)}
              className={cn(
                'shrink-0 rounded-md px-2 py-1 text-[11px] font-extrabold transition-colors',
                only === group.slug ? 'bg-brand/25 text-brand-bright' : 'text-muted hover:bg-white/5',
              )}
            >
              {group.name}
            </button>
          ))}
        </div>
      )}

      <div ref={list} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-2 kob-scroll">
        {!groups && <p className="p-4 text-center text-[12px] text-muted">Loading…</p>}
        {groups && !shown.length && (
          <p className="p-4 text-center text-[12px] text-muted">Nothing like that.</p>
        )}
        {shown.map((group) => (
          <section key={group.slug} className="mb-1.5">
            <p className="px-0.5 pb-1 pt-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              {group.name}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1">
              {group.emojis.map((one) => (
                <button
                  key={one.slug}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPick(one.emoji)}
                  title={one.name}
                  className="grid h-10 place-items-center rounded-lg text-[1.35rem] leading-none transition-colors hover:bg-white/10"
                >
                  {one.emoji}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
