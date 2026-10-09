import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faAward, faBagShopping } from '@fortawesome/free-solid-svg-icons'
import { EmptyState } from '@/components/ui/States'
import { Card } from '@/components/ui/Card'
import { formatCount } from '@/lib/format'
import { CurrencyMark } from '@/components/brand/Currency'
import type { WorldBadge, WorldPass } from '@/lib/api'

/**
 * The tile that makes one.
 *
 * A dashed ring with a plus in it, and the name's place taken by what
 * pressing it does. Drawn only for whoever owns the World - an add tile a
 * stranger cannot use is a button that lies - and it goes to the World's
 * own configuration with the card already asked for, rather than dropping
 * somebody on a settings page to find it.
 */
function AddTile({ to, says }: { to: string; says: string }) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-transparent p-4 text-center outline-none transition-colors hover:border-ink-line focus-visible:border-brand"
    >
      <span className="flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-dashed border-ink-line text-2xl text-ink-soft transition-colors group-hover:border-brand group-hover:text-brand">
        <FontAwesomeIcon icon={faPlus} />
      </span>
      <span className="text-sm font-semibold text-ink-soft transition-colors group-hover:text-ink-strong">
        {says}
      </span>
    </Link>
  )
}

/** One badge or pass: its picture, its name, and what it costs if anything. */
function Thing({
  name, picture, under, fallback,
}: {
  name: string
  picture: string | null
  under?: React.ReactNode
  fallback: typeof faAward
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-4 text-center">
      <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-ink-line bg-ink-sunken">
        {picture ? (
          <img src={picture} alt="" className="h-full w-full object-cover" />
        ) : (
          <FontAwesomeIcon icon={fallback} className="text-2xl text-ink-soft" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-strong">{name}</span>
        {under}
      </span>
    </div>
  )
}

const GRID = 'grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6'

/**
 * Both tabs are the same shape, so they are the same component with
 * different words. They were two copies of an empty state before, and the
 * two drifted the moment one of them gained anything.
 */
export function WorldThings({
  kind, badges, passes, mine, worldId,
}: {
  kind: 'badges' | 'shop'
  badges?: WorldBadge[]
  passes?: WorldPass[]
  mine: boolean
  worldId: string
}) {
  const badge = kind === 'badges'
  const made = badge ? (badges ?? []) : (passes ?? [])
  const to = `/create/worlds/${worldId}?make=${badge ? 'badge' : 'pass'}`
  const says = badge ? 'Create a badge' : 'Create a gamepass'

  /*
   * Nothing made and not the owner: the ordinary empty state, which is the
   * true answer for most Worlds and should not look like a failure.
   */
  if (!made.length && !mine) {
    return (
      <Card>
        <EmptyState
          mood="emptyBox"
          title={badge ? 'No badges yet' : 'Nothing for sale'}
          body={badge
            ? 'Badges are things this World hands out for doing something in it. Whoever built it has not made any.'
            : 'Passes and items this World sells would be here. This one sells nothing.'}
        />
      </Card>
    )
  }

  return (
    <Card className="p-3">
      <div className={GRID}>
        {badge
          ? (badges ?? []).map((one) => (
            <Thing
              key={one.id}
              name={one.name}
              picture={one.icon_url}
              fallback={faAward}
              under={
                <span className="mt-0.5 block text-xs text-ink-soft">
                  {formatCount(one.awarded_count)} earned
                </span>
              }
            />
          ))
          : (passes ?? []).map((one) => (
            <Thing
              key={one.id}
              name={one.name}
              picture={one.icon_url}
              fallback={faBagShopping}
              under={
                <span className="mt-0.5 block text-xs font-bold text-ink-soft">
                  {one.price > 0
                    ? <><CurrencyMark className="mr-0.5" />{formatCount(one.price)}</>
                    : 'Free'}
                </span>
              }
            />
          ))}

        {mine && <AddTile to={to} says={says} />}
      </div>
    </Card>
  )
}
