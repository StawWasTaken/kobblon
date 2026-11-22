import { Link } from 'react-router-dom'
import { faCube, faGear, faPen } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Flag, LiveFlag } from '@/components/create/HubShapes'
import { editInWorkspace } from '@/lib/app'
import { WorldArt } from '@/components/worlds/WorldArt'
import { formatCount, timeAgo } from '@/lib/format'
import { worldTag } from '@/lib/kinds'
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
      <Link to={`/create/worlds/${worldTag(world.content_id) || world.id}`} className="block">
        {/* The wide picture, because that is what a World wears on its own
            page and in the Launcher - a square here and a cover there is
            two ideas of what a World looks like. */}
        <span className="relative block aspect-video w-full overflow-hidden bg-brand-ink">
          <WorldArt world={world} />
          <span className="absolute left-2 top-2">
            {world.is_published
              ? <LiveFlag />
              : <Flag tone="bg-ink/85 text-white/60" icon={faPen}>Draft</Flag>}
          </span>
        </span>
      </Link>

      <div className="p-3">
        <Link to={`/create/worlds/${worldTag(world.content_id) || world.id}`} className="block truncate font-display text-base font-extrabold hover:underline">
          {world.name}
        </Link>
        <p className="mt-0.5 truncate font-mono text-mini text-muted">
          {world.content_id ? `WLD-${world.content_id}` : 'No number yet'}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {world.is_published
            ? `${formatCount(world.visit_count ?? 0)} ${world.visit_count === 1 ? 'visit' : 'visits'}`
            : 'Not published'}
          {world.updated_at ? ` · saved ${timeAgo(world.updated_at)}` : ''}
        </p>

        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="subtle" className="flex-1" icon={faGear} to={`/create/worlds/${worldTag(world.content_id) || world.id}`}>
            Set it up
          </Button>
          {/*
            * Building happens on the desktop, so this hands the World over
            * rather than pretending a browser tab can open it. If Workspace
            * is not on the machine, it says so instead of doing nothing.
            */}
          <Button
            size="sm"
            variant="ghost"
            icon={faCube}
            onClick={() => { void editInWorkspace(world.id, onMissing) }}
          >
            Open
          </Button>
        </div>
      </div>
    </article>
  )
}
