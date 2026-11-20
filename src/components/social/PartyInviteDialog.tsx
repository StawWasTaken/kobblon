import { useState } from 'react'
import { faCheck, faMagnifyingGlass, faUserPlus } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { inviteToParty, peopleList, type PersonRow } from '@/lib/api'
import { avatarOf, nameOf } from '@/lib/avatars'

/*
 * Asking people in.
 *
 * Your friends, a box to find one, and a button each. There is no party
 * object to make first - `invite_to_party` makes one around you if you have
 * none, which is why the empty state of the panel behind this is a single
 * line and not a "Start a party" button that would do nothing else.
 *
 * People already with you are not in the list. A row whose button says
 * "Already here" is a row somebody reads twice.
 */
export function PartyInviteDialog({ me, already, full, onClose }: {
  me: string
  /** Who is in the party now, so they are not offered again. */
  already: string[]
  /** The party is at its cap; the list reads, nobody can be asked. */
  full?: boolean
  onClose: () => void
}) {
  const say = useToast()
  const [term, setTerm] = useState('')
  const [asked, setAsked] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const friends = useAsync(async () => peopleList(me, 'friends'), [me])

  const shown = (friends.data ?? [])
    .filter((one) => !already.includes(one.id))
    .filter((one) => {
      const looking = term.trim().toLowerCase()
      if (!looking) return true
      return nameOf(one).toLowerCase().includes(looking)
        || one.username.toLowerCase().includes(looking)
    })

  const ask = async (who: PersonRow) => {
    setBusy(who.id)
    try {
      await inviteToParty(who.id)
      setAsked((all) => [...all, who.id])
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Ask somebody in"
      size="sm"
      footer={<Button variant="subtle" onClick={onClose}>Done</Button>}
    >
      {full ? (
        <p className="text-sm text-danger">Your party is full.</p>
      ) : (
        <>
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search"
            icon={faMagnifyingGlass}
          />

          <div className="mt-3 max-h-[18rem] space-y-1 overflow-y-auto kob-scroll">
            {friends.loading && [0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}

            {!friends.loading && !shown.length && (
              <p className="py-6 text-center text-sm text-muted">
                {friends.data?.length ? 'Nobody by that name.' : 'No friends yet.'}
              </p>
            )}

            {shown.map((one) => {
              const done = asked.includes(one.id)
              return (
                <div
                  key={one.id}
                  className="flex items-center gap-2.5 rounded-xl border-2 border-ink-line bg-ink-raised p-2"
                >
                  <Avatar src={avatarOf(one)} personId={one.id} name={nameOf(one)} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{nameOf(one)}</span>
                    <span className="block truncate text-xs text-muted">@{one.username}</span>
                  </span>
                  {done ? (
                    <span className="flex shrink-0 items-center gap-1.5 px-2 text-xs font-bold text-yes-bright">
                      <Glyph icon={faCheck} className="text-tiny" />
                      Asked
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="brand"
                      icon={faUserPlus}
                      loading={busy === one.id}
                      onClick={() => void ask(one)}
                    >
                      Invite
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Dialog>
  )
}
