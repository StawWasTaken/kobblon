import { Link } from 'react-router-dom'
import { faShirt, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/States'
import { Price } from '@/components/brand/Currency'
import { FreeCorner } from '@/components/brand/FreeBadge'
import { useAsync } from '@/hooks/useAsync'
import { recommendedAvatarItems, cardFor } from '@/lib/api'
import { avatarTag, avatarKindLabels } from '@/lib/kinds'
import type { AvatarItem } from '@/types/db'
import { cn } from '@/lib/cn'

/**
 * Things to put on, picked for the person looking.
 *
 * Staw asked for this under the avatar and in the Catalog, so it is one
 * component used twice rather than two rows that drift. What decides the
 * order is `recommended_avatar_items` on the server, where the ranking can
 * be read and argued with - an empty socket counts for most, then what they
 * can afford today, then how many people took and starred it, then the kind
 * they keep buying, then a nudge for the last fortnight.
 *
 * It takes no provider and no session: everything comes from one call, and
 * signed out that call quietly answers "popular and new", which is the
 * right answer about somebody we know nothing about.
 *
 * A grid that wraps, and no card half off the edge.
 *
 * It scrolled sideways and bled past the panel so the last card was cut,
 * which was meant to say "there is more of it". Staw: "make sure that
 * nothing in the recommended stuff gets cut". He is right that it reads as
 * a mistake rather than as an invitation - a sliced card looks like a
 * layout that overflowed. It fills the row it has and stops, and `See all`
 * is the thing that says there is more.
 */
export function Recommended({
  howMany = 12, title = 'Recommended', layout = 'grid', className,
}: {
  howMany?: number
  title?: string
  /**
   * `grid` is two rows at the end of a page; `row` is a single line.
   *
   * Staw, of the avatar page: "i only want one line rather than multiple
   * here cuz its ugly". He is right about where each belongs - under a
   * body it is a hint and three rows of hints is a second page, while on
   * an asset page it is the end of the page and a row that trails off is
   * a row with no end to it.
   */
  layout?: 'grid' | 'row'
  className?: string
}) {
  const picked = useAsync(async () => recommendedAvatarItems(howMany), [howMany])

  /*
   * Nothing at all is not an empty state. Somebody who owns everything on a
   * week-old platform is a real case, and a box saying "no recommendations"
   * under their avatar is worse than the row simply not being there.
   */
  if (!picked.loading && !picked.data?.length) return null

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <h2 className="font-display text-base font-extrabold">{title}</h2>
        <Button
          to="/catalog"
          size="sm"
          variant="ghost"
          icon={faArrowRight}
          className="ml-auto"
        >
          See all
        </Button>
      </div>

      {/*
        * Columns that are counted rather than fitted, and a fixed number
        * of rows.
        *
        * `auto-fill` was honest about the panel and useless to look at:
        * the number of cards per row changed with the width, so the row
        * that ended the page was sometimes one card and the line under
        * the avatar sometimes ran past the edge of the column it was in.
        * Staw, of both: "the recommended line in the my avatar page is cut
        * and not lined up with the rest of the elements", and the one on
        * an asset page "is more than 2 lines too".
        *
        * So the count is written down, and anything past the last place is
        * not drawn. Two rows at the end of a page, one line under a body.
        * Nothing is cut, because nothing sits half in a row that exists.
        */}
      <div className={cn(
        'grid gap-3',
        layout === 'row'
          ? 'grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 [&>*:nth-child(n+4)]:hidden sm:[&>*:nth-child(-n+4)]:block xl:[&>*:nth-child(-n+5)]:block'
          : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 [&>*:nth-child(n+7)]:hidden sm:[&>*:nth-child(-n+8)]:block lg:[&>*:nth-child(-n+12)]:block',
      )}>
        {picked.loading
          ? Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))
          : picked.data!.map((item, i) => (
            <Card key={item.id} item={item} nth={i} />
          ))}
      </div>
    </section>
  )
}

function Card({ item, nth }: { item: AvatarItem; nth: number }) {
  const picture = cardFor(item)
  const to = `/catalog/${avatarTag(item.kind, item.content_id)}`

  return (
    /*
     * Dealt in rather than appearing all at once, which is what `row-in`
     * and an inline delay are for. Capped so a long row does not keep
     * somebody waiting for the twelfth card.
     */
    <div
      className="relative animate-row-in"
      style={{ animationDelay: `${Math.min(nth, 8) * 35}ms` }}
    >
      {!item.price && <FreeCorner />}
      <Link
        to={to}
        draggable={false}
        className={cn(
          'flex flex-col overflow-hidden rounded-2xl border border-ink-line bg-ink-card',
          'transition-colors hover:border-brand/60',
        )}
      >
        <span className="block p-2">
          <span className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-media">
            {picture ? (
              <img
                src={picture}
                alt=""
                loading="lazy"
                draggable={false}
                className="h-full w-full select-none object-contain"
              />
            ) : (
              <Glyph icon={faShirt} className="text-2xl text-white/25" />
            )}
          </span>
        </span>
        <span className="block px-3 pb-3 pt-0.5">
          <span className="block truncate text-xs font-bold leading-snug">{item.name}</span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span className="truncate text-[10px] text-muted">
              {avatarKindLabels[item.kind] ?? item.kind}
            </span>
            <Price amount={item.price} className="shrink-0 text-[11px] font-bold" />
          </span>
        </span>
      </Link>
    </div>
  )
}
