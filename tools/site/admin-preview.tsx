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
import { PersonRow, AnnounceSection, WordsSection, ScreenRow } from '@/pages/Admin'
import { WorldMap } from '@/components/staff/WorldMap'
import { NoticeBar } from '@/components/layout/NoticeBar'
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
        {/*
          * Screening, which is the one panel that cannot be seen by opening
          * the console: it is empty until somebody uploads something the
          * screener could not decide. Two rows, one of each kind, with the
          * reason box open on the second - because the reason box is the
          * part that has to fit.
          */}
        {/* Roughly where people are, with dots made up here: the shape of
            the map is the thing that can be wrong, and it does not need a
            database to be looked at. */}
        <section className="space-y-3">
          <h2 className="font-display text-lg">Map</h2>
          <WorldMap
            dots={[
              { zone: 'Europe/Paris', country: 'FR', how_many: 42 },
              { zone: 'America/New_York', country: 'US', how_many: 61 },
              { zone: 'America/Sao_Paulo', country: 'BR', how_many: 18 },
              { zone: 'Asia/Tokyo', country: 'JP', how_many: 9 },
              { zone: 'Africa/Lagos', country: 'NG', how_many: 7 },
              { zone: 'Australia/Sydney', country: 'AU', how_many: 4 },
              { zone: 'Asia/Kolkata', country: 'IN', how_many: 23 },
            ]}
          />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg">Screening</h2>
          <ScreenRow
            picture={null}
            name="Bone Chiller"
            kind="Face"
            description="A face for the spooky season."
            maker="previewer"
            makerLink="/u/previewer"
            when="2026-10-02T10:00:00Z"
            onDecide={async () => {}}
          />
          <ScreenRow
            picture={null}
            name="official looking decal"
            kind="Decal"
            description={'Visit my site\nwww.example.com'}
            maker="troublemaker"
            makerLink="/u/troublemaker"
            when="2026-10-01T09:00:00Z"
            onDecide={async () => {}}
          />
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
