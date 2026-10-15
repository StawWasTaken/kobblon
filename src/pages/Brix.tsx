import { useMemo, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import {
  faArrowDown, faArrowUp, faGift, faReceipt, faStore,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Choices } from '@/components/ui/Choices'
import { ErrorState } from '@/components/ui/States'
import { Balance } from '@/components/money/Balance'
import { Transactions } from '@/components/money/Transactions'
import { CurrencyMark } from '@/components/brand/Currency'
import { GuestGate } from '@/components/ui/GuestGate'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { myTransactions } from '@/lib/api'
import { currency, movementWords } from '@/lib/currency'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/*
 * Where your money went.
 *
 * Settings is for changing things about your account; this is for reading
 * what has happened to it, which is a different job and deserves its own
 * address. The whole thing is your own: the function behind it only ever
 * looks at whoever is asking.
 */
const ranges = [
  { value: '7', label: 'Last week' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
  { value: '0', label: 'Everything' },
] as const

const kinds = [
  { value: 'all', label: 'Everything' },
  { value: 'in', label: 'Coming in' },
  { value: 'out', label: 'Going out' },
] as const

type Range = (typeof ranges)[number]['value']
type Side = (typeof kinds)[number]['value']

/** One line of the summary: what a kind of movement added up to. */
function Line({ label, amount, muted }: { label: string; amount: number; muted?: boolean }) {
  return (
    <div className="flex items-center gap-4 border-b border-ink-line/70 py-2.5 last:border-0">
      <span className={cn('min-w-0 flex-1 truncate text-sm', muted ? 'text-muted' : '')}>
        {label}
      </span>
      <span className="inline-flex items-center gap-1 font-display text-sm font-extrabold tabular-nums">
        <CurrencyMark className="h-[0.85em] w-[0.85em]" />
        {formatCount(Math.abs(amount))}
      </span>
    </div>
  )
}

export default function Brix() {
  useTitle(currency.plural)
  const { profile } = useAuth()

  const [range, setRange] = useState<Range>('30')
  const [side, setSide] = useState<Side>('all')

  const rows = useAsync(
    async () => (profile ? myTransactions({ days: Number(range) }) : []),
    [profile?.id, range],
  )

  const shown = (rows.data ?? []).filter((row) => (
    side === 'all' ? true : side === 'in' ? row.amount > 0 : row.amount < 0
  ))

  /*
   * The summary is worked out from the same rows the list is drawn from, so
   * the two can never disagree with each other.
   */
  const summary = useMemo(() => {
    const incoming = new Map<string, number>()
    const outgoing = new Map<string, number>()

    for (const row of rows.data ?? []) {
      const into = row.amount > 0 ? incoming : outgoing
      into.set(row.kind, (into.get(row.kind) ?? 0) + row.amount)
    }

    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0)
    return {
      incoming: [...incoming.entries()].sort((a, b) => b[1] - a[1]),
      outgoing: [...outgoing.entries()].sort((a, b) => a[1] - b[1]),
      inTotal: sum(incoming),
      outTotal: sum(outgoing),
    }
  }, [rows.data])

  return (
    <Page className="space-y-5">
      <PageHeader
        kicker={currency.plural}
        icon={faReceipt}
        title="My transactions"
        lead={`Everything that has moved on your account, and what it was for.`}
        actions={
          <>
            <GuestGate action="redeem codes">
              <Button icon={faGift} to="/brix/codes">Redeem a code</Button>
            </GuestGate>
            <Button variant="subtle" icon={faStore} to="/style">
              Spend {currency.plural}
            </Button>
          </>
        }
        aside={
          <div className="rounded-2xl border border-ink-line bg-ink-raised px-5 py-4 text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Your balance</p>
            <Balance amount={profile?.pixels ?? 0} size="lg" label={false} className="mt-1" />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Choices
          label="How far back"
          value={range}
          options={ranges.map((one) => ({ value: one.value, label: one.label }))}
          onChange={(next) => setRange(next as Range)}
        />
        <Choices
          label="Which way"
          tone="soft"
          value={side}
          options={kinds.map((one) => ({ value: one.value, label: one.label }))}
          onChange={(next) => setSide(next as Side)}
        />
      </div>

      {rows.error && <ErrorState message={rows.error} onRetry={rows.reload} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        {/* ------------------------------------------------------ summary */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <Glyph icon={faArrowDown} className="text-space-bright" />
            Coming in
          </h2>
          <div className="mt-2">
            {summary.incoming.length
              ? summary.incoming.map(([kind, amount]) => (
                <Line key={kind} label={movementWords(kind)} amount={amount} />
              ))
              : <p className="py-2 text-sm text-muted">Nothing came in.</p>}
            <Line label="Total" amount={summary.inTotal} />
          </div>

          <h2 className="mt-6 flex items-center gap-2 font-display text-lg font-extrabold">
            <Glyph icon={faArrowUp} className="text-danger" />
            Going out
          </h2>
          <div className="mt-2">
            {summary.outgoing.length
              ? summary.outgoing.map(([kind, amount]) => (
                <Line key={kind} label={movementWords(kind)} amount={amount} />
              ))
              : <p className="py-2 text-sm text-muted">Nothing went out.</p>}
            <Line label="Total" amount={summary.outTotal} />
          </div>

          <p className="mt-5 border-t border-ink-line pt-4 text-xs leading-relaxed text-muted">
            {currency.plural} are a number on your account for use inside Kobblon. They are
            not money, and they cannot be cashed out.
          </p>
        </Card>

        {/* --------------------------------------------------------- list */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-ink-line px-5 py-3.5">
            <h2 className="font-display text-lg font-extrabold">Every movement</h2>
            <p className="text-xs text-muted">
              {shown.length} {shown.length === 1 ? 'line' : 'lines'}
            </p>
          </div>

          <Transactions
            rows={shown}
            loading={rows.loading}
            empty={
              side === 'all'
                ? 'Nothing has moved in this stretch.'
                : side === 'in' ? 'Nothing came in.' : 'Nothing went out.'
            }
          />
        </Card>
      </div>
    </Page>
  )
}
