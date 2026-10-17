import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/States'
import { GuestGate } from '@/components/ui/GuestGate'
import { NewCommunityProvider, useNewCommunity } from '@/components/community/NewCommunityDialog'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { listMemberCommunities } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Emblem } from '@/components/community/Emblem'
import { communityLink } from '@/lib/links'

/** A row in the rail: emblem, name, how many are in it. */
function RailRow({
  community, name, icon, members, note, active,
}: {
  community: { slug: string; content_id?: number | null }
  name: string
  icon: string | null
  members: number
  note?: string
  active: boolean
}) {
  return (
    <Link
      to={communityLink(community)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-2 py-2 transition-colors',
        active ? 'bg-brand/20' : 'hover:bg-ink-hover',
      )}
    >
      <Emblem src={icon} name={name} className="h-10 w-10 text-xs" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-link">{name}</span>
        <span className="block text-xs text-muted">
          {formatCount(members)} members{note && ` · ${note}`}
        </span>
      </span>
    </Link>
  )
}

/**
 * The Communities you are in, kept beside every Community page so you can move
 * between them without going back to the browse page first.
 */
export function CommunityRail() {
  const openNew = useNewCommunity()
  const { profile } = useAuth()
  // Either address form points at the same Community, so both are matched.
  const path = useLocation().pathname
  const activeId = Number(path.match(/^\/c\/(\d+)(\/|$)/)?.[1] ?? NaN)
  const activeSlug = path.match(/^\/c\/(?!\d+(?:\/|$))([^/]+)/)?.[1] ?? ''
  const [term, setTerm] = useState('')

  const mine = useAsync(
    async () => (profile ? listMemberCommunities(profile.id) : []),
    [profile?.id],
  )

  const shown = (mine.data ?? []).filter((c) =>
    c.name.toLowerCase().includes(term.trim().toLowerCase()))

  return (
    <aside
      className="sticky kob-under-bar kob-under-bar-tall hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-ink-line px-3 pb-6 pt-4 lg:flex kob-scroll"
      aria-label="My Communities"
    >
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="font-display text-base font-extrabold">Communities</h2>
        <Link to="/communities" className="text-xs font-bold text-link hover:underline">
          See All
        </Link>
      </div>

      <Input
        icon={faMagnifyingGlass}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search My Communities"
        aria-label="Search My Communities"
      />

      <div className="mt-2">
        {mine.loading && (
          <div className="space-y-2 p-1">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        )}

        {!mine.loading && !mine.data?.length && (
          <p className="px-2 py-5 text-sm text-muted">You have not joined any yet.</p>
        )}

        {shown.map((community) => (
          <RailRow
            key={community.id}
            community={community}
            name={community.name}
            icon={community.icon_url}
            members={community.member_count}
            note={community.role === 'member' ? undefined : community.role}
            active={community.content_id === activeId || community.slug === activeSlug}
          />
        ))}
      </div>

      {/* Sits under the list, the way it does on the pages this borrows from,
          rather than pinned to the bottom of the window. */}
      <div className="mt-3 px-1">
        <GuestGate action="make a Community">
          <Button variant="subtle" block onClick={openNew} disabled={!profile}>
            Create Community
          </Button>
        </GuestGate>
      </div>
    </aside>
  )
}

/** Rail on the left, the page itself beside it. Wraps every Community route. */
export function CommunityShell() {
  return (
    <NewCommunityProvider>
      <div className="flex items-start">
        <CommunityRail />
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </NewCommunityProvider>
  )
}
