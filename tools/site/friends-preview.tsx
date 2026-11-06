/*
 * The one person, at both sizes: the card the friends page and People draw,
 * and the face grid a profile draws, side by side so the two can be checked
 * against each other rather than one at a time in two windows.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { faUserGroup, faInbox, faHeart, faEyeSlash, faBan, faComment, faEllipsis } from '@fortawesome/free-solid-svg-icons'
import { ListTab } from '@/pages/Friends'
import { PersonCard, FaceGrid } from '@/components/social/PersonCard'
import { Button } from '@/components/ui/Button'
import { Glyph } from '@/components/brand/Glyph'
import '@/index.css'

const people = [
  { id: '1', username: 'marri', display_name: 'marri', content_id: 1, is_online: true, best: true, is_verified: true },
  { id: '2', username: 'stawrer', display_name: 'Staw', content_id: 2, is_online: true, in_space_id: 'x' },
  { id: '3', username: 'quietone', display_name: 'A rather long display name', content_id: 3, is_online: false, last_seen_at: new Date(Date.now() - 36e5).toISOString() },
  { id: '4', username: 'builder', display_name: 'builder', content_id: 4, is_online: true, activity: 'building', bio: 'Makes obstacle courses and nothing else. Been here since the first week.' },
  { id: '5', username: 'hushed', display_name: 'hushed', content_id: 5, is_online: true, i_ignore: true },
  { id: '6', username: 'staffer', display_name: 'staffer', content_id: 6, is_online: false, is_admin: true },
]

const dots = (
  <span className="grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-ink-hover hover:text-white">
    <Glyph icon={faEllipsis} />
  </span>
)

function Demo() {
  const [tab, setTab] = useState('Friends')
  const tabs = [
    ['Friends', faUserGroup, 24], ['Requests', faInbox, 2], ['Followers', faHeart, 180],
    ['Following', faHeart, 31], ['Ignored', faEyeSlash, 0], ['Blocked', faBan, 1],
  ] as const

  return (
    <div className="min-h-screen bg-ink p-8 text-white">
      <header className="mb-5 overflow-hidden rounded-3xl border border-ink-line bg-ink-card">
        <div className="flex flex-wrap items-center gap-4 bg-gradient-to-br from-brand/25 via-ink-raised to-ink-raised px-6 py-5">
          <div className="h-16 w-16 shrink-0 rounded-2xl bg-brand-deep ring-2 ring-white/10" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-extrabold sm:text-4xl">My friends</h1>
            <p className="mt-1.5 text-sm text-muted">24 friends, 6 online.</p>
          </div>
          <Button variant="subtle">Find people</Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-ink-line px-2 py-2">
          {tabs.map(([name, icon, count]) => (
            <ListTab
              key={name} icon={icon} name={name} count={count}
              active={tab === name} onClick={() => setTab(name)}
            />
          ))}
        </nav>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((person) => (
          <PersonCard
            key={person.id}
            person={person as never}
            friend
            quiet={person.i_ignore}
            menu={dots}
            actions={(
              <>
                <Button size="sm" variant="subtle" className="flex-1">Profile</Button>
                <Button size="sm" icon={faComment} className="flex-1">Chat</Button>
              </>
            )}
          />
        ))}
      </ul>

      {/* The same people as People draws them: a square picture, their own
          words, and Add rather than Chat. */}
      <h2 className="mb-3 mt-8 font-display text-xl font-extrabold">On People</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {people.slice(0, 3).map((person) => (
          <PersonCard
            key={person.id}
            person={person as never}
            square
            bio
            menu={dots}
            actions={<Button size="sm">Add</Button>}
          />
        ))}
      </ul>

      {/* And the small end of the same design, which is what a profile shows
          before See all. */}
      <h2 className="mb-3 mt-8 font-display text-xl font-extrabold">On a profile</h2>
      <FaceGrid people={people as never} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Demo /></MemoryRouter>,
)
