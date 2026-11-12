/*
 * The notifications card on its own, with rows made up on the spot.
 *
 * The panel reads Supabase and measures the bell it came out of, so the
 * card was only ever lookable-at by signing in and having something to be
 * notified about. This mounts the card instead: two widths, so the header
 * that used to collide with its own tabs on a phone is visible here.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { NotificationsCard } from '@/components/social/NotificationsPanel'
import type { Notification } from '@/types/db'
import '@/index.css'

const hours = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString()

const who = (name: string) => ({ id: name, display_name: name, username: name })

const rows = [
  { kind: 'friend_request', actor: who('HaczkyEndre'), created_at: hours(0.2), is_read: false },
  { kind: 'friend_request', actor: who('okayCooki3'), created_at: hours(1), is_read: false },
  { kind: 'space_visit', actor: who('Guest50929'), created_at: hours(3), is_read: false,
    space: { name: 'First Ground', slug: 'first-ground' } },
  { kind: 'message', actor: who('stawrer'), created_at: hours(20), is_read: true },
  { kind: 'world_updated', actor: who('Kobblon'), created_at: hours(26), is_read: true,
    world: { name: 'Gun Game', content_id: 'x' }, body: 'new map' },
  { kind: 'content_removed', actor: null, created_at: hours(70), is_read: true,
    body: 'A picture you uploaded was taken down for breaking the rules' },
  { kind: 'forum_reply', actor: who('okayCooki3'), created_at: hours(96), is_read: true,
    body: 'replied to "What should the Launcher look like"' },
].map((row, i) => ({ id: String(i), actor_id: row.actor?.id ?? null, ...row })) as unknown as Notification[]

function Page() {
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  return (
    <div className="min-h-screen bg-ink p-8">
      <div className="flex flex-wrap items-start gap-10">
        <NotificationsCard rows={rows} tab={tab} onTab={setTab} onClose={() => {}} onMarkAll={() => {}} />
        <div className="w-[22rem]">
          <p className="mb-3 text-xs text-muted">Nothing in it</p>
          <NotificationsCard rows={[]} tab="all" onTab={() => {}} onClose={() => {}} />
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Page /></MemoryRouter>,
)
