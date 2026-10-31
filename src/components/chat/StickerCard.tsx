import { useMemo, useRef, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { pictureUrl, stickersToOffer, useNamedPictures } from '@/lib/stickers'
import type { NamedPicture } from '@/lib/stickers'
import { cn } from '@/lib/cn'

/** The word for a pack, for the strip across the top. Unknown packs use their own name. */
const PACK_WORDS: Record<string, string> = { plunk: 'Plunk' }
const packWord = (pack: string) =>
  PACK_WORDS[pack] ?? pack.replace(/(^|-)([a-z])/g, (_, lead, ch: string) => (lead ? ' ' : '') + ch.toUpperCase())

/**
 * The sticker card.
 *
 * The GIF card's furniture, because a sticker is the same kind of thing as
 * a GIF to the person sending it: picking one sends it, there is nothing to
 * type beside it, and the card is part of the panel rather than something
 * floating over it. The one difference is the grid - stickers are square
 * and all the same size, so three even columns rather than GIFs' two
 * ragged ones.
 *
 * The small WebP is what the cells draw. Nine 512px PNGs is 1.4MB to show
 * a grid of nine; the same nine at 256 is 72KB, and the big one is what a
 * sent sticker is drawn from. The applications' round 57 asked for the
 * derivative and this is it.
 *
 * Nothing here knows a sticker's name or path. The list is a table, so
 * Staw adding a tenth Plunk - or a second set - is one row and no build on
 * either side.
 */
export function StickerCard({ onPick, onClose }: {
  onPick: (one: NamedPicture) => void
  onClose: () => void
}) {
  const list = useNamedPictures()
  const [term, setTerm] = useState('')
  const [pack, setPack] = useState<string | null>(null)
  const grid = useRef<HTMLDivElement>(null)

  const all = useMemo(() => stickersToOffer(list), [list])
  const packs = useMemo(() => [...new Set(all.map((one) => one.pack))], [all])

  const shown = useMemo(() => {
    const want = term.trim().toLowerCase()
    return all.filter((one) => (
      (!pack || one.pack === pack)
      && (!want || one.label.toLowerCase().includes(want) || one.name.includes(want))
    ))
  }, [all, pack, term])

  return (
    /* Capped rather than fixed, for the same reason the cells are: in the
       dock the nine fill it and it is the GIF card's height, and under a
       wall they fit in two rows and a fixed nineteen rems was half a panel
       of nothing. */
    <div className="animate-pop-in flex max-h-[19rem] shrink-0 flex-col border-t border-ink-line">
      <div className="px-2.5 pb-1.5 pt-2">
        <div className="flex items-center gap-2 rounded-lg border border-ink-line bg-ink/40 px-2.5 py-1.5">
          <Glyph icon={faMagnifyingGlass} className="text-[11px] text-muted" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Search stickers"
            aria-label="Search stickers"
            className="min-w-0 flex-1 bg-transparent text-[13px] placeholder:text-muted focus:outline-none"
          />
        </div>
      </div>

      {/* The strip is drawn only when there is more than one set: one
          button that is the only answer is furniture pretending to be a
          choice. */}
      {packs.length > 1 && (
        <div className="flex gap-1 overflow-x-auto px-2.5 pb-1.5 kob-scroll">
          {[null, ...packs].map((one) => (
            <button
              key={one ?? 'all'}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setPack(one) }}
              className={cn(
                'shrink-0 rounded-md px-2 py-1 text-[11px] font-extrabold transition-colors',
                pack === one ? 'bg-brand/25 text-brand-bright' : 'text-muted hover:bg-white/5',
              )}
            >
              {one ? packWord(one) : 'All'}
            </button>
          ))}
        </div>
      )}

      <div ref={grid} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-2 kob-scroll">
        {!list && <p className="p-4 text-center text-[12px] text-muted">Looking…</p>}

        {list && !all.length && (
          <p className="p-4 text-center text-[12px] text-muted">No stickers yet.</p>
        )}

        {list && !!all.length && !shown.length && (
          <p className="p-4 text-center text-[12px] text-muted">Nothing like that.</p>
        )}

        {!!shown.length && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
            {/* Cells of a size rather than a count of columns: the same
                card is mounted in the chat dock, which is three hundred
                pixels wide, and under a community wall, which is seven
                hundred. A fixed three columns made each Plunk the size of
                a postcard there. */}
            {shown.map((one) => (
              <button
                key={one.name}
                type="button"
                /* The box has to keep the caret, same as the other two
                   cards: a press that moves the selection sends from a
                   different place than the person was writing. */
                onMouseDown={(e) => { e.preventDefault(); onPick(one) }}
                title={one.label}
                aria-label={one.label}
                className="grid aspect-square place-items-center rounded-lg border border-transparent p-1 transition-colors hover:border-brand-bright hover:bg-white/5"
              >
                <img
                  src={pictureUrl(one.small ?? one.picture)}
                  alt={one.label}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
