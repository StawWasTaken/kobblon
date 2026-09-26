/*
 * The staff panel's pieces, drawn against stubbed answers.
 *
 * Not a second implementation: it imports the page's own sections. The point
 * is to see the four of them without an admin account and without a
 * database, because the alternative is finding out a panel is unreadable by
 * using it on somebody's real account.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { PersonRow, AnnounceSection, WordsSection } from '@/pages/Admin'
import type { StaffPerson } from '@/lib/api'

/*
 * Four accounts covering every shape the row has to take, because the
 * differences are the whole design: staff show no Suspend and no Delete, a
 * suspended account offers to lift it rather than apply it again, and a
 * guest is marked so nobody wonders why a notification went nowhere.
 */
const people: StaffPerson[] = [
  { id: '1', username: 'stawrer', display_name: 'Staw', avatar_url: null, content_id: 1001,
    pixels: 128400, is_verified: true, is_moderator: true, is_suspended: false,
    is_admin: true, is_guest: false, created_at: '2026-01-04T00:00:00Z' },
  { id: '2', username: 'previewer', display_name: 'A Normal Person', avatar_url: null,
    content_id: 1042, pixels: 250, is_verified: false, is_moderator: false,
    is_suspended: false, is_admin: false, is_guest: false, created_at: '2026-08-01T00:00:00Z' },
  { id: '3', username: 'troublemaker', display_name: 'Trouble', avatar_url: null,
    content_id: 1099, pixels: 0, is_verified: false, is_moderator: false,
    is_suspended: true, is_admin: false, is_guest: false, created_at: '2026-09-20T00:00:00Z' },
  { id: '4', username: 'guest-8812', display_name: null, avatar_url: null,
    content_id: 1127, pixels: 10, is_verified: false, is_moderator: false,
    is_suspended: false, is_admin: false, is_guest: true, created_at: '2026-09-26T00:00:00Z' },
]
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen space-y-10 bg-ink p-8 text-white">
        <section className="space-y-3">
          <h2 className="font-display text-lg">People</h2>
          {people.map((person) => (
            <PersonRow key={person.id} person={person} onChanged={() => {}} />
          ))}
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-lg">Announce</h2>
          <AnnounceSection />
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-lg">Words</h2>
          <WordsSection />
        </section>

      </div>
    </ToastProvider>
  </MemoryRouter>,
)
