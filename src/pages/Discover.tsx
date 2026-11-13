import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  faCompass, faFire, faSeedling, faHeart, faChartSimple,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { BrowseHero } from '@/components/browse/BrowseHero'
import { BrowseHeading } from '@/components/browse/BrowseRail'
import { Toolbar } from '@/components/ui/Toolbar'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, SpaceCardSkeleton } from '@/components/ui/States'
import { WorldCard } from '@/components/worlds/WorldCard'
import { Shelf, WorldTile, WorldFeature } from '@/components/worlds/Shelf'
import { Skeleton } from '@/components/ui/States'
import { useAsync } from '@/hooks/useAsync'
import { listWorlds, liveWorldRegions, worldGenres } from '@/lib/api'
import type { WorldSort } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { useTitle } from '@/hooks/useTitle'
import { AdBanner } from '@/components/ads/AdBanner'
import type { World, WorldDevice, WorldGenre, WorldRegion } from '@/types/db'
import { Select } from '@/components/ui/Select'
import { deviceLabels, everyDevice, regionLabels } from '@/lib/kinds'

/*
 * Discover, laid out again.
 *
 * Staw: "redesign the discover page (new layout) cuz it sucks ... add more
 * square & rectangle lines for worlds in discover page too".
 *
 * What it was: a hero, a row of two filters, and then a thirteen-rem rail
 * down the left with two columns of buttons in it, the Worlds in whatever
 * was left. So the page about Worlds spent its left edge and a third of its
 * controls budget on navigation, and the charts under it were three shelves
 * and a feature row - a short page with a long sidebar.
 *
 * What it is now:
 *
 * - **No rail.** Everything that narrows the page is one sticky bar: the
 *   four ways of looking on the left, the three things to narrow by on the
 *   right. It stays with you as the shelves run on, which the rail could
 *   never do past its own height, and the Worlds get the whole width.
 * - **Nine lines instead of four**, and mainly square ones. Two wide lines,
 *   at the top and in the middle, and squares everywhere else, including a
 *   shelf for each of the first kinds of World that have any. That is the
 *   shape Staw asked for: "mainly square worlds but also sometimes some
 *   lines with rectangles".
 * - **A wider grid.** Up to six columns of emblems rather than four, which
 *   is what the page can hold now that nothing stands beside it.
 */
type View = WorldSort | 'charts'

const SHELVES: { value: WorldSort; label: string; icon: typeof faFire; note: string }[] = [
  { value: 'trending', label: 'Being played', icon: faFire, note: 'Busiest on Kobblon right now' },
  { value: 'new', label: 'Just published', icon: faSeedling, note: 'Straight out of the Workspace' },
  { value: 'popular', label: 'Most liked', icon: faHeart, note: 'What people came back and said' },
]

/*
 * How many kinds of World get a shelf of their own.
 *
 * Three, and the ones that actually have Worlds in them. Every kind on the
 * list would be a page of near-empty shelves on a platform this young, and
 * a shelf with two things on it reads as a mistake rather than as a
 * category.
 */
const KIND_SHELVES = 3

type Charts = {
  sorts: Record<WorldSort, World[]>
  kinds: { genre: WorldGenre; worlds: World[] }[]
}

export default function Discover() {
  useTitle('Discover')
  const [params, setParams] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(term)
  const [view, setView] = useState<View>('charts')
  const [genre, setGenre] = useState<string>('all')
  /*
   * What you are holding and where you would be playing: the two questions
   * the rail never asked. They narrow rather than choose, so they sit with
   * the kind of World on the right of the bar, away from the four views.
   */
  const [device, setDevice] = useState<WorldDevice | 'any'>('any')
  const [region, setRegion] = useState<WorldRegion | 'anywhere'>('anywhere')
  const genres = useAsync(worldGenres, [])
  /*
   * The locations on offer are the ones that actually have a server open in
   * them, read from the database, rather than a list of places. Nothing is
   * reporting a region yet - the Launcher is what knows where it opened a
   * server - so this comes back empty and the control says so. That is the
   * truth; a list of eight that all find nothing would not be.
   */
  const regions = useAsync(liveWorldRegions, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(term)
      setParams(term ? { q: term } : {}, { replace: true })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [term, setParams])

  /*
   * Which of the two is on screen. A search or a narrowing takes the grid
   * even while the bar still says Charts, because that is what was asked
   * for; the bar follows, so the page never shows a grid with nothing lit
   * up in it.
   */
  const filtered = device !== 'any' || region !== 'anywhere'
  const narrowed = !!debounced || genre !== 'all' || filtered
  const browsing = view !== 'charts' || narrowed
  const sort: WorldSort = view === 'charts' ? 'trending' : view

  const { data, error, loading, reload } = useAsync(
    async () => (browsing
      ? listWorlds({ sort, genre, search: debounced, limit: 60, device, region })
      : []),
    [browsing, sort, genre, debounced, device, region],
  )

  /*
   * Every shelf on the front of the page, in one await.
   *
   * The three orderings cannot come out of one query - they are three
   * orders of the same table - and neither can the kinds. But they are all
   * asked for at once and only while the charts are what is on screen, so
   * the page makes one round of requests rather than one per line as each
   * scrolls into view.
   */
  const charts = useAsync<Charts | null>(
    async () => {
      if (browsing) return null
      const ready = genres.data
      const picked = (ready ?? []).slice(0, KIND_SHELVES)
      const [sorts, kinds] = await Promise.all([
        Promise.all(SHELVES.map(async (one) => [
          one.value, await listWorlds({ sort: one.value, limit: 24 }),
        ] as const)).then((rows) => Object.fromEntries(rows) as Record<WorldSort, World[]>),
        Promise.all(picked.map(async (one) => ({
          genre: one,
          worlds: await listWorlds({ sort: 'trending', genre: one.id, limit: 18 }),
        }))),
      ])
      /* A kind with nothing in it is not a shelf. */
      return { sorts, kinds: kinds.filter((one) => one.worlds.length >= 3) }
    },
    [browsing, genres.data],
  )

  const found = data ?? []
  const sorts = charts.data?.sorts
  /* The ones under the five at the top, so the wide line in the middle of
     the page is not the top of the page a second time. */
  const standout = (sorts?.popular ?? []).slice(5, 11)

  const views: { value: View; label: string; icon: typeof faFire }[] = [
    { value: 'charts', label: 'Charts', icon: faChartSimple },
    ...SHELVES.map((one) => ({ value: one.value, label: one.label, icon: one.icon })),
  ]

  const named = SHELVES.find((one) => one.value === view)?.label ?? 'Worlds'
  const kindName = genre === 'all'
    ? null
    : (genres.data ?? []).find((one) => one.id === genre)?.label ?? null

  const clear = () => {
    setTerm(''); setGenre('all'); setDevice('any'); setRegion('anywhere'); setView('charts')
  }

  return (
    <Page width="wide" className="space-y-5">
      <BrowseHero
        title="Discover"
        lead="What people are building and playing right now."
        icon={faCompass}
        value={term}
        onChange={setTerm}
        placeholder="Search Worlds by name"
      />

      {/*
          One bar, and it sticks. The four views on the left because they
          choose what the page is; the three narrowings on the right because
          they cut down whatever it chose. On a phone the whole thing wraps
          into two lines and the tabs scroll, rather than the eleven-button
          column the rail turned into down there.
      */}
      <Toolbar className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Tabs
          label="What to see"
          value={browsing && view === 'charts' ? 'trending' : view}
          onChange={(next) => setView(next)}
          options={views}
          className="max-w-full overflow-x-auto kob-scroll"
        />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            label="What kind of World"
            value={genre}
            onChange={setGenre}
            className="w-40"
            align="right"
            options={[
              { value: 'all', label: 'Every kind' },
              ...(genres.data ?? []).map((one) => ({ value: one.id, label: one.label })),
            ]}
          />

          <Select
            label="What you are playing on"
            value={device}
            onChange={(value) => setDevice(value as WorldDevice | 'any')}
            className="w-40"
            align="right"
            options={[
              { value: 'any', label: 'Any device' },
              ...everyDevice.map((one) => ({ value: one, label: deviceLabels[one] })),
            ]}
          />

          <Select
            label="Where you would be playing"
            value={region}
            onChange={(value) => setRegion(value as WorldRegion | 'anywhere')}
            className="w-44"
            align="right"
            disabled={!regions.data?.length}
            options={[
              {
                value: 'anywhere',
                label: regions.data?.length ? 'Anywhere' : 'No servers yet',
                note: regions.data?.length
                  ? undefined
                  : 'Nowhere is reporting a location at the moment',
              },
              ...(regions.data ?? []).map((one) => ({
                value: one.region,
                label: regionLabels[one.region],
                note: `${formatCount(one.worlds)} ${one.worlds === 1 ? 'World' : 'Worlds'}, ${formatCount(one.servers)} open`,
              })),
            ]}
          />

          {narrowed && (
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          )}
        </div>
      </Toolbar>

      {!browsing && (
        <div>
          {charts.loading && (
            <div className="space-y-8">
              <div className="flex gap-4 pb-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="aspect-[16/9] w-72 shrink-0 rounded-xl sm:w-[22rem]" />
                ))}
              </div>
              <div className="flex gap-4 pb-2">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <Skeleton key={i} className="aspect-square w-[7.5rem] shrink-0 rounded-xl sm:w-36" />
                ))}
              </div>
            </div>
          )}

          {charts.error && <ErrorState message={charts.error} onRetry={charts.reload} />}

          {!charts.loading && !charts.error && !sorts?.trending.length && (
            <Card className="p-5">
              <EmptyState
                mood="construction"
                title="Nothing published yet"
                body="Be the first person to publish something here."
                action={<Button to="/create/worlds">Make a World</Button>}
              />
            </Card>
          )}

          {/* Wide line, one of two. The most liked rather than the busiest,
              so the top of the page is not the same Worlds as the shelf
              under it. */}
          {!!sorts?.popular.length && (
            <Shelf title="Featured" note="Top picks on Kobblon">
              {sorts.popular.slice(0, 5).map((world) => (
                <WorldFeature key={world.id} world={world} />
              ))}
            </Shelf>
          )}

          {!!sorts?.trending.length && (
            <Shelf
              title="Being played"
              note="Busiest on Kobblon right now"
              more={{ onClick: () => setView('trending') }}
            >
              {sorts.trending.map((world) => <WorldTile key={world.id} world={world} />)}
            </Shelf>
          )}

          {!!sorts?.new.length && (
            <Shelf
              title="Just published"
              note="Straight out of the Workspace"
              more={{ onClick: () => setView('new') }}
            >
              {sorts.new.map((world) => <WorldTile key={world.id} world={world} />)}
            </Shelf>
          )}

          {/* Wide line, two of two, and it sits in the middle of the page
              rather than beside the first one. Two rectangles in a row read
              as the page changing shape; one every few shelves reads as a
              shelf worth stopping at. */}
          {!!standout.length && (
            <Shelf title="Standout Worlds" note="Well liked, and given the room">
              {standout.map((world) => <WorldFeature key={world.id} world={world} />)}
            </Shelf>
          )}

          {!!sorts?.popular.length && (
            <Shelf
              title="Most liked"
              note="What people came back and said"
              more={{ onClick: () => setView('popular') }}
            >
              {sorts.popular.map((world) => <WorldTile key={world.id} world={world} />)}
            </Shelf>
          )}

          {/* One shelf per kind, square, and only the kinds that have
              enough Worlds to be a shelf. Through the heading is the grid
              for that kind, which is the one thing the old rail did that
              this has to keep. */}
          {(charts.data?.kinds ?? []).map((one) => (
            <Shelf
              key={one.genre.id}
              title={one.genre.label}
              note="Worlds of this kind, busiest first"
              more={{ onClick: () => { setGenre(one.genre.id); setView('trending') } }}
            >
              {one.worlds.map((world) => <WorldTile key={world.id} world={world} />)}
            </Shelf>
          ))}

          {!!sorts?.trending.length && <AdBanner className="mt-2" />}
        </div>
      )}

      {browsing && (
        <div>
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
            {narrowed && (
              <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
            )}
          </BrowseHeading>

          {loading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => <SpaceCardSkeleton key={i} />)}
            </div>
          )}

          {error && <ErrorState message={error} onRetry={reload} />}

          {!loading && !error && !found.length && (
            <Card className="p-5">
              <EmptyState
                mood={narrowed ? 'noResults' : 'construction'}
                title={narrowed ? 'Kobby could not find anything' : 'Nothing published yet'}
                body={
                  debounced
                    ? `No World matches "${debounced}". Try a shorter word, or look at everything.`
                    : region !== 'anywhere'
                      ? 'Nothing is open there right now. Try anywhere, or another device.'
                      : device !== 'any'
                        ? `No World says it runs on a ${deviceLabels[device].toLowerCase()} yet.`
                        : genre !== 'all'
                          ? 'Nothing of this kind yet. Try everything instead.'
                          : 'Be the first person to publish something here.'
                }
                action={
                  narrowed
                    ? <Button variant="subtle" onClick={clear}>Everything</Button>
                    : <Button to="/create/worlds">Make a World</Button>
                }
              />
            </Card>
          )}

          {!loading && !!found.length && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {found.map((world) => (
                  <WorldCard key={world.id} world={world} genres={genres.data ?? undefined} />
                ))}
              </div>
              <AdBanner className="mt-6" />
            </>
          )}
        </div>
      )}
    </Page>
  )
}
