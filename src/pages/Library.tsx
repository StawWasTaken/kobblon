import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  faStar, faSliders, faPlus, faCloudArrowUp, faPenRuler, faBookmark, faEye,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Page } from '@/components/layout/AppShell'
import { BrowseRail, BrowseFrame, BrowseHeading } from '@/components/browse/BrowseRail'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, SpaceCardSkeleton } from '@/components/ui/States'
import { WorldCard } from '@/components/worlds/WorldCard'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { listFavouriteWorlds, myWorlds, worldGenres } from '@/lib/api'
import { useTitle } from '@/hooks/useTitle'
import { overlayButton } from '@/lib/overlay'

type Shelf = 'Published' | 'Drafts' | 'Saved'

/**
 * The three shelves, each said in its own words.
 *
 * The page used to carry three number tiles that were also the switch, which
 * is two jobs in one control: a count that is pressable reads as a filter
 * and a filter that counts reads as a statistic, and neither one wins. The
 * rail counts and switches the way it does on the Catalog, Discover, People
 * and Settings, and the numbers worth standing alone - what the published
 * ones have come to - stand alone above it.
 */
const SHELVES: { name: Shelf; note: string; empty: { title: string; body: string } }[] = [
  {
    name: 'Published',
    note: 'Out there, and anybody can play them.',
    empty: {
      title: 'Nothing published',
      body: 'A World you have published shows up here. They are built in Workspace and played in the Launcher.',
    },
  },
  {
    name: 'Drafts',
    note: 'Yours alone until you publish them.',
    empty: {
      title: 'No drafts',
      body: 'A World you have not published yet waits here, and nobody else can see it.',
    },
  },
  {
    name: 'Saved',
    note: 'Somebody else built these; you kept them.',
    empty: {
      title: 'Nothing saved yet',
      body: 'Star a World and it lands here so you can find it again.',
    },
  },
]

/** A number with its name under it, for the two facts the page is about. */
function Fact({ icon, value, label }: { icon: typeof faEye; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Glyph icon={icon} className="text-sm text-brand-bright" />
      <span>
        <span className="block font-display text-lg font-extrabold leading-none tabular-nums">
          {value}
        </span>
        <span className="block text-xs text-muted">{label}</span>
      </span>
    </div>
  )
}

export default function Library() {
  useTitle('Library')
  const { profile } = useAuth()
  const [shelf, setShelf] = useState<Shelf>('Published')

  const mine = useAsync(async () => (profile ? myWorlds() : []), [profile?.id])
  const saved = useAsync(
    async () => (profile ? listFavouriteWorlds(profile.id) : []),
    [profile?.id],
  )
  const genres = useAsync(worldGenres, [])

  const drafts = (mine.data ?? []).filter((one) => !one.is_published)
  const published = (mine.data ?? []).filter((one) => one.is_published)
  const visits = published.reduce((sum, one) => sum + (one.visit_count ?? 0), 0)

  const shelves: Record<Shelf, typeof published> = {
    Published: published,
    Drafts: drafts,
    Saved: saved.data ?? [],
  }
  const shown = shelves[shelf]
  const here = SHELVES.find((one) => one.name === shelf)!
  const loading = shelf === 'Saved' ? saved.loading : mine.loading
  /* A count is a lie while the list is still arriving, so the rail shows a
     dash until it knows - the same rule the stat tiles were written with. */
  const count = (which: Shelf) => (
    (which === 'Saved' ? saved.loading : mine.loading) ? null : shelves[which].length
  )

  return (
    <Page className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Library</h1>
          <p className="mt-1 text-sm text-muted">Everything you made and everything you saved.</p>
        </div>

        {/* The two numbers that are about the whole shelf rather than about
            whichever one is open, so they sit outside the switch. */}
        <div className="flex items-center gap-6">
          <Fact icon={faCloudArrowUp} value={formatCount(published.length)} label="published" />
          <Fact icon={faEye} value={formatCount(visits)} label="visits" />
        </div>
      </header>

      <BrowseFrame
        rail={
          <BrowseRail
            label="Your shelves"
            items={[
              { value: 'Published' as const, label: 'Published', icon: faCloudArrowUp, count: count('Published') },
              { value: 'Drafts' as const, label: 'Drafts', icon: faPenRuler, count: count('Drafts') },
              { value: 'Saved' as const, label: 'Saved', icon: faBookmark, count: count('Saved') },
            ]}
            value={shelf}
            onChange={setShelf}
            foot={
              /* Where a World comes from, at the foot of the rail - but not
                 while the shelf is empty, because the empty state is already
                 saying it louder and two Get Workspace buttons on one screen
                 is a page arguing with itself. */
              !shown.length ? null : (
              <Card className="p-4">
                <p className="text-sm font-bold">Worlds are built in Workspace</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Build it on your machine, publish it, and it appears here.
                </p>
                <Button size="sm" variant="subtle" to="/download" icon={faPlus} className="mt-3">
                  Get Workspace
                </Button>
              </Card>
              )
            }
          />
        }
      >
        <BrowseHeading
          title={shelf}
          note={loading ? 'Looking…' : `${formatCount(shown.length)} · ${here.note}`}
        />

        {mine.error && <ErrorState message={mine.error} onRetry={mine.reload} />}
        {saved.error && shelf === 'Saved' && (
          <ErrorState message={saved.error} onRetry={saved.reload} />
        )}

        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <SpaceCardSkeleton key={i} />)}
          </div>
        )}

        {!loading && !shown.length && !mine.error && (
          <Card>
            <EmptyState
              mood="emptyBox"
              title={here.empty.title}
              body={here.empty.body}
              action={
                shelf === 'Saved'
                  ? <Button variant="subtle" to="/discover" icon={faStar}>Go find some</Button>
                  : <Button to="/download" icon={faPlus}>Get Workspace</Button>
              }
            />
          </Card>
        )}

        {!!shown.length && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
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
                      <Glyph icon={faSliders} />
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </BrowseFrame>
    </Page>
  )
}
