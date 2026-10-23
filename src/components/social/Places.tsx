import { faDoorOpen, faTags, faCubes, faRankingStar } from '@fortawesome/free-solid-svg-icons'
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
  { board: 'visits', label: 'World visits', unit: 'visits', icon: faDoorOpen },
  { board: 'sales', label: 'Catalog sales', unit: 'sold', icon: faTags },
  { board: 'assets', label: 'Assets made', unit: 'made', icon: faCubes },
]

export function Places({ who, className }: { who: string; className?: string }) {
  const places = useAsync(() => personPlaces(who), [who])
  const rows = places.data ?? []

  /* Nothing made, nothing to say. An empty row of zeroes on somebody's
     profile reads as a scoreboard of their failures. */
  if (!rows.some((one) => one.amount > 0)) return null

  return (
    <div className={cn('grid gap-2 sm:grid-cols-3', className)}>
      {shown.map((one) => {
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
