import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Choices } from '@/components/ui/Choices'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Input } from '@/components/ui/Input'
import { EmptyState, ErrorState, SpaceCardSkeleton } from '@/components/ui/States'
import { categoryLabels } from '@/components/spaces/SpaceCard'
import { SiteCard } from '@/components/spaces/SiteCard'
import { useAsync } from '@/hooks/useAsync'
import { listSpaces } from '@/lib/api'
import type { SpaceSort } from '@/lib/api'
import type { Space, SpaceCategory } from '@/types/db'
import { useTitle } from '@/hooks/useTitle'
import { AdBanner } from '@/components/ads/AdBanner'

const sorts: { value: SpaceSort; label: string }[] = [
  { value: 'trending', label: 'Trending' },
  { value: 'new', label: 'New' },
  { value: 'popular', label: 'Most liked' },
]

const categories: (SpaceCategory | 'all')[] =
  ['all', 'personal', 'community', 'interactive', 'experiment', 'story', 'fan']

/**
 * A section of the directory: a heading and a grid under it, rather than a
 * rail you push sideways. Looking through what people have made should feel
 * like looking through a shelf, not operating a carousel.
 */
function Shelf({ title, spaces, loading }: {
  title: string
  spaces: Space[] | null
  loading: boolean
}) {
  if (!loading && !spaces?.length) return null

  return (
    <section className="mb-9">
      <SectionHeader title={title} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {loading
          ? [0, 1, 2, 3].map((i) => <SpaceCardSkeleton key={i} />)
          : (spaces ?? []).slice(0, 8).map((space) => <SiteCard key={space.id} space={space} />)}
      </div>
    </section>
  )
}

export default function Discover() {
  useTitle('Discover')
  const [params, setParams] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(term)
  const [sort, setSort] = useState<SpaceSort>('trending')
  const [category, setCategory] = useState<SpaceCategory | 'all'>('all')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(term)
      setParams(term ? { q: term } : {}, { replace: true })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [term, setParams])

  // With nothing typed and nothing filtered, Discover reads as rows to
  // browse. The moment you search or pick a category it becomes a grid of
  // results, because then you are looking for something specific.
  const browsing = !debounced && category === 'all'

  const { data, error, loading, reload } = useAsync(
    async () => (browsing ? [] : listSpaces({ sort, category, search: debounced, limit: 36 })),
    [sort, category, debounced, browsing],
  )
  const trending = useAsync(
    async () => (browsing ? listSpaces({ sort: 'trending', limit: 18 }) : []),
    [browsing],
  )
  const fresh = useAsync(async () => (browsing ? listSpaces({ sort: 'new', limit: 18 }) : []), [browsing])
  const liked = useAsync(async () => (browsing ? listSpaces({ sort: 'popular', limit: 18 }) : []), [browsing])

  return (
    <Page>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Discover</h1>
        <p className="mt-1.5 text-muted">What people are building right now.</p>
      </header>


      <div className="sticky top-14 z-20 -mx-4 mb-6 space-y-3 bg-ink/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Input
          icon={faMagnifyingGlass}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search Worlds by name"
          aria-label="Search Worlds"
        />
        <div className="flex flex-wrap items-center gap-2">
          {!browsing && (
            <>
              <Choices label="How to sort" value={sort} options={sorts} onChange={setSort} />
              <span className="mx-1 hidden h-6 w-px bg-ink-line sm:block" />
            </>
          )}
          <Choices
            label="What kind of World"
            tone="soft"
            value={category}
            options={categories.map((c) => ({
              value: c,
              label: c === 'all' ? 'Everything' : categoryLabels[c],
            }))}
            onChange={setCategory}
          />
        </div>
      </div>

      {/* The one slot that says what it is when it is empty, so there is
          somewhere on the site that invites an advertiser in. */}
      <AdBanner className="mb-6" />

      {/* Everything there is to look at sits beside a tall one, where the
          screen is wide enough to hold both. */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_160px] xl:items-start">
        <div className="min-w-0 space-y-6">

      {browsing && (
        <>
          <Shelf title="Being visited right now" spaces={trending.data} loading={trending.loading} />
          <Shelf title="Just published" spaces={fresh.data} loading={fresh.loading} />
          <Shelf title="Most liked" spaces={liked.data} loading={liked.loading} />
          {!trending.loading && !trending.data?.length && (
            <Card>
              <EmptyState
                mood="construction"
                title="Nothing published yet"
                body="Be the first person to publish something here."
              />
            </Card>
          )}
        </>
      )}

      {!browsing && loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <SpaceCardSkeleton key={i} />)}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={reload} />}

      {!browsing && !loading && !error && data?.length === 0 && (
        <Card>
          <EmptyState
            mood="noResults"
            title={debounced ? 'Kobby couldn’t find anything' : 'Nothing published yet'}
            body={
              debounced
                ? `No Space matches "${debounced}". Try a shorter word, or look at everything.`
                : 'Be the first person to publish something here.'
            }
          />
        </Card>
      )}

      {!browsing && !!data?.length && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {data.map((space) => <SiteCard key={space.id} space={space} />)}
        </div>
      )}
        </div>

        <AdBanner size="tall" quiet className="hidden xl:sticky xl:top-[4.5rem] xl:block" />
      </div>
    </Page>
  )
}
