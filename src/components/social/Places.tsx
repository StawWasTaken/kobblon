import { faTags, faShapes, faRankingStar } from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { useAsync } from '@/hooks/useAsync'
import { personPlaces } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { OwnerBoard } from '@/types/db'

/**
 * What somebody has done, and where that puts them.
 *
 * Staw: "these infos will also go onto the users profiles idk where but
 * somewhere". Here is the somewhere - under the profile's own numbers,
 * reading the same function the Leaderboards page does, so a profile and a
 * board can never disagree about who is seventh.
 *
 * Three of the six boards, not all six. The money ones are left off a
 * profile on purpose: a balance on a leaderboard is fifty accounts somebody
 * went looking for, and the same number on a profile is every account's
 * wallet on the page beside their face. These three are about what they
 * made, which is what a profile is for.
 */
const shown: { board: OwnerBoard; label: string; unit: string; icon: IconDefinition }[] = [
  { board: 'visits', label: 'World visits', unit: 'visits', icon: worldIcon },
  { board: 'sales', label: 'Catalog sales', unit: 'sold', icon: faTags },
  { board: 'assets', label: 'Assets made', unit: 'made', icon: faShapes },
]

export function Places({ who, boards, className }: {
  who: string
  /**
   * Which of the three to draw, in the order given. Left out, all three.
   *
   * Staw split them across the profile's tabs: "the catalog sales
   * statistics goes into the shop tab". So the same read serves two
   * places - one call per tab, both off `person_places`, so a profile
   * cannot disagree with itself about how much somebody has sold.
   */
  boards?: OwnerBoard[]
  className?: string
}) {
  const places = useAsync(() => personPlaces(who), [who])
  const rows = places.data ?? []

  const wanted = boards
    ? boards.map((board) => shown.find((one) => one.board === board)).filter(Boolean) as typeof shown
    : shown

  /* Nothing made, nothing to say. An empty row of zeroes on somebody's
     profile reads as a scoreboard of their failures. */
  if (!rows.some((one) => wanted.some((w) => w.board === one.board) && one.amount > 0)) return null

  return (
    <div
      className={cn(
        'grid gap-2',
        wanted.length >= 3 ? 'sm:grid-cols-3' : wanted.length === 2 ? 'sm:grid-cols-2' : 'sm:max-w-xs',
        className,
      )}
    >
      {wanted.map((one) => {
        const row = rows.find((r) => r.board === one.board)
        if (!row?.amount) return null
        const top = row.place !== null && row.place <= 50

        return (
          <Link
            key={one.board}
            to="/leaderboards"
            className="flex items-center gap-3 rounded-2xl border border-ink-line bg-ink-card px-4 py-3 transition-colors hover:bg-ink-hover"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-raised text-brand-bright">
              <Glyph icon={one.icon} />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg font-extrabold tabular-nums leading-none">
                {formatCount(row.amount)}
              </span>
              <span className="block truncate text-xs text-muted">
                {one.label}
                {top && (
                  <span className="ml-1.5 font-bold text-space-bright">
                    <Glyph icon={faRankingStar} className="mr-1 text-[10px]" />
                    {row.place}
                    {row.place === 1 ? 'st' : row.place === 2 ? 'nd' : row.place === 3 ? 'rd' : 'th'}
                  </span>
                )}
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
