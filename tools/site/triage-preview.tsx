/* The report triage card, at two ranks and once already settled. */
import { createRoot } from 'react-dom/client'
import { ReportTriage } from '@/components/staff/ReportTriage'
import type { ReportTicket } from '@/lib/api'
import '@/index.css'

const base: ReportTicket = {
  id: 418,
  target_type: 'asset',
  target_id: '00000000-0000-0000-0000-000000000001',
  reason: 'harassment',
  details: 'The description is aimed at me by name and keeps getting re-uploaded.',
  status: 'open',
  outcome: null,
  handled_note: null,
  created_at: new Date(Date.now() - 52 * 60_000).toISOString(),
  handled_at: null,
  handled_by_username: null,
  reporter_id: 'r',
  reporter_username: 'quietcartographer',
  about_id: 'a',
  about_username: 'brixgoblin',
  about_suspended: false,
  about_suspended_until: null,
  about_muted_until: new Date(Date.now() + 6 * 60_000).toISOString(),
  subject_label: 'Definitely Not A Rude Hat',
  subject_link: '/create/asset/1',
  subject_gone: false,
  past_warnings: 2,
  past_heavy: 1,
  past_mutes: 4,
  other_open: 3,
}

const settled: ReportTicket = {
  ...base,
  id: 404,
  status: 'actioned',
  outcome: 'chat_suspension',
  handled_by_username: 'stawrer',
  handled_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  handled_note: 'Third time this week.',
}

const profile: ReportTicket = {
  ...base,
  id: 420,
  target_type: 'profile',
  reason: 'impersonation',
  subject_label: 'brixgoblin',
  subject_link: '/u/brixgoblin',
  details: 'Using the Kobblon logo as their picture and saying they are staff.',
  about_suspended: true,
  about_suspended_until: new Date(Date.now() + 5 * 86400_000).toISOString(),
  about_muted_until: null,
}

const panel = 'w-[34rem] max-w-full rounded-2xl border border-ink-line bg-ink-raised p-5'

createRoot(document.getElementById('root')!).render(
  <div className="flex min-h-screen flex-wrap items-start justify-center gap-6 bg-ink p-8">
    <div className={panel}>
      <p className="mb-3 text-xs uppercase tracking-wide text-muted">As a moderator</p>
      <ReportTriage ticket={base} rank="moderator" onTake={async () => {}} />
    </div>
    <div className={panel}>
      <p className="mb-3 text-xs uppercase tracking-wide text-muted">As a superadmin, about a profile</p>
      <ReportTriage ticket={profile} rank="superadmin" onTake={async () => {}} />
    </div>
    <div className={panel}>
      <p className="mb-3 text-xs uppercase tracking-wide text-muted">Already settled</p>
      <ReportTriage ticket={settled} rank="admin" onTake={async () => {}} onClose={() => {}} />
    </div>
  </div>,
)
