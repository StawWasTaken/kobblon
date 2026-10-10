/*
 * The account standing page's pieces, on their own.
 *
 * The page itself asks the server for the bar, the history and the appeals,
 * so it cannot be mounted here. These are the parts that draw them, with the
 * rows a server would have sent - which is what there is to look at: the
 * bar, the weight bars on each row, and the popup card.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { Card } from '@/components/ui/Card'
import { BehaviourBar, bandLine, bandTone, bandWord } from '@/components/social/standing'
import { Bought, HistoryRow, RowCard } from '@/pages/Standing'
import { TicketCard } from '@/pages/Support'
import type { BehaviourBand, ModerationRow } from '@/types/db'
import { cn } from '@/lib/cn'
import '@/index.css'

const ago = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString()
const ahead = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString()

const base: ModerationRow = {
  key: 'x', violation_id: null, kind: 'decision', action: 'warning', rule: 'spam',
  reason: 'Repeating the same line in six Worlds in a row.',
  target_type: null, target_id: null, blocks: [], by_rank: 'kobby',
  at: ago(2), until: null, is_void: false, void_reason: null,
  counts: true, weight: 9.3,
  appeal_status: null, appeal_body: null, appeal_note: null,
  appeal_at: null, appeal_decided_at: null, appealable: true,
}

const rows: ModerationRow[] = [
  { ...base, key: 'a', violation_id: 11 },
  {
    ...base, key: 'b', violation_id: 12, action: 'suspension', rule: 'harassment',
    by_rank: 'superadmin', at: ago(1), until: ahead(29), weight: 44,
    reason: 'Going after the same person across four Worlds after being told to stop.',
    appeal_status: 'open', appeal_body: 'It was not me, somebody was on my account.',
    appeal_at: ago(1), appealable: false,
  },
  {
    ...base, key: 'c', kind: 'chat', action: 'chat_timeout', by_rank: 'kobby',
    at: ago(4), until: ago(4), weight: 3.2, appealable: false,
    reason: 'Language that goes against the Kobblon guidelines.',
  },
  {
    ...base, key: 'd', violation_id: 14, action: 'feature_block', rule: 'copyright',
    by_rank: 'moderator', at: ago(40), until: ahead(10), blocks: ['upload', 'sell'],
    weight: 20, reason: 'An uploaded texture that was somebody else’s work.',
    appeal_status: 'declined', appeal_body: 'I drew it myself.',
    appeal_note: 'We found the original, dated two years earlier.',
    appeal_at: ago(38), appeal_decided_at: ago(36), appealable: false,
  },
  {
    ...base, key: 'e', violation_id: 15, action: 'content_removed', rule: 'sexual',
    by_rank: 'admin', at: ago(200), weight: 0, counts: false, is_void: true,
    void_reason: 'An appeal was upheld, so this no longer counts against you.',
    reason: 'A World description that went too far.', appealable: false,
  },
]

function Bar({ score, band }: { score: number; band: BehaviourBand }) {
  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Behaviour</p>
          <h2 className={cn('mt-1 font-display text-2xl font-extrabold', bandTone[band])}>
            {bandWord[band]}
          </h2>
        </div>
        <p className={cn('font-display text-4xl font-extrabold tabular-nums', bandTone[band])}>
          {score}<span className="text-xl text-muted">/100</span>
        </p>
      </div>
      <BehaviourBar score={score} band={band} tall />
      <p className="leading-relaxed text-white/70">{bandLine[band]}</p>
      <Bought minutes={score >= 90 ? 5 : score >= 45 ? 10 : 120} />
    </Card>
  )
}

function Everything() {
  const [open, setOpen] = useState<string | null>(null)
  const showing = rows.find((one) => one.key === open) ?? null

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <Bar score={100} band="exemplary" />
      <Bar score={62} band="mixed" />
      <Bar score={14} band="critical" />

      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-ink-line">
          {rows.map((one) => (
            <HistoryRow key={one.key} one={one} onOpen={() => setOpen(one.key)} />
          ))}
        </ul>
      </Card>

      <TicketCard
        username="staw"
        onCancel={() => {}}
        onSend={() => {}}
      />

      {showing && (
        <RowCard one={showing} onClose={() => setOpen(null)} onAppealed={() => setOpen(null)} />
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-dvh bg-ink">
        <Everything />
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
