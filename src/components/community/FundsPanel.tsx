import { useState } from 'react'
import { faArrowRight, faHandHoldingDollar } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { CurrencyMark } from '@/components/brand/Currency'
import { Balance } from '@/components/money/Balance'
import { useAsync } from '@/hooks/useAsync'
import { grantCommunityKubes, listCommunityMoney, listCommunityRoster } from '@/lib/api'
import { currency } from '@/lib/currency'
import { avatarOf } from '@/lib/avatars'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Community } from '@/types/db'

/**
 * What a Community has, where it came from, and where it went. Money that
 * cannot be accounted for is money nobody trusts, so every movement shows.
 */
export function FundsPanel({
  group, onChanged,
}: {
  group: Community
  onChanged: () => void
}) {
  const toast = useToast()
  const money = useAsync(() => listCommunityMoney(group.id), [group.id])
  const roster = useAsync(() => listCommunityRoster(group.id), [group.id])

  const [giving, setGiving] = useState(false)
  const [who, setWho] = useState('')
  const [amount, setAmount] = useState('10')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  const give = async () => {
    const value = Math.round(Number(amount) || 0)
    if (!who) { toast('Pick somebody.', 'error'); return }
    if (value < 1) { toast(`Give at least 1 ${currency.name}.`, 'error'); return }

    setPending(true)
    try {
      await grantCommunityKubes(group.id, who, value, note)
      toast('Sent.', 'success')
      setGiving(false)
      setNote('')
      money.reload()
      onChanged()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not go through.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 border-b border-ink-line p-5">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-extrabold">Funds</h3>
          <p className="mt-0.5 text-sm text-muted">
            Everything this Community sells goes in here, and anything it gives out comes out.
          </p>
        </div>

        <Balance amount={group.funds ?? 0} size="lg" label={false} />

        <Button
          icon={faHandHoldingDollar}
          disabled={(group.funds ?? 0) < 1}
          onClick={() => setGiving(true)}
        >
          Give {currency.plural}
        </Button>
      </div>

      {money.loading && <div className="p-5"><Skeleton className="h-20" /></div>}

      {!money.loading && !money.data?.length && (
        <p className="px-5 py-8 text-center text-sm text-muted">
          Nothing has moved yet. Sell something in the marketplace and it lands here.
        </p>
      )}

      {!!money.data?.length && (
        <ul>
          {money.data.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 border-b border-ink-line/70 px-5 py-3 last:border-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {row.kind === 'sale'
                    ? `Sold ${row.note ?? 'something'}`
                    : row.kind === 'grant'
                      ? `Gave ${currency.plural} to ${row.target_display_name ?? 'a member'}`
                      : row.note ?? 'Adjustment'}
                </span>
                <span className="block text-xs text-muted">
                  {timeAgo(row.created_at)}
                  {row.kind === 'grant' && row.note && ` · ${row.note}`}
                  {row.actor_username && row.kind !== 'sale' && ` · by @${row.actor_username}`}
                </span>
              </span>

              <span
                className={cn(
                  'inline-flex items-center gap-1.5 font-display text-sm font-extrabold tabular-nums',
                  row.amount > 0 ? 'text-space-bright' : 'text-white/60',
                )}
              >
                {row.amount > 0 ? '+' : ''}{row.amount}
                <CurrencyMark className="text-xs" />
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={giving}
        onClose={() => setGiving(false)}
        title={`Give ${currency.plural} to a member`}
        description="It comes out of the Community's funds and lands in their balance straight away."
        footer={
          <>
            <Button variant="ghost" onClick={() => setGiving(false)}>Cancel</Button>
            <Button loading={pending} onClick={give} icon={faArrowRight}>Send it</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Who</p>
            <Select
              label="Member"
              value={who}
              onChange={setWho}
              options={(roster.data ?? []).map((member) => ({
                value: member.id,
                label: member.display_name,
                note: member.rank_name ?? undefined,
              }))}
            />
            {!!who && (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                <Avatar
                  src={avatarOf(roster.data?.find((m) => m.id === who))}
                  personId={who}
                  name={roster.data?.find((m) => m.id === who)?.display_name ?? ''}
                  size="xs"
                />
                @{roster.data?.find((m) => m.id === who)?.username}
              </p>
            )}
          </div>

          <Input
            label="How many"
            type="number"
            min={1}
            max={group.funds ?? 0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint={`The Community has ${formatCount(group.funds ?? 0)}.`}
          />

          <Input
            label="What for"
            labelNote="optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder="Made the emblem"
          />
        </div>
      </Dialog>
    </Card>
  )
}
