import { useEffect, useMemo, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

type Group = {
  name: string
  slug: string
  emojis: { emoji: string; name: string; slug: string; emoji_version: string }[]
}

/*
 * The emoji card.
 *
 * The list is `unicode-emoji-json`, loaded only when somebody opens the
 * card - it is a few hundred kilobytes of names, and a chat dock that
 * carries it in the first bundle makes every page on the platform slower
 * for a card most people never open.
 *
 * The glyphs are the ones the computer already has, rather than pictures
 * fetched from somewhere. That is a real difference from the in-World card
 * the applications built, which draws Twemoji: theirs is the same on every
 * machine, ours is whatever the machine has. It is the right trade here -
 * the website is not going to pull a picture off a third party for every
 * smiley in a sentence - and it is written in the round so the two sides
 * know they differ on purpose rather than by accident.
 *
 * One rule carried over from their card and worth keeping: the list is
 * ahead of the drawings. Anything newer than Unicode 15 is left out,
 * because an emoji the machine cannot draw is a blank square somebody
 * presses and sends.
 */
export function EmojiCard({ onPick, onClose }: {
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [term, setTerm] = useState('')

  useEffect(() => {
    let live = true
    import('unicode-emoji-json/data-by-group.json')
      .then((all) => {
        if (!live) return
        const rows = Object.values(all.default ?? all) as Group[]
        setGroups(rows.map((group) => ({
          ...group,
          emojis: group.emojis.filter((one) => Number(one.emoji_version) <= 15),
        })))
      })
      .catch(() => live && setGroups([]))
    return () => { live = false }
  }, [])

  const shown = useMemo(() => {
    if (!groups) return []
    const want = term.trim().toLowerCase()
    if (!want) return groups
    return groups
      .map((group) => ({
        ...group,
        emojis: group.emojis.filter((one) => one.name.includes(want)),
      }))
      .filter((group) => group.emojis.length)
  }, [groups, term])

  return (
    <div className="absolute bottom-12 right-2 z-20 w-72 overflow-hidden rounded-2xl border border-ink-line bg-ink-card shadow-pop">
      <div className="flex items-center gap-2 border-b border-ink-line px-3 py-2">
        <Glyph icon={faMagnifyingGlass} className="text-[11px] text-muted" />
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
          placeholder="Search emoji"
          aria-label="Search emoji"
          className="h-7 min-w-0 flex-1 bg-transparent text-sm placeholder:text-white/30 focus:outline-none"
        />
      </div>

      <div className="max-h-64 overflow-y-auto p-2 kob-scroll">
        {!groups && <p className="p-4 text-center text-xs text-muted">Loading…</p>}
        {groups && !shown.length && (
          <p className="p-4 text-center text-xs text-muted">Nothing like that.</p>
        )}
        {shown.map((group) => (
          <section key={group.slug} className="mb-2">
            <p className="px-1 pb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/35">
              {group.name}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {group.emojis.map((one) => (
                <button
                  key={one.slug}
                  type="button"
                  onClick={() => onPick(one.emoji)}
                  title={one.name}
                  className={cn(
                    'grid h-8 place-items-center rounded-lg text-lg leading-none',
                    'transition-colors hover:bg-ink-hover',
                  )}
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
