/* The party tab on its own: with a party, with somebody asking, and empty. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { PartyPanel } from '@/components/social/PartyDock'
import type { Party, PartyInvite } from '@/lib/api'
import '@/index.css'

const member = (id: string, name: string) => ({
  user_id: id, username: name.toLowerCase(), display_name: name,
  avatar_url: null, avatar_changed_at: null, is_guest: false,
  joined_at: new Date().toISOString(),
})

const party: Party = {
  id: 'p1',
  leader_id: 'me',
  world_id: 'w1',
  world_name: 'First Ground',
  world_content_id: 1069,
  server_id: 's1',
  going_at: new Date().toISOString(),
  members: [member('me', 'Staw'), member('b', 'girlone'), member('c', 'maker')],
}

const invites: PartyInvite[] = [{
  party_id: 'p2',
  asked_at: new Date().toISOString(),
  asked_by: 'd',
  username: 'rusty',
  display_name: 'rusty',
  avatar_url: null,
  avatar_changed_at: null,
  how_many: 2,
}]

const nothing = () => {}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-dvh bg-ink p-8">
      <div className="flex items-start gap-4 [&>*]:w-80 [&>*]:self-stretch [&>*]:rounded-2xl [&>*]:border-2 [&>*]:border-b-4 [&>*]:border-ink-line [&>*]:bg-ink-card">
        <PartyPanel
          compact
          me="me"
          party={party}
          invites={[]}
          onAccept={nothing}
          onDecline={nothing}
          onLeave={nothing}
          onRemove={nothing}
          onPlay={nothing}
          onInvite={nothing}
          onOpenChat={nothing}
        />
        <PartyPanel
          me="me"
          party={null}
          invites={invites}
          onAccept={nothing}
          onDecline={nothing}
          onLeave={nothing}
          onRemove={nothing}
          onPlay={nothing}
          onInvite={nothing}
          onOpenChat={nothing}
        />
        <PartyPanel
          me="b"
          party={null}
          invites={[]}
          onAccept={nothing}
          onDecline={nothing}
          onLeave={nothing}
          onRemove={nothing}
          onPlay={nothing}
          onInvite={nothing}
          onOpenChat={nothing}
        />
      </div>
    </div>
  </MemoryRouter>,
)
