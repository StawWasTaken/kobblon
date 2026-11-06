/*
 * The Community page's new shape, with nothing around it: the ribbon of
 * numbers and the bands that follow it, so they can be looked at without a
 * database.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { CommunityBands } from '@/components/community/CommunityBands'
import { Ribbon, Stat } from '@/components/ui/Band'
import { Card } from '@/components/ui/Card'
import '@/index.css'

const hour = 36e5

const group = {
  id: 'c1', slug: 'kobblon', name: 'Kobblon', member_count: 1240,
  owner_id: 'o1', icon_url: null, banner_url: null, description: null,
  join_policy: 'open', is_verified: true, is_removed: false, content_id: 1,
  created_at: new Date(Date.now() - 400 * 24 * hour).toISOString(), funds: 0,
} as never

const roster = [
  { id: '1', username: 'marri', display_name: 'marri', avatar_url: null, is_online: true, is_verified: true, content_id: 1 },
  { id: '2', username: 'stawrer', display_name: 'Staw', avatar_url: null, is_online: true, in_space_id: 'x', content_id: 2 },
  { id: '3', username: 'builder', display_name: 'builder', avatar_url: null, is_online: true, activity: 'building', content_id: 3 },
  { id: '4', username: 'quietone', display_name: 'quietone', avatar_url: null, is_online: false, content_id: 4 },
  { id: '5', username: 'five', display_name: 'five', avatar_url: null, is_online: false, content_id: 5 },
  { id: '6', username: 'six', display_name: 'six', avatar_url: null, is_online: false, content_id: 6 },
  { id: '7', username: 'seven', display_name: 'seven', avatar_url: null, is_online: true, content_id: 7 },
  { id: '8', username: 'eight', display_name: 'eight', avatar_url: null, is_online: false, content_id: 8 },
] as never[]

const coming = [
  {
    id: 'e1', title: 'Build night', starts_at: new Date(Date.now() + 3 * hour).toISOString(),
    attending_count: 42, community_slug: 'kobblon', content_id: 11,
  },
  {
    id: 'e2', title: 'A rather long event title that will have to be cut short',
    starts_at: new Date(Date.now() + 50 * hour).toISOString(), attending_count: 0,
    community_slug: 'kobblon', content_id: 12,
  },
] as never[]

const allies = [
  { id: 'a1', slug: 'one', name: 'Brickworks', icon_url: null, member_count: 20, content_id: 21 },
  { id: 'a2', slug: 'two', name: 'The Yard', icon_url: null, member_count: 8, content_id: 22 },
  { id: 'a3', slug: 'three', name: 'Nightshift', icon_url: null, member_count: 3, content_id: 23 },
] as never[]

function Demo() {
  return (
    <div className="min-h-screen bg-ink p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <Ribbon>
          <Stat label="Members" value="1,240" />
          <Stat label="Here now" value="4" tone="live" />
          <Stat label="Events" value="2" />
          <Stat label="In the shop" value="0" />
          <Stat label="Started" value="a year ago" />
          <Stat label="Joining" value="Open" />
        </Ribbon>

        <Card className="py-10 text-center text-sm text-muted">Announcement</Card>
        <Card className="py-24 text-center text-sm text-muted">The wall</Card>

        <CommunityBands
          group={group}
          roster={roster}
          coming={coming}
          store={null}
          allies={allies}
          enemies={null}
        />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Demo /></MemoryRouter>,
)
