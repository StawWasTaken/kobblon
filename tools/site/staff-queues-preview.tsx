/*
 * The support queue's rows and the appeals queue's rows, on their own.
 *
 * The panels themselves ask the server, so they cannot be mounted here.
 * These are the parts that draw a row and the thing a row opens, with the
 * rows a server would have sent - which is what there is to look at.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastProvider } from '@/components/ui/Toast'
import { TicketLine, TicketDrawer } from '@/components/staff/SupportQueue'
import { AppealLine, AppealDrawer } from '@/components/staff/AppealsQueue'
import type { TicketRow, AppealRow } from '@/lib/api'
import '@/index.css'

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()

const tickets: TicketRow[] = [
  {
    id: 418, topic: 'safety', subject: 'Someone keeps messaging me after I blocked them',
    status: 'open', first_name: 'Alex', contact_email: 'alex@example.test',
    device: 'phone', wants_human: true, username: 'alexbuilds',
    user_id: 'a', opener: 'They made a second account and started again the same evening.',
    replies: 1, waiting_on_us: true, created_at: ago(3), updated_at: ago(3),
  },
  {
    id: 417, topic: 'bug', subject: 'A world will not load past the loading bar',
    status: 'in_progress', first_name: 'Sam', contact_email: 'sam@example.test',
    device: 'launcher', wants_human: false, username: 'sammakes',
    user_id: 'b', opener: 'It gets to about eighty percent and then stops, every time.',
    replies: 3, waiting_on_us: false, created_at: ago(26), updated_at: ago(5),
  },
  {
    id: 410, topic: 'money', subject: 'I bought Brix and they never arrived',
    status: 'answered', first_name: 'Jo', contact_email: 'jo@example.test',
    device: 'computer', wants_human: false, username: 'joshop',
    user_id: 'c', opener: 'The card was charged twice and neither one showed up.',
    replies: 4, waiting_on_us: false, created_at: ago(70), updated_at: ago(20),
  },
]

const appeals: AppealRow[] = [
  {
    id: 88, status: 'open', body: 'It was a joke between two friends in a private chat and nobody who saw it was upset. I did not know it counted as that and I will not do it again.',
    created_at: ago(96), decision_note: null, decided_at: null, decided_rank: null,
    user_id: 'd', username: 'riverkob', display_name: 'River', avatar_url: null,
    score: 61, band: 'mixed', violation_id: 902, action: 'suspension',
    rule: 'sexual', rule_ord: 5, rule_title: 'Kobblon chat is not for sex', gravity: 3,
    reason: 'Rule 5: Kobblon chat is not for sex. A sexual proposition aimed at the person it was sent to.',
    evidence: 'i wanna take you by your ••••', target_type: 'message', target_id: '9912',
    blocks: [], is_void: false, expires_at: null, decided_on: ago(100),
    by_rank: 'kobby', waiting_hours: 96,
  },
  {
    id: 86, status: 'declined', body: 'I drew the texture myself, I have the file.',
    created_at: ago(300), decision_note: 'We found the original, dated two years earlier.',
    decided_at: ago(280), decided_rank: 'moderator',
    user_id: 'e', username: 'pixeljay', display_name: 'Jay', avatar_url: null,
    score: 84, band: 'good', violation_id: 870, action: 'feature_block',
    rule: 'copyright', rule_ord: 10, rule_title: 'Do not pass off what somebody else made',
    gravity: 1, reason: 'An uploaded texture that was somebody else’s work.',
    evidence: null, target_type: 'asset', target_id: 'abc',
    blocks: ['upload', 'sell'], is_void: false, expires_at: ago(-200), decided_on: ago(320),
    by_rank: 'moderator', waiting_hours: 300,
  },
]

function Everything() {
  const [ticket, setTicket] = useState<TicketRow | null>(tickets[0])
  const [appeal, setAppeal] = useState<AppealRow | null>(null)

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <section className="space-y-2">
        <h2 className="font-display text-lg font-extrabold">Support queue</h2>
        <ul className="space-y-2">
          {tickets.map((one) => (
            <li key={one.id}><TicketLine one={one} onOpen={() => setTicket(one)} /></li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-extrabold">Appeals</h2>
        <ul className="space-y-2">
          {appeals.map((one) => (
            <li key={one.id}><AppealLine one={one} onOpen={() => setAppeal(one)} /></li>
          ))}
        </ul>
      </section>

      {ticket && (
        <TicketDrawer
          one={ticket}
          onClose={() => setTicket(null)}
          onMove={async () => {}}
          onReplied={() => {}}
        />
      )}
      {appeal && (
        <AppealDrawer one={appeal} onClose={() => setAppeal(null)} onDecided={() => {}} />
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <div className="min-h-dvh bg-ink text-white">
      <Everything />
    </div>
  </ToastProvider>,
)
