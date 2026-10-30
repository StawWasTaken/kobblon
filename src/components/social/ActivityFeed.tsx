import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faRocket, faPenToSquare, faDoorOpen, faSeedling } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useAsync } from '@/hooks/useAsync'
import { getRecentActivity } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { timeAgo } from '@/lib/format'
import type { ActivityEvent } from '@/types/db'

const icons: Record<ActivityEvent['kind'], IconDefinition> = {
  space_published: faRocket,
  space_updated: faPenToSquare,
  space_entered: faDoorOpen,
  user_joined: faSeedling,
}

const tones: Record<ActivityEvent['kind'], string> = {
  space_published: 'bg-brand text-white',
  space_updated: 'bg-white/10 text-white/80',
  space_entered: 'bg-space text-white',
  user_joined: 'bg-brand-deep text-white',
}

function Line({ event }: { event: ActivityEvent }) {
  const who = (
    <Link to={`/u/${event.actor_username}`} className="font-semibold text-white hover:underline">
      {event.actor_display_name}
    </Link>
  )
  const space = event.space_slug ? (
    <Link
      to={`/u/${event.actor_username}/${event.space_slug}`}
      className="font-semibold text-link hover:underline"
    >
      {event.space_name}
    </Link>
  ) : null

  switch (event.kind) {
    case 'space_published': return <>{who} published {space}</>
    case 'space_updated': return <>{who} updated {space}</>
    case 'space_entered': return <>{who} entered {space}</>
    default: return <>{who} joined Kobblon</>
  }
}

export function ActivityFeed({ limit = 10, className }: { limit?: number; className?: string }) {
  const { data, error, loading, reload } = useAsync(() => getRecentActivity(limit), [limit])
  const [live, setLive] = useState(0)

  // A new row in activity_events means something actually happened; re-fetch
  // through the RPC so nothing private is ever pulled straight off the table.
  useEffect(() => {
    const channel = supabase
      .channel('activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_events' },
        () => setLive((n) => n + 1))
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (live > 0) reload()
  }, [live, reload])

  if (loading) {
    return (
      <div className={className}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3.5 flex-1" />
          </div>
        ))}
      </div>
    )
  }

  if (error) return <ErrorState message={error} onRetry={reload} />

  if (!data?.length) {
    return (
      <EmptyState
        mood="construction"
        title="Quiet out there"
        body="Nothing has happened on Kobblon yet. Be the reason this list fills up."
      />
    )
  }

  return (
    <ul className={className}>
      {data.map((event) => (
        <li
          key={event.id}
          className="flex animate-slide-up items-center gap-3 border-b border-ink-line/70 px-4 py-3 last:border-0"
        >
          <span className="relative shrink-0">
            <Avatar
              src={event.actor_avatar_url}
              name={event.actor_display_name}
              personId={event.actor_id}
              size="sm"
            />
            <span
              className={`absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full text-[9px] ring-2 ring-ink-card ${tones[event.kind]}`}
            >
              <Glyph icon={icons[event.kind]} />
            </span>
          </span>
          <p className="min-w-0 flex-1 truncate text-sm text-white/70">
            <Line event={event} />
          </p>
          <span className="shrink-0 text-xs text-muted">{timeAgo(event.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}
