import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  faCompass, faFire, faSeedling, faHeart, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { BrowseHero } from '@/components/browse/BrowseHero'
import { BrowseRail, BrowseFrame, BrowseHeading } from '@/components/browse/BrowseRail'
import type { RailItem } from '@/components/browse/BrowseRail'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, SpaceCardSkeleton } from '@/components/ui/States'
import { WorldCard } from '@/components/worlds/WorldCard'
import { useAsync } from '@/hooks/useAsync'
import { listWorlds, worldGenres } from '@/lib/api'
import type { WorldSort } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { useTitle } from '@/hooks/useTitle'
import { AdBanner } from '@/components/ads/AdBanner'

/*
 * Discover, put in order.
 *
 * Staw, on what was wrong with it: "three headed rows down a narrow column
 * with an advert beside them, so the Worlds are the smallest thing on a page
 * about Worlds."
 *
 * He is right and it is worth being precise about how it happened. The page
 * had an `xl:grid-cols-[minmax(0,1fr)_160px]` around its body for the tall
 * advert, each row then capped itself at eight cards, and the grid inside
 * that was still asking for four columns - so on an ordinary laptop the
 * Worlds came out three narrow cards wide in a column with a banner over it,
 * a sticky filter bar under that, and an advert to the right. Four things
 * competing for a page whose subject is the Worlds.
 *
 * Now: one grid, as wide as the page allows, and the three rows are three
 * entries on the rail instead - because "trending" is not a section, it is
 * an order, and giving an order its own heading and its own eight-card row
 * is what made the page feel like three pages stacked.
 */

type Shelf = WorldSort

const SHELVES: { value: Shelf; label: string; icon: typeof faFire }[] = [
  { value: 'trending', label: 'Being played', icon: faFire },
  { value: 'new', label: 'Just published', icon: faSeedling },
  { value: 'popular', label: 'Most liked', icon: faHeart },
]

export default function Discover() {
  useTitle('Discover')
  const [params, setParams] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(term)
  const [sort, setSort] = useState<WorldSort>('trending')
  const [genre, setGenre] = useState<string>('all')
  const genres = useAsync(worldGenres, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(term)
      setParams(term ? { q: term } : {}, { replace: true })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [term, setParams])

  /*
   * One query for the whole page. It used to run four - the grid, plus one
   * per row - and three of them were the same forty Worlds in three orders,
   * which is three requests to answer a question the first one answered.
   */
  const { data, error, loading, reload } = useAsync(
    async () => listWorlds({ sort, genre, search: debounced, limit: 48 }),
    [sort, genre, debounced],
  )

  const found = data ?? []

  /*
   * No counts on the sorts. They would each have shown the length of
   * whatever is on screen, which is the same number beside all three and
   * true of only one of them - and the heading says it once already.
   */
  const sorts: RailItem<Shelf>[] = SHELVES.map((one) => ({
    value: one.value,
    label: one.label,
    icon: one.icon,
  }))

  const kinds: RailItem<string>[] = [
    { value: 'all', label: 'Everything', icon: faLayerGroup },
    /* No icon: there is no drawing of "roleplay", and six compasses in a
       column is six icons that say nothing. */
    ...(genres.data ?? []).map((one) => ({
      value: one.id,
      label: one.label,
    })),
  ]

  const named = SHELVES.find((one) => one.value === sort)?.label ?? 'Worlds'
  const kindName = genre === 'all'
    ? null
    : (genres.data ?? []).find((one) => one.id === genre)?.label ?? null

  return (
    <Page width="wide" className="space-y-6">
      <BrowseHero
        title="Discover"
        lead="What people are building and playing right now."
        icon={faCompass}
        value={term}
        onChange={setTerm}
        placeholder="Search Worlds by name"
      />

      <BrowseFrame
        rail={
          <>
            {/* Two questions, so two columns rather than one unbroken
                list of eleven buttons that reads as a single choice. */}
            <BrowseRail
              label="How to sort the Worlds"
              heading="What to see"
              items={sorts}
              value={sort}
              onChange={setSort}
            />
            <BrowseRail
              label="What kind of World"
              heading="What kind"
              items={kinds}
              value={genre}
              onChange={setGenre}
              foot={<AdBanner size="tall" quiet />}
            />
          </>
        }
      >
        <BrowseHeading
          title={kindName ? `${named}: ${kindName}` : named}
          note={
            loading
              ? 'Looking…'
              : debounced
                ? `${formatCount(found.length)} for "${debounced}"`
                : `${formatCount(found.length)} ${found.length === 1 ? 'World' : 'Worlds'}`
          }
        >
          {(debounced || genre !== 'all') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setTerm(''); setGenre('all') }}
            >
              Clear
            </Button>
          )}
        </BrowseHeading>

        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <SpaceCardSkeleton key={i} />)}
          </div>
        )}

        {error && <ErrorState message={error} onRetry={reload} />}

        {!loading && !error && !found.length && (
          <Card className="p-5">
            <EmptyState
              mood={debounced || genre !== 'all' ? 'noResults' : 'construction'}
              title={
                debounced || genre !== 'all'
                  ? 'Kobby could not find anything'
                  : 'Nothing published yet'
              }
              body={
                debounced
                  ? `No World matches "${debounced}". Try a shorter word, or look at everything.`
                  : genre !== 'all'
                    ? 'Nothing of this kind yet. Try everything instead.'
                    : 'Be the first person to publish something here.'
              }
              action={
                debounced || genre !== 'all'
                  ? (
                    <Button
                      variant="subtle"
                      onClick={() => { setTerm(''); setGenre('all') }}
                    >
                      Everything
                    </Button>
                  )
                  : <Button to="/create/worlds">Make a World</Button>
              }
            />
          </Card>
        )}

        {!loading && !!found.length && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
            {found.map((world) => (
              <WorldCard key={world.id} world={world} genres={genres.data ?? undefined} />
            ))}
          </div>
        )}

        {/* The rail's foot is hidden on a phone, so the one slot that says
            what it is when it is empty goes under the grid there. */}
        {!loading && !!found.length && <AdBanner className="mt-6 lg:hidden" />}
      </BrowseFrame>
    </Page>
  )
}
