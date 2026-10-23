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
  lead: string
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
    lead: 'What is sitting on the account today. It moves the moment somebody buys something.',
    sides: ['players', 'communities'],
  },
  {
    value: 'spent',
    label: `${currency.plural} spent`,
    icon: faFire,
    ours: 'brix',
    lead: 'Everything that has ever left the account: items, gifts, adverts, the lot. Nothing about what it went on is shown, only the total.',
    sides: ['players', 'communities'],
  },
  {
    value: 'worth',
    label: 'Net worth',
    icon: faSackDollar,
    ours: 'brix',
    lead: 'The balance plus what their avatar items are listed at today. Brix and Brix added up, and nothing about levels or time played.',
    sides: ['players'],
  },
  {
    value: 'visits',
    label: 'World visits',
    icon: worldIcon,
    ours: 'world',
    lead: 'Everybody who has walked into a World they own, added up across all of them.',
    unit: 'visits',
    sides: ['players'],
  },
  {
    value: 'sales',
    label: 'Catalog sales',
    icon: faTags,
    lead: 'How many of the things they made are being worn by somebody else.',
    unit: 'sold',
    sides: ['players', 'communities'],
  },
  {
    value: 'assets',
    label: 'Assets made',
    icon: faShapes,
    ours: 'assets',
    lead: 'Meshes, textures, sounds and the rest, published to the marketplace for anybody to build with.',
    unit: 'made',
    sides: ['players', 'communities'],
  },
  {
    value: 'world_likes',
    label: 'Worlds by likes',
    icon: worldIcon,
    ours: 'world',
    lead: 'The Worlds people liked the most. This board is of Worlds rather than of the people who made them.',
    unit: 'likes',
    sides: ['players'],
  },
  {
    value: 'world_visits',
    label: 'Worlds by visits',
    icon: worldIcon,
    ours: 'world',
    lead: 'The Worlds most walked into. Of Worlds, again, rather than of their owners.',
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

function Step({ one, at, unit }: { one: Entry; at: number; unit?: string }) {
  const metal = metals[at]
  /* Second, first, third from the left on a wide screen, which is what a
     podium is. On a phone they stack in the order they placed. */
  const order = ['sm:order-2', 'sm:order-1', 'sm:order-3'][at]
  const tall = ['sm:pt-10', 'sm:pt-4', 'sm:pt-14'][at]

  return (
    <Link
      to={one.to}
      style={{ animationDelay: `${at * 90}ms` }}
      className={cn(
        'group flex animate-row-in flex-col items-center rounded-2xl border bg-ink-card p-5 text-center transition-colors hover:bg-ink-hover',
        metal.ring, order, tall,
        one.mine && 'ring-2 ring-brand-bright',
      )}
    >
      <span className={cn('mb-3 font-display text-xs font-extrabold uppercase tracking-widest', metal.text)}>
        {at === 0 && <Glyph icon={faCrown} className="mr-1.5" />}
        {['First', 'Second', 'Third'][at]}
      </span>

      {one.face ? (
        <PersonAvatar
          person={{ display_name: one.name, avatar_url: one.image }}
          size={at === 0 ? '2xl' : 'xl'}
          ring="ring-ink-card"
        />
      ) : (
        <span
          className={cn(
            'overflow-hidden rounded-2xl border border-ink-line bg-media',
            at === 0 ? 'h-20 w-32' : 'h-16 w-28',
          )}
        >
          {one.image
            ? <img src={one.image} alt="" className="h-full w-full object-cover" />
            : (
              <span className="grid h-full w-full place-items-center text-muted">
                <Icon name="world" tone="currentColor" className="h-7 w-7" />
              </span>
            )}
        </span>
      )}

      <span className="mt-3 flex max-w-full items-center gap-1.5">
        <span className="truncate font-display text-base font-extrabold">{one.name}</span>
        {one.ticked && <Verified className="text-xs" />}
      </span>
      <span className="w-full truncate text-xs text-muted">{one.under}</span>
      <span className={cn('mt-3', metal.text)}>
        <Amount value={one.amount} unit={unit} size={at === 0 ? 'lg' : 'md'} />
      </span>
    </Link>
  )
}

function Row({ one, place, top, at, unit }: {
  one: Entry
  place: number
  top: number
  at: number
  unit?: string
}) {
  const part = top > 0 ? Math.max(0.02, one.amount / top) : 0

  return (
    <Link
      to={one.to}
      style={{ animationDelay: `${Math.min(at, 12) * 25}ms` }}
      className={cn(
        'relative flex animate-row-in items-center gap-3 overflow-hidden border-b border-ink-line/70 px-4 py-3 transition-colors last:border-0 hover:bg-ink-hover',
        one.mine && 'bg-brand/10',
      )}
    >
      {/* The bar is behind the row rather than beside it: a leaderboard is
          read down the amounts, and a column of little bars pushes the names
          about. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-brand/10 transition-[width] duration-700 ease-out"
        style={{ width: `${part * 100}%` }}
      />
      <span className="relative w-8 shrink-0 text-center font-display text-sm font-extrabold tabular-nums text-muted">
        {place}
      </span>

      {one.face ? (
        <PersonAvatar
          person={{ display_name: one.name, avatar_url: one.image }}
          size="sm"
          className="relative"
        />
      ) : (
        <span className="relative h-8 w-12 shrink-0 overflow-hidden rounded-lg border border-ink-line bg-media">
          {one.image && <img src={one.image} alt="" className="h-full w-full object-cover" />}
        </span>
      )}

      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold">{one.name}</span>
          {one.ticked && <Verified className="text-[11px]" />}
        </span>
        <span className="block truncate text-xs text-muted">{one.under}</span>
      </span>

      <span className="relative shrink-0">
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
      lead="Who is top of Kobblon, at each of the things it counts. Fifty places on every board, and everybody starts on none of them."
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
              <h2 className="font-display text-2xl font-extrabold">{chosen.label}</h2>
              {/* Keyed on the board so the sentence changes with a movement
                  rather than swapping underneath the cursor. */}
              <p key={board} className="mt-1 max-w-xl animate-step-next text-sm leading-relaxed text-muted">
                {chosen.lead}
              </p>
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
          </div>

          {/* Why a board has no switch, said where somebody would look for
              one rather than in a note at the bottom. */}
          {chosen.sides.length === 1 && (
            <p className="rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-xs leading-relaxed text-muted">
              {isWorlds
                ? 'A World belongs to a person, so there is no Communities side to this board. The day a Community can own one, it gets a switch like the others.'
                : `Net worth counts the avatar items an account owns, which a Community does not have. Its ${currency.plural} are on the first board.`}
            </p>
          )}

          {rows.error ? (
            <ErrorState message={rows.error} onRetry={rows.reload} />
          ) : rows.loading ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
              </div>
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
            <div key={`${board}-${realSide}`} className="animate-step-next space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                {top.map((one, at) => (
                  <Step key={one.key} one={one} at={at} unit={chosen.unit} />
                ))}
              </div>

              {rest.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-ink-line px-4 py-3">
                    <h3 className="font-display text-base font-extrabold">The rest of the fifty</h3>
                    <p className="text-xs text-muted">{all.length} on the board</p>
                  </div>
                  {rest.map((one, at) => (
                    <Row key={one.key} one={one} place={at + 4} at={at} top={leader} unit={chosen.unit} />
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
                <p className="font-display text-sm font-bold">Where you stand</p>
                <p className="text-xs leading-relaxed text-muted">
                  {mine?.place !== null && mine?.place !== undefined
                    ? `Number ${formatCount(mine.place)} of ${formatCount(mine.of_how_many)} on ${chosen.label.toLowerCase()}.`
                    : `Nothing counts towards ${chosen.label.toLowerCase()} on your account yet.`}
                </p>
              </div>
              {!!mine?.amount && (
                <span className="shrink-0 text-right">
                  <Amount value={mine.amount} unit={chosen.unit} />
                </span>
              )}
            </Card>
          )}

          <p className="text-xs leading-relaxed text-muted">
            Guests, suspended accounts and accounts on their way out are left off, and so are
            Worlds nobody can open. Nothing here says what anybody bought or when: every board
            is one total per row, and the ledger behind the {currency.plural} boards stays
            private to the account it belongs to.
          </p>
        </div>
      </div>
    </BrixShell>
  )
}
