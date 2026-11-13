import { Link } from 'react-router-dom'
import { faCube } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { editInWorkspace } from '@/lib/app'
import { worldEmblem } from '@/lib/worldart'
import { formatCount, timeAgo } from '@/lib/format'
import type { World } from '@/types/db'

/*
 * A World you are building, on the front of the Creator Hub.
 *
 * Its own file because the Workspace shows the same shelf, and because the
 * Hub's front page is checked on a bare page under `tools/site/` - nothing
 * in here asks who is signed in.
 */

/** One World you are in the middle of: what it looks like, where it stands, the way in. */
export function WorldWork({ world, onMissing }: { world: World; onMissing: () => void }) {
  return (
    <article className="group overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card transition-colors hover:border-brand/60">
      <Link to={`/create/worlds/${world.id}`} className="block">
        <span className="relative block aspect-square w-full overflow-hidden bg-brand-ink">
          <img src={worldEmblem(world)} alt="" className="h-full w-full object-cover" />
          {/* Out in the world, said in the colour Kobblon says alive in. */}
          {world.is_published && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-tiny font-bold text-space-bright backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-space-bright" />
              Live
            </span>
          )}
        </span>
      </Link>

      <div className="p-3">
        <Link to={`/create/worlds/${world.id}`} className="block truncate text-sm font-bold hover:underline">
          {world.name}
        </Link>
        <p className="mt-0.5 truncate text-xs text-muted">
          {world.is_published
            ? `${formatCount(world.visit_count)} ${world.visit_count === 1 ? 'visit' : 'visits'}`
            : 'Not published'}
          {world.updated_at ? ` · saved ${timeAgo(world.updated_at)}` : ''}
        </p>

        <div className="mt-3 flex gap-2">
          {/*
            * Building happens on the desktop, so this hands the World over
            * rather than pretending a browser tab can open it. If Workspace
            * is not on the machine, it says so instead of doing nothing.
            */}
          <Button
            size="sm"
            variant="subtle"
            className="flex-1"
            icon={faCube}
            onClick={() => { void editInWorkspace(world.id, onMissing) }}
          >
            Open
          </Button>
          <Button size="sm" variant="ghost" to={`/create/worlds/${world.id}`}>Set up</Button>
        </div>
      </div>
    </article>
  )
}
