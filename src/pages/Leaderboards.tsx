import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  faRankingStar, faCrown, faCoins, faFire, faSackDollar,
  faTags, faShapes, faUsers, faUser,
} from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import type { KobIcon } from '@/components/brand/Icon'
import { Card } from '@/components/ui/Card'
import { Choices } from '@/components/ui/Choices'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { Verified } from '@/components/brand/Verified'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { CurrencyMark } from '@/components/brand/Currency'
import { BrixShell } from '@/components/money/BrixShell'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { leaderboard, personPlaces, worldLeaderboard } from '@/lib/api'
import { currency } from '@/lib/currency'
import { formatCount } from '@/lib/format'
import { profileLink, worldLink } from '@/lib/links'
import { cn } from '@/lib/cn'
import type { BoardRow, BoardSide, OwnerBoard, WorldBoardRow } from '@/types/db'

/**
 * The boards.
 *
 * imCooki3 asked for one of these on the Discord - the richest player on
 * Kobblon - and Staw asked for the rest beside it: "world visits per user,
 * catalog item sales, marketplace assets created, and worlds with the most
 * likes", each with "a switch for players and communities".
 *
 * Eight boards, two shapes. Six of them rank an account, so the row is a
 * player or a Community and the switch says which. Two of them rank Worlds,
 * where the row is a World with its cover and its owner's name - and those
 * two have no Communities side, because a World belongs to a person and
 * nothing in the database lets a Community own one. The page says so rather
 * than drawing an empty board, and that stays true until Worlds can belong
 * to a Community.
 */

type Key = OwnerBoard | 'world_likes' | 'world_visits'

const boards: {
  value: Key
  label: string
  icon: IconDefinition
  /* Staw: "we do have an icon for brix so it should be used". The three
     money boards are drawn with his mark; the Font Awesome one behind it
     is only what `Glyph` falls back to if the file ever goes missing. */
  ours?: KobIcon
  /** What the number is, where it is not an amount of Brix. */
  unit?: string
  /** The sides this board can honestly be drawn for. */
  sides: BoardSide[]
}[] = [
  {
    value: 'brix',
    label: `${currency.plural} held`,
    icon: faCoins,
    ours: 'brix',
    sides: ['players', 'communities'],
  },
  {
    value: 'spent',
    label: `${currency.plural} spent`,
    icon: faFire,
    ours: 'brix',
    sides: ['players', 'communities'],
  },
  {
    value: 'worth',
    label: 'Net worth',
    icon: faSackDollar,
    ours: 'brix',
    sides: ['players'],
  },
  {
    value: 'visits',
    label: 'World visits',
    icon: worldIcon,
    ours: 'world',
    unit: 'visits',
    sides: ['players'],
  },
  {
    value: 'sales',
    label: 'Catalog sales',
    icon: faTags,
    unit: 'sold',
    sides: ['players', 'communities'],
  },
  {
    value: 'assets',
    label: 'Assets made',
    icon: faShapes,
    ours: 'assets',
    unit: 'made',
    sides: ['players', 'communities'],
  },
  {
    value: 'world_likes',
    label: 'Worlds by likes',
    icon: worldIcon,
    ours: 'world',
    unit: 'likes',
    sides: ['players'],
  },
  {
    value: 'world_visits',
    label: 'Worlds by visits',
    icon: worldIcon,
    ours: 'world',
    unit: 'visits',
    sides: ['players'],
  },
]

/** Gold, silver, bronze, and then the rest of the page. */
const metals = [
  { ring: 'border-[#f0c040]/60 bg-[#f0c040]/10', text: 'text-[#f0c040]' },
  { ring: 'border-white/35 bg-white/10', text: 'text-white/80' },
  { ring: 'border-[#d08a4a]/55 bg-[#d08a4a]/10', text: 'text-[#d08a4a]' },
]

/** The number, with the mark on it only where it is money. */
function Amount({ value, unit, size = 'md' }: {
  value: number
  unit?: string
  size?: 'md' | 'lg'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 font-display font-extrabold tabular-nums',
        size === 'lg' ? 'text-2xl' : 'text-base',
      )}
    >
      {!unit && (
        <CurrencyMark className={cn('self-center', size === 'lg' ? 'h-5 w-5' : 'h-[0.9em] w-[0.9em]')} />
      )}
      {formatCount(value)}
      {unit && <span className="text-xs font-bold text-muted">{unit}</span>}
    </span>
  )
}

/** What a row points at, whichever kind of row it is. */
type Entry = {
  key: string
  to: string
  name: string
  under: string
  image: string | null
  ticked: boolean
  amount: number
  /** An account has a face; a World has a cover. */
  face: boolean
  mine: boolean
}

function Face({ one, size }: { one: Entry; size: 'lg' | 'md' | 'sm' }) {
  if (one.face) {
    return (
      <PersonAvatar
        person={{ display_name: one.name, avatar_url: one.image }}
        size={size === 'lg' ? '2xl' : size === 'md' ? 'xl' : 'sm'}
        ring="ring-ink-card"
        className="relative"
      />
    )
  }
  return (
    <span
      className={cn(
        'relative block shrink-0 overflow-hidden border border-ink-line bg-media',
        size === 'sm' ? 'h-8 w-12 rounded-lg' : size === 'md' ? 'h-16 w-24 rounded-2xl' : 'h-20 w-32 rounded-2xl',
      )}
    >
      {one.image
        ? <img src={one.image} alt="" className="h-full w-full object-cover" />
        : (
          <span className="grid h-full w-full place-items-center text-muted">
            <Icon name="world" tone="currentColor" className="h-6 w-6" />
          </span>
        )}
    </span>
  )
}

/**
 * The podium.
 *
 * Three cards side by side said who was first by writing the word; this
 * stands them on blocks of three different heights, which says it without
 * a word at all. Second, first, third across the top on a wide screen,
 * stacked in placing order on a phone, where there is no room for a
 * podium and the order is the whole point.
 */
function Podium({ top, unit }: { top: Entry[]; unit?: string }) {
  const across = [1, 0, 2].filter((at) => top[at])
  const blocks = ['h-32', 'h-20', 'h-14']

  return (
    <Card className="relative overflow-hidden p-5 sm:px-6 sm:pb-0 sm:pt-8">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl"
      />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        {across.map((at) => {
          const one = top[at]
          const metal = metals[at]
          return (
            <Link
              key={one.key}
              to={one.to}
              className={cn(
                'group flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-ink-hover sm:flex-1 sm:flex-col sm:items-center sm:gap-0 sm:p-0 sm:hover:bg-transparent',
                one.mine && 'ring-2 ring-brand-bright sm:ring-0',
              )}
            >
              <span className="relative shrink-0 sm:mb-3">
                <Face one={one} size={at === 0 ? 'lg' : 'md'} />
                <span
                  className={cn(
                    'absolute -left-1 -top-1 grid h-7 w-7 place-items-center rounded-full border-2 border-ink-card bg-ink-raised font-display text-xs font-extrabold tabular-nums',
                    metal.text,
                  )}
                >
                  {at === 0 ? <Glyph icon={faCrown} className="h-3 w-3" /> : at + 1}
                </span>
              </span>

              <span className="min-w-0 flex-1 sm:w-full sm:flex-none sm:text-center">
                <span className="flex items-center gap-1.5 sm:justify-center">
                  <span className={cn(
                    'truncate font-display font-extrabold',
                    at === 0 ? 'text-lg' : 'text-base',
                  )}>
                    {one.name}
                  </span>
                  {one.ticked && <Verified className="text-xs" />}
                </span>
                <span className="block truncate text-xs text-muted sm:text-center">{one.under}</span>
              </span>

              <span className={cn('shrink-0 sm:mt-2', metal.text)}>
                <Amount value={one.amount} unit={unit} size={at === 0 ? 'lg' : 'md'} />
              </span>

              {/* The block itself. Phones get none of this: there is no
                  room for it and the list below says the same thing. */}
              <span
                aria-hidden="true"
                className={cn(
                  'hidden w-full rounded-t-2xl border-x border-t transition-[height] duration-500 sm:mt-4 sm:block',
                  blocks[at], metal.ring,
                )}
              >
                <span className={cn(
                  'grid h-full place-items-center font-display text-3xl font-extrabold tabular-nums opacity-50',
                  metal.text,
                )}>
                  {at + 1}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

/**
 * A row of the rest.
 *
 * The bar used to fill the row from the left, which read as a highlight on
 * whoever happened to be near the top. It is a rule under the row now: the
 * eye goes down the numbers, and the line says how far behind the leader
 * each one is without colouring the name.
 */
function Row({ one, place, top, unit }: {
  one: Entry
  place: number
  top: number
  unit?: string
}) {
  const part = top > 0 ? Math.max(0.02, one.amount / top) : 0

  return (
    <Link
      to={one.to}
      className={cn(
        'relative flex items-center gap-3 border-b border-ink-line/70 px-4 py-3 transition-colors last:border-0 hover:bg-ink-hover',
        one.mine && 'bg-brand/10',
      )}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-[2px] bg-brand-bright/70 transition-[width] duration-700 ease-out"
        style={{ width: `${part * 100}%` }}
      />

      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-raised font-display text-xs font-extrabold tabular-nums text-muted">
        {place}
      </span>

      <Face one={one} size="sm" />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold">{one.name}</span>
          {one.ticked && <Verified className="text-[11px]" />}
        </span>
        <span className="block truncate text-xs text-muted">{one.under}</span>
      </span>

      <span className="shrink-0">
        <Amount value={one.amount} unit={unit} />
      </span>
    </Link>
  )
}

const asAccount = (row: BoardRow, me: string | undefined): Entry => ({
  key: row.subject_id,
  to: row.kind === 'community'
    ? `/c/${row.handle}`
    : profileLink({ username: row.handle, content_id: row.content_id }),
  name: row.name,
  under: row.kind === 'community' ? `Community · ${row.handle}` : `@${row.handle}`,
  image: row.image_url,
  ticked: row.is_verified,
  amount: row.amount,
  face: true,
  mine: row.subject_id === me,
})

const asWorld = (row: WorldBoardRow): Entry => ({
  key: row.world_id,
  /* A World on this board is published, so it has a content id; the column
     is nullable for the ones still being built, which are never here. */
  to: worldLink({ content_id: row.content_id ?? 0, slug: row.slug, name: row.name }),
  name: row.name,
  under: row.owner_name ? `by ${row.owner_name}` : 'by somebody who has left',
  image: row.cover_url,
  ticked: row.owner_verified,
  amount: row.amount,
  face: false,
  mine: false,
})

export default function Leaderboards() {
  useTitle('Leaderboards')
  const { profile } = useAuth()
  const [board, setBoard] = useState<Key>('brix')
  const [side, setSide] = useState<BoardSide>('players')

  const chosen = boards.find((one) => one.value === board)!
  const isWorlds = board === 'world_likes' || board === 'world_visits'
  /* A board with only one side falls back to it rather than showing
     nothing: the switch is hidden there, so nobody is left looking at a
     side they cannot leave. */
  const realSide: BoardSide = chosen.sides.includes(side) ? side : 'players'

  const rows = useAsync<Entry[]>(async () => {
    if (isWorlds) {
      const got = await worldLeaderboard(board === 'world_likes' ? 'likes' : 'visits')
      return got.map(asWorld)
    }
    const got = await leaderboard(board as OwnerBoard, realSide)
    return got.map((row) => asAccount(row, profile?.id))
  }, [board, realSide, profile?.id])

  const places = useAsync(
    async () => (profile ? personPlaces() : []),
    [profile?.id],
  )

  const all = rows.data ?? []
  const top = all.slice(0, 3)
  const rest = all.slice(3)
  const leader = all[0]?.amount ?? 0
  const mine = (places.data ?? []).find((one) => one.board === board)

  return (
    <BrixShell
      icon={faRankingStar}
      title="Leaderboards"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-start">
        {/* ------------------------------------------------ which board */}
        <Card className="p-2 lg:sticky lg:top-20">
          <div
            role="tablist"
            aria-label="Which board"
            className="flex gap-1 overflow-x-auto kob-scroll lg:flex-col lg:overflow-visible"
          >
            {boards.map((one) => {
              const here = one.value === board
              return (
                <button
                  key={one.value}
                  type="button"
                  role="tab"
                  aria-selected={here}
                  onClick={() => setBoard(one.value)}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors lg:w-full',
                    here ? 'bg-brand/20 text-white' : 'text-white/55 hover:bg-ink-hover hover:text-white',
                  )}
                >
                  <Glyph
                    icon={one.icon}
                    name={one.ours}
                    className={cn('h-4 w-4 shrink-0', here ? 'text-brand-bright' : 'text-white/35')}
                  />
                  <span className="truncate">{one.label}</span>
                </button>
              )
            })}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-extrabold">
                {chosen.label}
              </h2>
            </div>

            {chosen.sides.length > 1 && (
              <Choices
                label="Players or Communities"
                value={realSide}
                options={[
                  { value: 'players', label: 'Players', icon: faUser },
                  { value: 'communities', label: 'Communities', icon: faUsers },
                ]}
                onChange={setSide}
              />
            )}

            {chosen.sides.length === 1 && (
              <span
                title={isWorlds
                  ? 'A World belongs to a person, so this board has no Communities side.'
                  : `Net worth counts avatar items, which a Community does not have.`}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-xs font-bold text-muted"
              >
                <Glyph icon={faUser} className="h-3.5 w-3.5" />
                {isWorlds ? 'Worlds' : 'Players only'}
              </span>
            )}
          </div>


          {rows.error ? (
            <ErrorState message={rows.error} onRetry={rows.reload} />
          ) : rows.loading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          ) : all.length === 0 ? (
            <Card>
              <EmptyState
                mood="emptyBox"
                title="Nobody is on this board yet"
                body="Nothing has happened that counts towards it. Whoever does it first is first on it."
              />
            </Card>
          ) : (
            <div key={`${board}-${realSide}`} className="space-y-4">
              <Podium top={top} unit={chosen.unit} />

              {rest.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-ink-line px-4 py-3">
                    <h3 className="font-display text-base font-extrabold">The rest of the fifty</h3>
                    <p className="text-xs text-muted">{all.length} on the board</p>
                  </div>
                  {rest.map((one, at) => (
                    <Row key={one.key} one={one} place={at + 4} top={leader} unit={chosen.unit} />
                  ))}
                </Card>
              )}
            </div>
          )}

          {/* Where you are, which the fifty above will not say for almost
              anybody. It is read separately and is only ever your own. */}
          {profile && !isWorlds && realSide === 'players' && !places.loading && (
            <Card className="flex flex-wrap items-center gap-4 p-4">
              <PersonAvatar person={profile} size="md" />
              <div className="min-w-0 flex-1">
                {mine?.place !== null && mine?.place !== undefined ? (
                  <p className="font-display text-lg font-extrabold tabular-nums">
                    #{formatCount(mine.place)}
                    <span className="ml-1.5 text-xs font-bold text-muted">of {formatCount(mine.of_how_many)}</span>
                  </p>
                ) : (
                  <p className="font-display text-sm font-bold text-muted">Not on this board</p>
                )}
                <p className="text-xs font-bold text-muted">You</p>
              </div>
              {!!mine?.amount && (
                <span className="shrink-0 text-right">
                  <Amount value={mine.amount} unit={chosen.unit} />
                </span>
              )}
            </Card>
          )}

        </div>
      </div>
    </BrixShell>
  )
}
