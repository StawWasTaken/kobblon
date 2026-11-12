/*
 * Your own card in the People grid, beside a friend's and a stranger's.
 *
 * People itself reads Supabase and there is none here, so the three cards
 * are mounted with rows made up on the spot. That is the thing worth
 * looking at anyway: whether the card that is you reads as one of the
 * three rather than as a different object.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { faComment, faUser, faUserPlus } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { PersonCard } from '@/components/social/PersonCard'
import type { Profile } from '@/types/db'
import '@/index.css'

const one = (id: string, name: string, handle: string, bio: string) => ({
  id, display_name: name, username: handle, bio,
} as unknown as Profile)

const me = one('1', 'staw', 'stawrer', 'Building Kobblon.')
const mate = one('2', 'okayCooki3', 'okayCooki3', 'hi chat')
const stranger = one('3', 'Guest50929', 'Guest50929', '')

function Page() {
  return (
    <div className="min-h-screen bg-ink p-8">
      <h1 className="mb-4 font-display text-xl font-extrabold">Around now</h1>
      <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        <PersonCard
          person={me}
          square
          bio
          mine
          tag={<span className="text-mini font-extrabold uppercase tracking-wide text-brand-bright">You</span>}
          actions={<Button size="sm" variant="subtle" icon={faUser} to="/u/stawrer">Your profile</Button>}
        />
        <PersonCard
          person={mate}
          square
          bio
          friend
          tag={<span className="text-mini font-extrabold uppercase tracking-wide text-space-bright">Friend</span>}
          actions={
            <>
              <Button size="sm" variant="subtle" icon={faComment}>Message</Button>
              <Button size="sm" variant="ghost" to="/u/okayCooki3">Profile</Button>
            </>
          }
        />
        <PersonCard
          person={stranger}
          square
          bio
          actions={
            <>
              <Button size="sm" icon={faUserPlus}>Add</Button>
              <Button size="sm" variant="ghost" to="/u/Guest50929">Profile</Button>
            </>
          }
        />
      </ul>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <Page />
  </MemoryRouter>,
)
