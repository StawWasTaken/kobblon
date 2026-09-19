import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash, faUserShield } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { deleteCommunityRank, listCommunityRanks, saveCommunityRank } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { CommunityRank } from '@/types/db'

/** Permissions read better in groups than as one long list of switches. */
const groups: { heading: string; permissions: { key: keyof CommunityRank; label: string }[] }[] = [
  {
    heading: 'Wall',
    permissions: [
      { key: 'can_post_wall', label: 'Post on the wall' },
      { key: 'can_moderate_wall', label: 'Remove anyone’s posts' },
    ],
  },
  {
    heading: 'Members',
    permissions: [
      { key: 'can_manage_members', label: 'Accept requests, kick and ban' },
      { key: 'can_manage_ranks', label: 'Change ranks and what they can do' },
    ],
  },
  {
    heading: 'Community',
    permissions: [
      { key: 'can_manage_community', label: 'Edit the Community and its affiliates' },
      { key: 'can_manage_spaces', label: 'Link and unlink Worlds' },
    ],
  },
]

function Toggle({
  on, disabled, onChange, label,
}: {
  on: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40',
        on ? 'bg-brand' : 'bg-ink-hover',
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-4 w-4 rounded-full bg-white transition-[left]',
          on ? 'left-6' : 'left-1',
        )}
      />
    </button>
  )
}

export function RolesEditor({ communityId }: { communityId: string }) {
  const toast = useToast()
  const ranks = useAsync(() => listCommunityRanks(communityId), [communityId])
  const [selected, setSelected] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!selected && ranks.data?.length) setSelected(ranks.data[0].id)
  }, [ranks.data, selected])

  const current = ranks.data?.find((r) => r.id === selected) ?? null
  const isTop = current?.rank === 254

  const guard = async (run: () => Promise<void>) => {
    try {
      await run()
      ranks.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    }
  }

  // The name is edited locally and saved when the field is left. Saving on
  // every keystroke meant deleting the last character tried to store an empty
  // name, which the database refuses outright.
  useEffect(() => {
    setDraftName(current?.name ?? '')
  }, [current?.id, current?.name])

  const commitName = async () => {
    if (!current) return
    const next = draftName.trim()
    if (!next) {
      setDraftName(current.name)
      toast('A role needs a name.', 'error')
      return
    }
    if (next === current.name) return
    await guard(() => saveCommunityRank({
      id: current.id, community_id: communityId, name: next,
    }))
  }

  const create = async () => {
    const rank = Number(number)
    if (!name.trim() || !Number.isInteger(rank) || rank < 1 || rank > 254) {
      toast('A role needs a name and a number from 1 to 254.', 'error')
      return
    }
    setPending(true)
    await guard(async () => {
      await saveCommunityRank({ community_id: communityId, name: name.trim(), rank })
      setName('')
      setNumber('')
      setAdding(false)
    })
    setPending(false)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[15rem_1fr] lg:items-start">
      <Card className="overflow-hidden">
        <ul className="p-1.5">
          {ranks.loading && (
            <li className="space-y-1.5 p-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}
            </li>
          )}

          {ranks.data?.map((rank) => (
            <li key={rank.id}>
              <button
                onClick={() => setSelected(rank.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors',
                  selected === rank.id ? 'bg-brand text-white' : 'text-white/70 hover:bg-ink-hover',
                )}
              >
                <FontAwesomeIcon icon={faUserShield} className="w-4 text-xs opacity-60" />
                <span className="min-w-0 flex-1 truncate">{rank.name}</span>
                <span className="shrink-0 text-xs opacity-60">{rank.rank}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-ink-line p-2">
          <Button size="sm" variant="subtle" block icon={faPlus} onClick={() => setAdding(true)}>
            Create role
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {adding && (
          <Card className="flex flex-wrap items-end gap-3 p-4">
            <Input
              label="Role name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              placeholder="Moderator"
              className="min-w-40 flex-1"
            />
            <Input
              label="Rank"
              type="number"
              min={1}
              max={254}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="100"
              className="w-24"
            />
            <Button loading={pending} onClick={create}>Create</Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </Card>
        )}

        {current && (
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setDraftName(current.name)
                }}
                maxLength={32}
                aria-label="Role name"
                className="h-10 min-w-40 flex-1 rounded-lg border border-ink-line bg-ink-raised px-3 font-display text-lg font-extrabold focus:border-brand-bright"
              />
              <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-brand-deep font-display text-sm font-extrabold">
                {current.rank}
              </span>
              {!isTop && (
                <Button
                  variant="ghost"
                  icon={faTrash}
                  aria-label={`Delete the ${current.name} role`}
                  onClick={() => guard(async () => {
                    await deleteCommunityRank(current.id)
                    setSelected(null)
                  })}
                />
              )}
            </div>

            {isTop && (
              <p className="mt-3 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs leading-relaxed text-[#b9c3ff]">
                Rank 254 always has everything, and the owner keeps every permission
                whatever their rank says. That is what makes it the top of the ladder.
              </p>
            )}

            <div className="mt-5 space-y-5">
              {groups.map((group) => (
                <div key={group.heading}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                    {group.heading}
                  </p>
                  <div className="divide-y divide-ink-line rounded-xl border border-ink-line">
                    {group.permissions.map((permission) => (
                      <div
                        key={permission.key}
                        className="flex items-center justify-between gap-4 px-3.5 py-2.5"
                      >
                        <span className="text-sm text-white/75">{permission.label}</span>
                        <Toggle
                          label={permission.label}
                          on={Boolean(current[permission.key])}
                          disabled={isTop}
                          onChange={(next) =>
                            guard(() => saveCommunityRank({
                              id: current.id,
                              community_id: communityId,
                              [permission.key]: next,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
