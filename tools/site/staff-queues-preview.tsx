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
import { TopicLine } from '@/components/staff/ForumQueue'
import type { TicketRow, AppealRow } from '@/lib/api'
import type { ForumTopic } from '@/types/db'
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

/*
 * Three forum rows: a pinned one, a locked one and one that has been taken
 * down. The removed one is the row that matters here - it is the only
 * place on the whole platform that draws a removed topic, so it is the
 * only place the Restore button can be looked at.
 */
const author = {
  author_id: 'f', author_username: 'brickjo', author_name: 'Jo',
  author_avatar: null, author_is_verified: false,
  author_is_admin: false, author_is_moderator: false,
}

const topics: ForumTopic[] = [
  {
    ...author, id: 512, category: 'help', category_name: 'Help',
    title: 'How do I make a door that only opens for one team?',
    body: 'I have the door and the team, I cannot work out the check.',
    images: [], status: 'open', is_pinned: true, is_locked: false,
    is_removed: false, view_count: 412, reply_count: 7, like_count: 12,
    answer_id: 9001, last_post_at: ago(2), created_at: ago(30), liked: false,
  },
  {
    ...author, id: 509, category: 'ideas', category_name: 'Ideas',
    author_username: 'meshsam', author_name: 'Sam',
    title: 'Please let a World belong to a Community',
    body: 'Right now a Community has members and nothing it owns.',
    images: [], status: 'looked-at', is_pinned: false, is_locked: true,
    is_removed: false, view_count: 1840, reply_count: 63, like_count: 211,
    answer_id: null, last_post_at: ago(9), created_at: ago(200), liked: false,
  },
  {
    ...author, id: 498, category: 'general', category_name: 'General',
    author_username: 'nineline', author_name: 'nineline',
    title: 'free brix generator 100% working no scam click here',
    body: 'just go to this site and put your password in',
    images: [], status: 'open', is_pinned: false, is_locked: false,
    is_removed: true, view_count: 96, reply_count: 2, like_count: 0,
    answer_id: null, last_post_at: ago(40), created_at: ago(41), liked: false,
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

      <section className="space-y-2">
        <h2 className="font-display text-lg font-extrabold">Forum</h2>
        <ul className="space-y-2">
          {topics.map((one) => (
            <li key={one.id}>
              <TopicLine
                one={one}
                onPin={() => {}}
                onLock={() => {}}
                onRestore={() => {}}
                onTakeDown={() => {}}
              />
            </li>
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
