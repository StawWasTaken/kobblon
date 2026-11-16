import { Link } from 'react-router-dom'
import { NameMarks } from '@/components/brand/Verified'
import { profileLink } from '@/lib/links'
import { cn } from '@/lib/cn'
import type { World } from '@/types/db'

/**
 * Who a World is by: the handle, and whatever that person wears.
 *
 * Staw: every creation says "by [username] [badges]". A display name is a
 * label somebody can change twice a day and two people can share; the
 * handle is theirs, is unique, and is the thing you would type to find
 * them. The marks come from `name_marks` as they do everywhere else - a
 * mark is a claim about a person and this page does not get to decide one.
 *
 * One component rather than the three copies this was: the chart, the card
 * and the World's own page each wrote their own byline and two of them had
 * drifted onto the display name.
 */
export function WorldBy({ world, className, marks = true }: {
  world: Pick<World, 'owner_id' | 'creator_name' | 'creator_username'>
  className?: string
  /** Off where the line is too small to hold them, like a dense shelf. */
  marks?: boolean
}) {
  const handle = world.creator_username
  /*
   * A World with no handle on it is one nobody has published since 0348 -
   * or Kobblon's own, which was inserted as a piece of text and not as an
   * account. Its name is shown and it links nowhere, which is honest:
   * there is no profile to go to.
   */
  const name = handle ? `@${handle}` : (world.creator_name ?? 'Kobblon')

  const inside = (
    <>
      <span className="truncate">By {name}</span>
      {marks && <NameMarks id={world.owner_id} username={handle} className="text-tiny" />}
    </>
  )

  if (!handle) {
    return <span className={cn('flex items-center gap-1.5', className)}>{inside}</span>
  }

  return (
    <Link
      to={profileLink({ username: handle })}
      className={cn('flex items-center gap-1.5 transition-colors hover:text-link', className)}
    >
      {inside}
    </Link>
  )
}
