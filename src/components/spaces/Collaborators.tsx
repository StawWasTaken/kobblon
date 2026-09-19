import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { faMagnifyingGlass, faXmark, faUserPlus } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { addCollaborator, listCollaborators, removeCollaborator, searchProfiles } from '@/lib/api'
import { avatarOf } from '@/lib/avatars'
import { profileLink } from '@/lib/links'

/**
 * People the owner lets work on a Space. They can change it; they cannot
 * delete it, and they cannot take it over.
 */
export function Collaborators({ spaceId, ownerId, viewerId }: {
  spaceId: string
  ownerId: string
  viewerId?: string
}) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')

  const isOwner = viewerId === ownerId
  const team = useAsync(() => listCollaborators(spaceId), [spaceId])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 250)
    return () => window.clearTimeout(timer)
  }, [term])

  const found = useAsync(
    async () => (adding && debounced ? searchProfiles(debounced, viewerId) : []),
    [adding, debounced, viewerId],
  )

  const guard = async (run: () => Promise<void>) => {
    try {
      await run()
      team.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold">People on this Space</h2>
          <p className="mt-0.5 text-xs text-muted">
            They can edit it. Only you can delete it or hand it on.
          </p>
        </div>
        {isOwner && (
          <Button size="sm" variant="subtle" icon={faUserPlus} onClick={() => setAdding((v) => !v)}>
            Add
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-3 space-y-2">
          <Input
            icon={faMagnifyingGlass}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Find somebody by name"
            aria-label="Find somebody"
          />
          {!!found.data?.length && (
            <ul className="space-y-1">
              {found.data
                .filter((person) => !team.data?.some((member) => member.user_id === person.id))
                .map((person) => (
                  <li key={person.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-hover">
                    <Avatar src={avatarOf(person)} name={person.display_name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{person.display_name}</span>
                      <span className="block truncate text-xs text-muted">@{person.username}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => guard(async () => {
                        await addCollaborator(spaceId, person.id)
                        toast(`${person.display_name} can work on this now.`, 'success')
                        setAdding(false)
                        setTerm('')
                      })}
                    >
                      Add
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {team.loading && <Skeleton className="h-12" />}

      {!team.loading && !team.data?.length && (
        <p className="py-3 text-sm text-muted">Nobody else yet.</p>
      )}

      <ul className="divide-y divide-ink-line">
        {team.data?.map((member) => (
          <li key={member.user_id} className="flex items-center gap-3 py-2.5">
            <Link to={profileLink(member)} className="shrink-0">
              <Avatar src={avatarOf(member)} name={member.display_name} size="sm" />
            </Link>
            <span className="min-w-0 flex-1">
              <Link to={profileLink(member)} className="block truncate text-sm font-bold hover:underline">
                {member.display_name}
              </Link>
              <span className="block truncate text-xs text-muted">@{member.username}</span>
            </span>
            {(isOwner || member.user_id === viewerId) && (
              <Tooltip label={member.user_id === viewerId ? 'Leave this World' : 'Remove'} side="top">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={faXmark}
                  aria-label={`Remove ${member.display_name}`}
                  onClick={() => guard(() => removeCollaborator(spaceId, member.user_id))}
                />
              </Tooltip>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
