/*
 * The staff console, whole, against a stubbed database.
 *
 * The pieces preview (`admin-preview`) shows four sections on their own.
 * This is the other question: whether the console reads as one room - the
 * header, the rail, the dashboard it opens on and the machine panel, at the
 * sizes somebody actually works at. It is the page's own component, not a
 * copy: `setSupabaseClient` hands it a client that answers the dozen RPCs
 * this page asks for and nothing else, which is the same door the Workspace
 * uses to supply its own session.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ToastProvider } from '@/components/ui/Toast'
import { setSupabaseClient } from '@/lib/supabase'
import '@/index.css'

const when = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const answers: Record<string, unknown> = {
  my_staff_rank: 'superadmin',
  staff_overview: [{
    reports_open: 7, appeals_open: 2, tickets_open: 13, tickets_urgent: 3,
    screening: 21, people_total: 4820, people_online: 96, joined_today: 148,
    sanctions_week: 11, machine_on: true, machine_waiting: 23,
  }],
  machine_pulse: [{
    is_on: true, mode: 'always', wired: true, net_ready: true, beating: true,
    every: '* * * * *', last_poke_at: when(1), last_decision_at: when(4),
    decided_today: 312, waiting: 23, oldest_minutes: 38,
  }],
  ai_recent: [
    { id: 1, subject: 'avatar item', subject_id: 'a', decision: 'approved', reason: 'A plain hat, nothing on it.', model: 'x', created_at: when(4) },
    { id: 2, subject: 'report', subject_id: 'b', decision: 'unsure', reason: 'Two people arguing; a person should read it.', model: 'x', created_at: when(9) },
    { id: 3, subject: 'asset', subject_id: 'c', decision: 'rejected', reason: 'A logo that is not theirs.', model: 'x', created_at: when(21) },
    { id: 4, subject: 'ticket', subject_id: 'd', decision: 'approved', reason: 'Answered about a refund.', model: 'x', created_at: when(44) },
    { id: 5, subject: 'chat', subject_id: 'e', decision: 'suspended', reason: 'Threats, repeated after a warning.', model: 'x', created_at: when(70) },
  ],
  ai_work: [
    { subject: 'avatar item', name: 'Pink wings', waiting_minutes: 38 },
    { subject: 'asset', name: 'town-square.glb', waiting_minutes: 22 },
    { subject: 'report', name: 'A world called Test', waiting_minutes: 14 },
  ],
  admin_find_people: [
    { id: '1', username: 'stawrer', display_name: 'Staw', avatar_url: null, content_id: 1001,
      pixels: 128400, is_verified: true, is_moderator: true, is_suspended: false,
      is_admin: true, has_staff_badge: true, is_guest: false, created_at: when(60 * 24 * 280),
      is_banned: false, suspended_until: null, past_sanctions: 0 },
    { id: '2', username: 'previewer', display_name: 'A Normal Person', avatar_url: null,
      content_id: 1042, pixels: 250, is_verified: false, is_moderator: false,
      is_suspended: false, is_admin: false, has_staff_badge: false, is_guest: false,
      created_at: when(60 * 24 * 30), is_banned: false, suspended_until: null, past_sanctions: 0 },
    { id: '3', username: 'troublemaker', display_name: 'Trouble', avatar_url: null,
      content_id: 1099, pixels: 0, is_verified: false, is_moderator: false,
      is_suspended: true, is_admin: false, has_staff_badge: false, is_guest: false,
      created_at: when(60 * 24 * 9), is_banned: false,
      suspended_until: new Date(Date.now() + 86_400_000).toISOString(), past_sanctions: 3 },
  ],
}

const table = {
  ai_settings: {
    is_on: true, mode: 'always', after_minutes: 60, when_over: 25,
    may_warn: true, may_suspend: true, model: 'openai/gpt-oss-120b',
    vision_model: '', updated_at: when(200),
  },
}

/* Enough of the client for this page: `rpc`, one `from(...).maybeSingle()`
   and a `functions.invoke` that politely says no. */
const stub = {
  rpc: async (name: string) => ({ data: answers[name] ?? null, error: null }),
  from: (what: string) => {
    const row = { data: (table as Record<string, unknown>)[what] ?? null, error: null }
    const chain: Record<string, unknown> = {}
    for (const step of ['select', 'eq', 'order', 'limit', 'in', 'neq']) {
      chain[step] = () => chain
    }
    chain.maybeSingle = async () => row
    chain.single = async () => row
    chain.then = (go: (value: unknown) => unknown) => go(row)
    return chain
  },
  functions: {
    invoke: async () => ({ data: null, error: new Error('No worker in a preview.') }),
  },
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
} as unknown as SupabaseClient

setSupabaseClient(stub)

/* The page reads `useAuth` for the fallback rank, so it gets a provider -
   it is a page of the site and has every right to expect one. The stub
   answers `my_staff_rank`, which is what actually decides the rank. */
const Admin = (await import('@/pages/Admin')).default
const { AuthProvider } = await import('@/hooks/useAuth')

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <AuthProvider>
      <MemoryRouter initialEntries={['/staff/overview']}>
        <Routes>
          <Route path="/staff/:panel" element={<Admin />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  </ToastProvider>,
)
