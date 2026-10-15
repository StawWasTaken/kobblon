import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faCheck, faXmark, faEllipsis, faChevronLeft, faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { Menu } from '@/components/ui/Menu'
import { Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatCount } from '@/lib/format'
import type { CommunityRelation } from '@/types/db'
import { communityLink } from '@/lib/links'
import { cn } from '@/lib/cn'
import { overlayButton } from '@/lib/overlay'

const PER_PAGE = 12

/**
 * Allies and enemies as a shelf of emblems, a page at a time. The emblem is
 * the thing people recognise, so it is large and square and nothing sits on
 * top of it.
 */
export function AffiliateGrid({
  title, relations, loading, empty, onRemove, onAnswer,
}: {
  title?: string
  relations: CommunityRelation[] | null
  loading: boolean
  empty: string
  onRemove?: (otherId: string) => void
  onAnswer?: (otherId: string, accept: boolean) => void
}) {
  const [page, setPage] = useState(0)

  const all = relations ?? []
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE))
  const current = Math.min(page, pages - 1)
  const shown = all.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE)

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        {title && <h3 className="font-display text-lg font-extrabold">{title}</h3>}

        {all.length > PER_PAGE && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <button
              onClick={() => setPage(Math.max(current - 1, 0))}
              disabled={current === 0}
              aria-label={`Previous page of ${title ?? 'affiliates'}`}
              className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition-colors hover:bg-ink-hover hover:text-white disabled:opacity-30"
            >
              <Glyph icon={faChevronLeft} />
            </button>
            <span className="text-sm font-semibold text-muted">
              Page {current + 1} / {pages}
            </span>
            <button
              onClick={() => setPage(Math.min(current + 1, pages - 1))}
              disabled={current >= pages - 1}
              aria-label={`Next page of ${title ?? 'affiliates'}`}
              className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition-colors hover:bg-ink-hover hover:text-white disabled:opacity-30"
            >
              <Glyph icon={faChevronRight} />
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      )}

      {!loading && !all.length && <p className="text-sm text-muted">{empty}</p>}

      {!!shown.length && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
          {shown.map((other) => (
            <article key={other.id} className="group relative min-w-0">
              {/* Only the side that declared a rivalry can call it off, so a
                  rivalry aimed at us carries no menu. */}
              {onRemove && other.mine !== false && (
                <span className="absolute right-1.5 top-1.5 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Menu
                    label={`Options for ${other.name}`}
                    trigger={
                      <span className={cn('h-7 w-7', overlayButton)}>
                        <Glyph icon={faEllipsis} className="text-xs" />
                      </span>
                    }
                    items={[{ label: 'Remove', onSelect: () => onRemove(other.id), danger: true }]}
                  />
                </span>
              )}

              {/* One link over the whole tile: the picture, the name and the
                  count all go to the same place. */}
              <Tooltip label={`${other.name} · ${formatCount(other.member_count)} members`} side="top">
                <Link to={communityLink(other)} className="block">
                  <span
                    className={cn(
                      'block aspect-square overflow-hidden rounded-xl ring-1 ring-ink-line',
                      other.icon_url ? '' : 'bg-media',
                      'transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:ring-brand/70',
                    )}
                  >
                    {other.icon_url ? (
                      <img
                        src={other.icon_url}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full select-none object-cover"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center font-display text-2xl font-extrabold text-white/70">
                        {other.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>

                  <span className="mt-1.5 block truncate text-[13px] font-bold group-hover:text-link">
                    {other.name}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {formatCount(other.member_count)} Members
                  </span>
                </Link>
              </Tooltip>

              {onAnswer && other.incoming && (
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => onAnswer(other.id, true)}
                    className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-brand text-xs font-bold text-white hover:bg-brand-bright"
                  >
                    <Glyph icon={faCheck} className="text-[10px]" /> Accept
                  </button>
                  <button
                    onClick={() => onAnswer(other.id, false)}
                    aria-label={`Decline ${other.name}`}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-ink-line text-white/50 hover:bg-ink-hover hover:text-white"
                  >
                    <Glyph icon={faXmark} className="text-[10px]" />
                  </button>
                </div>
              )}

              {onAnswer && !other.incoming && (
                <p className="mt-2 text-[11px] font-semibold text-white/40">Waiting on them</p>
              )}

              {!onAnswer && other.incoming && (
                <p className="mt-1 text-[11px] font-semibold text-danger">Declared us</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
