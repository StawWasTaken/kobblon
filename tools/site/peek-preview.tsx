/* The hover card behind a friend's face, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { FriendPeek } from '@/components/social/FriendPeek'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import '@/index.css'

const marri = {
  id: '22222222-2222-2222-2222-222222222222',
  username: 'marri',
  display_name: 'marri',
  content_id: 1042,
  is_online: false,
  last_seen_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="grid min-h-screen place-items-start bg-ink p-24 text-white">
      <FriendPeek friend={marri}>
        <div className="flex flex-col items-center gap-2 text-center">
          <PersonAvatar person={marri} size="2xl" className="mx-auto h-20 w-20" />
          <span className="text-sm font-semibold text-white/80">{marri.display_name}</span>
        </div>
      </FriendPeek>
    </div>
  </MemoryRouter>,
)
