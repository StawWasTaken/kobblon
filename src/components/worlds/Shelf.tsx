import { Picture } from '@/components/brand/Picture'
import { Children } from 'react'
import { useRail } from '@/hooks/useRail'
import { Link } from 'react-router-dom'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { worldLink } from '@/lib/links'
import { WorldStats } from '@/components/worlds/WorldStats'
import { cn } from '@/lib/cn'
import type { World } from '@/types/db'

/**
 * A shelf of Worlds that slides sideways.
 *
 * Home had one of these and Discover had none, so the two pages about the
 * same Worlds looked like two products. It lives here now and both import
 * it, which is the rule for anything shared: built once, used twice.
 *
 * The heading is the link. A title with a chevron after it reads as "there
 * is more of this through here" without a second control saying so, and a
 * row that has no more to show simply does not get one.
 */
export function Shelf({ title, note, more, children, empty, className }: {
  title: string
  note?: string
  more?: { to: string; label?: string } | { onClick: () => void; label?: string }
  children: React.ReactNode
  /*
   * What stands in for the shelf when it has nothing on it.
   *
   * Without this a quiet shelf drew its heading, then eighty pixels of
   * nothing, and then whatever the page put underneath saying the same
   * thing - a title over a hole. Home carried its own copy of this for
   * months while Discover had none; it belongs on the shelf both pages
   * use.
   */
  empty?: React.ReactNode
  className?: string
}) {
  const { track, can, nudge, measure, scrollable } = useRail(children)
  const bare = !Children.toArray(children).length

  const head = (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-display text-xl font-extrabold sm:text-2xl">{title}</span>
      {more && <Glyph icon={faChevronRight} className="text-xs text-muted" />}
    </span>
  )

  return (
    <section className={cn('mb-8', className)}>
      <div className="mb-3 flex items-end gap-3">
        <div className="min-w-0">
          {note && (
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{note}</p>
          )}
          {!more ? head : 'to' in more ? (
            <Link to={more.to} className="block hover:text-link">{head}</Link>
          ) : (
            <button type="button" onClick={more.onClick} className="block hover:text-link">
              {head}
            </button>
          )}
        </div>

        <div className={cn('ml-auto flex shrink-0 items-center gap-1', bare && 'hidden')}>
          {more && 'to' in more && (
            <Link to={more.to} className="mr-2 hidden text-xs font-bold text-link hover:underline sm:inline">
              {more.label ?? 'Show all'}
            </Link>
          )}
          {more && 'onClick' in more && (
            <button
              type="button"
              onClick={more.onClick}
              className="mr-2 hidden text-xs font-bold text-link hover:underline sm:inline"
            >
              {more.label ?? 'Show all'}
            </button>
          )}
          {/* Only where there is somewhere to go. A rail that fits on the
              screen has nothing to scroll, and two buttons over it that move
              nothing are a control lying about what the page does. */}
          {scrollable && ([-1, 1] as const).map((way) => (
            <button
              key={way}
              type="button"
              onClick={() => nudge(way)}
              disabled={way === -1 ? !can.left : !can.right}
              aria-label={way === -1 ? `Scroll ${title} left` : `Scroll ${title} right`}
              className="hidden h-8 w-8 place-items-center rounded-lg border-2 border-b-4 border-ink-line bg-ink-card text-muted transition-colors hover:bg-ink-hover hover:text-white disabled:pointer-events-none disabled:opacity-35 sm:grid"
            >
              <Glyph icon={way === -1 ? faChevronLeft : faChevronRight} className="text-xs" />
            </button>
          ))}
        </div>
      </div>

      {bare && empty ? empty : (
        <div
          ref={track}
          onScroll={measure}
          className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-4 sm:px-0 kob-scroll"
        >
          {children}
        </div>
      )}
    </section>
  )
}


function Stats({ world }: { world: World }) {
  return <WorldStats world={world} className="mt-0.5" />
}

/**
 * One World on a shelf: the square mark it chose to be known by.
 *
 * Square rather than wide because the mark is square - a cover cropped to
 * 16/9 is the picture of the World, and this is its badge. Staw asked for
 * the emblems and the emblems are what a dense shelf wants: eight of them
 * fit where four covers did, and a shelf is for scanning.
 */
export function WorldTile({ world }: { world: World }) {
  const art = world.emblem_url ?? world.cover_url
  return (
    <article className="w-[7.5rem] shrink-0 sm:w-36">
      <Link
        to={worldLink(world)}
        className="block aspect-square overflow-hidden rounded-xl border-2 border-ink-line bg-media"
      >
        <Picture
          src={art}
          alt={world.name}
          className="h-full w-full"
          pictureClassName="transition-transform duration-300 hover:scale-[1.04]"
        />
      </Link>
      <p className="mt-1.5 line-clamp-2 text-sm font-bold leading-tight">{world.name}</p>
      <Stats world={world} />
    </article>
  )
}

/**
 * A World given the room to be looked at rather than scanned: the cover,
 * with its mark and its name over the bottom of it.
 *
 * The top of a page that is otherwise a wall of small squares. Four of them
 * across a desktop, one and a bit on a phone so it is plainly a row.
 */
export function WorldFeature({ world }: { world: World }) {
  return (
    <Link
      to={worldLink(world)}
      className="group relative block aspect-[16/9] w-72 shrink-0 overflow-hidden rounded-xl border-2 border-ink-line bg-media sm:w-[22rem]"
    >
      <Picture
        src={world.cover_url}
        alt={world.name}
        className="h-full w-full"
        pictureClassName="transition-transform duration-500 group-hover:scale-[1.04]"
      />

      <span className="absolute inset-x-0 bottom-0 flex items-end gap-2.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 pt-10">
        {world.emblem_url && (
          <Picture
            src={world.emblem_url}
            alt={world.name}
            className="h-9 w-9 shrink-0 rounded-lg border border-white/20"
          />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-[#fff]">{world.name}</span>
          <WorldStats world={world} className="text-[#fff]/75" />
        </span>
      </span>
    </Link>
  )
}
