import { useEffect, useRef, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { searchGifs } from '@/lib/gifs'
import type { Gif } from '@/lib/gifs'
import { cn } from '@/lib/cn'

/** The words down the side, which is what a GIF card is instead of folders. */
const MOODS = ['Trending', 'lol', 'yes', 'no', 'thanks', 'oops', 'hello', 'nice', 'oh no']

/**
 * The GIF card.
 *
 * Two columns rather than a square grid, because GIFs are every shape and
 * forcing them square crops the joke out of half of them. Each picture
 * carries the proportions it reported, so nothing jumps as they load.
 *
 * Nothing is fetched by the page from Klipy directly: the key would have
 * to be in the bundle for that, and a key in a bundle is a key everybody
 * has. The `gifs` function holds it and this asks the function.
 *
 * Picking one sends it. A GIF is the whole message - that is the rule both
 * sides already carry in `gifIn` - so there is nothing to type beside it
 * and a card that only put an address in the box would be asking somebody
 * to press send on a line of text they cannot read.
 */
export function GifCard({ onPick, onClose }: {
  onPick: (url: string) => void
  onClose: () => void
}) {
  const [term, setTerm] = useState('')
  const [mood, setMood] = useState('Trending')
  const [rows, setRows] = useState<Gif[] | null>(null)
  const [failed, setFailed] = useState(false)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    setRows(null)
    setFailed(false)
    const want = term.trim() || (mood === 'Trending' ? '' : mood)
    /*
     * A beat before asking, so typing "thanks" is one search rather than
     * six. Cancelled on the way out, and the answer is dropped if this
     * card has moved on - the trap this project keeps finding is a value
     * captured before the thing that decides it exists.
     */
    const timer = window.setTimeout(() => {
      searchGifs(want)
        .then((found) => { if (live) setRows(found) })
        .catch(() => { if (live) { setRows([]); setFailed(true) } })
    }, term ? 280 : 0)

    return () => { live = false; window.clearTimeout(timer) }
  }, [term, mood])

  useEffect(() => { list.current?.scrollTo({ top: 0 }) }, [term, mood])

  return (
    <div className="animate-pop-in flex h-[19rem] shrink-0 flex-col border-t border-ink-line">
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
            placeholder="Search GIFs"
            aria-label="Search GIFs"
            className="min-w-0 flex-1 bg-transparent text-[13px] placeholder:text-muted focus:outline-none"
          />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto px-2.5 pb-1.5 kob-scroll">
        {MOODS.map((word) => (
          <button
            key={word}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setTerm(''); setMood(word) }}
            className={cn(
              'shrink-0 rounded-md px-2 py-1 text-[11px] font-extrabold transition-colors',
              !term && mood === word ? 'bg-brand/25 text-brand-bright' : 'text-muted hover:bg-white/5',
            )}
          >
            {word}
          </button>
        ))}
      </div>

      <div ref={list} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-2 kob-scroll">
        {!rows && <p className="p-4 text-center text-[12px] text-muted">Looking…</p>}
        {rows && !rows.length && (
          <p className="p-4 text-center text-[12px] text-muted">
            {failed ? 'GIFs are not answering right now.' : 'Nothing like that.'}
          </p>
        )}

        {!!rows?.length && (
          <div className="columns-2 gap-1.5 [column-fill:_balance]">
            {rows.map((one) => (
              <button
                key={one.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onPick(one.url) }}
                className="mb-1.5 block w-full break-inside-avoid overflow-hidden rounded-lg border border-transparent transition-colors hover:border-brand-bright"
                title="Send this"
              >
                <img
                  src={one.url}
                  alt=""
                  loading="lazy"
                  style={{ aspectRatio: `${one.width} / ${one.height}` }}
                  className="w-full rounded-lg bg-ink-hover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
