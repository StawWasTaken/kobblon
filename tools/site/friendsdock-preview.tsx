/* The friends dock on its own, with a party and a few people. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { FriendsWindow, PartyStrip } from '@/components/chat/FriendsWindow'
import type { Conversation } from '@/types/db'
import '@/index.css'

const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

const person = (over: Partial<Conversation['members'][number]>) => ({
  id: String(Math.random()), username: 'x', display_name: 'X',
  avatar_url: null, is_online: false, in_space_id: null,
  closed_at: null, is_banned: false, ...over,
})

const one = (over: Partial<Conversation>): Conversation => ({
  id: String(Math.random()), title: null, is_group: false,
  last_message_at: ago(20), last_message: null, unread_count: 0,
  members: [], ...over,
})

const conversations: Conversation[] = [
  one({
    members: [person({ username: 'berryhop', display_name: 'berryhop', is_online: true, in_space_id: 'w1' })],
    last_message_at: ago(4), last_message: 'come on', unread_count: 3,
  }),
  one({
    members: [person({ username: 'malicia', display_name: 'Malicia', is_online: true, in_space_id: 'w1' })],
    last_message_at: ago(40),
  }),
  one({
    members: [person({ username: 'noodle', display_name: 'noodle', is_online: true })],
    last_message_at: ago(90), last_message: 'dont mind',
  }),
  one({
    is_group: true, title: 'The Build Team',
    members: [person({ username: 'a' }), person({ username: 'b' }), person({ username: 'c' })],
    last_message_at: ago(140), last_message: 'who has the keys', unread_count: 1,
  }),
  one({
    members: [person({ username: 'rusty', display_name: 'rusty' })],
    last_message_at: ago(4000), last_message: 'alrrr',
  }),
  one({
    members: [person({ username: 'test', display_name: 'test' })],
    last_message_at: ago(9000),
  }),
]

const nothing = () => {}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-dvh bg-ink p-8">
      <div className="flex items-end gap-6">
        <div className="w-80 overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line">
          <PartyStrip
            names={[
              { id: '1', name: 'Staw', avatar: null },
              { id: '2', name: 'girlone', avatar: null },
              { id: '3', name: 'maker', avatar: null },
            ]}
            asked={0}
            going="First Ground"
            onOpen={nothing}
          />
        </div>

        <FriendsWindow
          conversations={conversations}
          loading={false}
          onOpen={nothing}
          onNewGroup={nothing}
          onOpenParty={nothing}
          open
          onToggle={nothing}
        />
      </div>
    </div>
  </MemoryRouter>,
)
