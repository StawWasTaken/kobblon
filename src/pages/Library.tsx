import { useState } from 'react'
import { Link } from 'react-router-dom'
import { faStar, faSliders, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'
import { EmptyState, ErrorState, SpaceCardSkeleton } from '@/components/ui/States'
import { WorldCard } from '@/components/worlds/WorldCard'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { listFavouriteWorlds, myWorlds, worldGenres } from '@/lib/api'
import { useTitle } from '@/hooks/useTitle'
import { overlayButton } from '@/lib/overlay'

export default function Library() {
  useTitle('Library')
  const { profile } = useAuth()
  const [shelf, setShelf] = useState<'Published' | 'Drafts' | 'Saved'>('Published')

  const mine = useAsync(async () => (profile ? myWorlds() : []), [profile?.id])
  const saved = useAsync(
    async () => (profile ? listFavouriteWorlds(profile.id) : []),
    [profile?.id],
  )
  const genres = useAsync(worldGenres, [])

  const drafts = (mine.data ?? []).filter((s) => !s.is_published)
  const published = (mine.data ?? []).filter((s) => s.is_published)
  const visits = published.reduce((sum, world) => sum + (world.visit_count ?? 0), 0)

  const shelves = {
    Published: published,
    Drafts: drafts,
    Saved: saved.data ?? [],
  } as const
  const shown = shelves[shelf]
  const loading = shelf === 'Saved' ? saved.loading : mine.loading

  return (
    <Page className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Library</h1>
          <p className="mt-1.5 text-muted">
            Everything you made and everything you saved.
            {visits > 0 && ` ${formatCount(visits)} visits to your Worlds so far.`}
          </p>
        </div>
      </header>

      {/* Three shelves, one at a time, rather than three stacked sections you
          scroll past to reach the one you wanted. */}
      <div className="grid grid-cols-3 gap-2.5">
        {(['Published', 'Drafts', 'Saved'] as const).map((name) => (
          <StatTile
            key={name}
            value={formatCount(shelves[name].length)}
            label={
              name === 'Published' ? 'Published'
                : name === 'Drafts' ? 'Drafts' : 'Saved'
            }
            active={shelf === name}
            onClick={() => setShelf(name)}
          />
        ))}
      </div>

      {mine.error && <ErrorState message={mine.error} onRetry={mine.reload} />}
      {saved.error && shelf === 'Saved' && <ErrorState message={saved.error} onRetry={saved.reload} />}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2].map((i) => <SpaceCardSkeleton key={i} />)}
        </div>
      )}

      {!loading && !shown.length && (
        <Card>
          <EmptyState
            mood="emptyBox"
            title={
              shelf === 'Published' ? 'Nothing published'
                : shelf === 'Drafts' ? 'No drafts' : 'Nothing saved yet'
            }
            body={
              shelf === 'Published'
                ? 'A World you have published shows up here. They are built in Creator and played in the Launcher.'
                : shelf === 'Drafts'
                  ? 'A World you have not published yet waits here.'
                  : 'Star a World and it lands here so you can find it again.'
            }
            action={
              shelf === 'Saved'
                ? <Button variant="subtle" to="/discover" icon={faStar}>Go find some</Button>
                : <Button to="/download" icon={faPlus}>Get Creator</Button>
            }
          />
        </Card>
      )}

      {!!shown.length && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((world) => (
            <div key={world.id} className="group/tile relative">
              <WorldCard world={world} genres={genres.data ?? undefined} />

              {shelf !== 'Saved' && (
                <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/tile:opacity-100">
                  <Link
                    to={`/create/worlds/${world.id}`}
                    aria-label={`Configure ${world.name}`}
                    title="Configure"
                    className={cn('grid h-8 w-8 place-items-center', overlayButton)}
                  >
                    <FontAwesomeIcon icon={faSliders} />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </Page>
  )
}
