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
export function Recommended({ howMany = 12, title = 'Recommended', className }: {
  howMany?: number
  title?: string
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
        * As many as fit a whole row, and never part of one. `auto-fill`
        * adds columns rather than stretching the ones there are, so the
        * cards stay the size they were drawn at whatever the panel is
        * doing around them.
        */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 [&>*]:max-w-[11rem]">
        {picked.loading
          ? Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))
          : picked.data!.map((item) => <Card key={item.id} item={item} />)}
      </div>
    </section>
  )
}

function Card({ item }: { item: AvatarItem }) {
  const picture = cardFor(item)
  const to = `/catalog/${avatarTag(item.kind, item.content_id)}`

  return (
    <div className="relative">
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
