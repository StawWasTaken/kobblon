import { Picture } from '@/components/brand/Picture'
import { Link } from 'react-router-dom'
import { faCompass } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { worldLink } from '@/lib/links'
import { WorldStats } from '@/components/worlds/WorldStats'
import { cn } from '@/lib/cn'
import type { World } from '@/types/db'

/**
 * What is being played, as a board rather than a fourth sliding shelf.
 *
 * Home had three rails of the same trending call sliced into eights, under
 * the headings "Being played right now", "More to look at" and "Still
 * more". The second two are not categories; they are what is left when you
 * cut a list of twenty-four into pieces and have to name the pieces. A
 * page that does that three times reads as one shelf repeated, and the one
 * thing the top of Home has that a shelf does not is room.
 *
 * So the busiest World gets the room - a cover big enough to look at - and
 * the four behind it sit beside it as a ranked list, which is the shape
 * "right now" actually has. Everything further down the ranking goes to
 * Discover, where looking through Worlds is the whole job.
 */


function Cover({ world, className }: { world: World; className?: string }) {
  const art = world.cover_url ?? world.emblem_url
  return (
    <Picture
      src={art}
      alt={world.name}
      className="h-full w-full"
      pictureClassName={cn('transition-transform duration-500', className)}
    />
  )
}

/** How it was rated, and how many are in it now. */
function Stats({ world, light }: { world: World; light?: boolean }) {
  return <WorldStats world={world} size="md" className={light ? 'text-[#fff]/75' : undefined} />
}

/*
 * With nothing behind it the lead keeps roughly the width it would have
 * had beside the list. Letting it take the whole page makes one World fill
 * the screen, which reads as a billboard for the only thing here rather
 * than as the top of a ranking.
 */

/** The busiest World, with the room to be looked at. */
function Lead({ world }: { world: World }) {
  return (
    <Link
      to={worldLink(world)}
      className="group relative block aspect-[16/10] overflow-hidden rounded-2xl border-2 border-ink-line bg-media sm:aspect-[16/9]"
    >
      <Cover world={world} className="group-hover:scale-[1.03]" />

      <span className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-16">
        {world.emblem_url && (
          <Picture
            src={world.emblem_url}
            alt={world.name}
            className="h-12 w-12 shrink-0 rounded-xl border border-white/20"
          />
        )}
        <span className="min-w-0">
          <span className="block truncate font-display text-lg font-extrabold text-[#fff] sm:text-xl">
            {world.name}
          </span>
          <Stats world={world} light />
        </span>
      </span>
    </Link>
  )
}

/** One of the four behind it: the place, the mark, the name, the numbers. */
function Runner({ world, place }: { world: World; place: number }) {
  return (
    <Link
      to={worldLink(world)}
      className="group flex items-center gap-3 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-2 transition-colors hover:border-brand/60 hover:bg-ink-hover"
    >
      <span className="w-4 shrink-0 text-center font-display text-sm font-extrabold text-muted">
        {place}
      </span>
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-ink-line bg-media">
        <Cover world={world} className="group-hover:scale-[1.06]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{world.name}</span>
        <Stats world={world} />
      </span>
    </Link>
  )
}

export function TopNow({ worlds, loading, className }: {
  worlds: World[]
  loading?: boolean
  className?: string
}) {
  if (loading) {
    return (
      <section className={cn('mb-8', className)}>
        <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
          <Skeleton className="aspect-[16/10] rounded-2xl sm:aspect-[16/9]" />
          <div className="hidden flex-col gap-2 sm:flex">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </div>
      </section>
    )
  }

  const [lead, ...behind] = worlds

  return (
    <section className={cn('mb-8', className)}>
      <div className="mb-3 flex items-end gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">On Kobblon</p>
          <h2 className="font-display text-xl font-extrabold sm:text-2xl">Being played right now</h2>
        </div>
        {!!lead && (
          <Link
            to="/discover"
            className="ml-auto shrink-0 text-xs font-bold text-link hover:underline"
          >
            Discover more
          </Link>
        )}
      </div>

      {!lead ? (
        <Card>
          <EmptyState
            mood="construction"
            title="Nothing to suggest yet"
            body="When people publish Worlds, the ones being played land here."
            action={<Button to="/discover" icon={faCompass}>See what there is</Button>}
          />
        </Card>
      ) : (
        <div className={cn('grid gap-4', behind.length > 0 ? 'sm:grid-cols-[1.6fr_1fr]' : 'sm:max-w-3xl')}>
          <Lead world={lead} />
          {behind.length > 0 && (
            <div className="flex flex-col gap-2">
              {behind.slice(0, 4).map((world, i) => (
                <Runner key={world.id} world={world} place={i + 2} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
