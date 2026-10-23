/*
 * The two popup cards, with nothing around them.
 *
 * Both are mounted here with no router, no auth provider and no toast
 * provider on purpose: that is how the Workspace mounts them, and it is the
 * mistake this project has made four times. If either throws on this page,
 * a panel over there goes blank instead.
 *
 * `?v=` picks one: ticket, live, void, warn, report.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { TicketCard } from '@/pages/Support'
import { RowCard } from '@/pages/Standing'
import { ReportDialog } from '@/components/social/ReportDialog'
import type { ModerationRow } from '@/types/db'
import '@/index.css'

const hours = (n: number) => new Date(Date.now() + n * 3600_000).toISOString()

const base: ModerationRow = {
  key: 'one',
  violation_id: 42,
  kind: 'chat',
  action: 'chat_timeout',
  rule: 'be_decent',
  rule_ord: 5,
  rule_title: 'Be decent to people',
  rule_body: 'Nobody has to put up with being insulted, followed around, or '
    + 'spoken to that way. Disagreeing is fine; this was not that.',
  gravity: 2,
  evidence: 'go a**y nobody here wants you in this server',
  reason: 'Said in a World chat, to one person, after being asked to stop by '
    + 'the owner of the server. The filter had already starred part of it out '
    + 'and it was sent again anyway.',
  target_type: 'voice',
  target_id: null,
  blocks: [],
  channels: ['chat', 'voice'],
  by_rank: 'kobby',
  at: hours(-30),
  until: hours(18),
  is_void: false,
  void_reason: null,
  counts: true,
  weight: 12,
  timeout_id: 'abc',
  appeal_status: null,
  appeal_body: null,
  appeal_note: null,
  appeal_at: null,
  appeal_decided_at: null,
  appealable: true,
  appeals_used: 0,
  appeal_closes_at: hours(24 * 14),
}

const rows: Record<string, ModerationRow> = {
  live: base,
  void: {
    ...base,
    is_void: true,
    void_reason: 'You were right: the line was quoted at you, not said by you.',
    counts: false,
    weight: 0,
    until: hours(-2),
    appealable: false,
    appeals_used: 1,
    appeal_status: 'upheld',
    appeal_body: 'I was quoting what somebody else had just said to me and '
      + 'asking the owner to deal with it.',
    appeal_note: 'Read the whole transcript. The quote marks are there. Lifted.',
    appeal_decided_at: hours(-1),
  },
  warn: {
    ...base,
    kind: 'decision',
    action: 'warning',
    target_type: 'post',
    channels: [],
    until: null,
    timeout_id: null,
    evidence: null,
    by_rank: 'moderator',
    weight: 4,
    reason: 'A Community wall post that two people reported.',
  },
}

function Preview() {
  const which = new URLSearchParams(location.search).get('v') ?? 'ticket'
  const [open, setOpen] = useState(true)

  return (
    <div className="min-h-dvh bg-ink p-6 text-white">
      <p className="text-sm text-muted">
        popups-preview · {which} · no router, no providers
      </p>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 rounded-xl border border-ink-line bg-ink-card px-4 py-2 text-sm font-bold"
      >
        Open it again
      </button>

      {which === 'ticket' ? (
        <TicketCard
          open={open}
          username="stawrer"
          onClose={() => setOpen(false)}
          onSend={(card) => { console.log(card); setOpen(false) }}
        />
      ) : which === 'report' ? (
        <ReportDialog
          open={open}
          onClose={() => setOpen(false)}
          targetType="space"
          targetId="1"
          targetName="Tower of Hell but Worse"
        />
      ) : open ? (
        <RowCard
          one={rows[which] ?? rows.live}
          onClose={() => setOpen(false)}
          onAppealed={() => {}}
        />
      ) : null}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Preview />)
