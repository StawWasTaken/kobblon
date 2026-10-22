/* The hover card behind a friend's face, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { FriendPeek } from '@/components/social/FriendPeek'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import '@/index.css'

const people = [
  { id: '1', username: 'okayCooki3', display_name: 'okayCooki3', content_id: 1, is_online: false },
  { id: '2', username: 'johndoe', display_name: 'JohnDoe', content_id: 2, is_online: true },
  { id: '3', username: 'foolish', display_name: 'Foolish', content_id: 3, is_online: true, in_space_id: 'x' },
]

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink p-20 text-white">
      <div className="grid grid-cols-3 gap-x-8 gap-y-7">
        {people.map((person) => (
          <FriendPeek key={person.id} friend={person}>
            <div className="flex flex-col items-center gap-2.5 text-center">
              <PersonAvatar person={person} size="2xl" className="mx-auto h-20 w-20" />
              <span className="text-sm font-semibold text-white/80">{person.display_name}</span>
            </div>
          </FriendPeek>
        ))}
      </div>
    </div>
  </MemoryRouter>,
)
