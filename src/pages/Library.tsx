import { useState } from 'react'
import { faStar, faPenToSquare, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { EmptyState, ErrorState, SpaceCardSkeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { SiteCard } from '@/components/spaces/SiteCard'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { listFavoriteSpaces, listSpacesByOwner, logSpaceUpdate } from '@/lib/api'
import type { Space } from '@/types/db'
import { useTitle } from '@/hooks/useTitle'
import { overlayButton } from '@/lib/overlay'

function UpdateDialog({
  space, onClose, onLogged,
}: {
  space: Space | null
  onClose: () => void
  onLogged: () => void
}) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  const save = async () => {
    if (!space) return
    setPending(true)
    try {
      await logSpaceUpdate(space.id, note.trim())
      toast('Update posted.', 'success')
      setNote('')
      onLogged()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={Boolean(space)}
      onClose={onClose}
      title={space ? `Post an update to ${space.name}` : ''}
      description="Updates show on the public activity feed and count towards the platform total."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={pending} onClick={save}>Post update</Button>
        </>
      }
    >
      <Input
        label="What changed?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        placeholder="Added a guestbook"
      />
    </Dialog>
  )
}

export default function Library() {
  useTitle('Library')
  const { profile } = useAuth()
  const [updating, setUpdating] = useState<Space | null>(null)
  const [shelf, setShelf] = useState<'Published' | 'Drafts' | 'Saved'>('Published')

  const mine = useAsync(
    async () => (profile ? listSpacesByOwner(profile.id, true) : []),
    [profile?.id],
  )
  const saved = useAsync(
    async () => (profile ? listFavoriteSpaces(profile.id) : []),
    [profile?.id],
  )

  const drafts = (mine.data ?? []).filter((s) => !s.is_published)
  const published = (mine.data ?? []).filter((s) => s.is_published)
  const visits = published.reduce((sum, space) => sum + (space.visit_count ?? 0), 0)

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
            {visits > 0 && ` ${formatCount(visits)} visits to your Spaces so far.`}
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
                ? 'Spaces are being replaced by experiences, built in Creator and played in the Launcher.'
                : shelf === 'Drafts'
                  ? 'A Space you have not published yet waits here.'
                  : 'Star a Space and it lands here so you can find it again.'
            }
            action={
              shelf === 'Saved'
                ? <Button variant="subtle" to="/discover" icon={faStar}>Go find some</Button>
                : <Button to="/download" icon={faPlus}>About the Launcher</Button>
            }
          />
        </Card>
      )}

      {!!shown.length && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((space) => (
            <div key={space.id} className="group/tile relative">
              <SiteCard space={space} />

              {shelf !== 'Saved' && (
                <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/tile:opacity-100">
                  {space.is_published && (
                    <button
                      onClick={() => setUpdating(space)}
                      aria-label={`Post an update about ${space.name}`}
                      title="Post an update"
                      className={cn('h-8 w-8', overlayButton)}
                    >
                      <FontAwesomeIcon icon={faPenToSquare} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <UpdateDialog space={updating} onClose={() => setUpdating(null)} onLogged={mine.reload} />
    </Page>
  )
}
