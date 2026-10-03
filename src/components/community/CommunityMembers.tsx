import { Link } from 'react-router-dom'
import { faCheck, faGavel, faUserMinus, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import {
  answerJoinRequest, listCommunityRanks, listCommunityRequests, listCommunityRoster,
  removeMember, setMemberRank,
} from '@/lib/api'
import { timeAgo } from '@/lib/format'
import type { CommunityOverview } from '@/types/db'
import { avatarOf } from '@/lib/avatars'
import { profileLink } from '@/lib/links'
import { NameMarks } from '@/components/brand/Verified'
import { LivePresenceLabel } from '@/components/ui/PersonAvatar'

export function CommunityMembers({
  communityId, ownerId, rights, onChanged,
}: {
  communityId: string
  ownerId: string
  rights: CommunityOverview | null
  onChanged: () => void
}) {
  const toast = useToast()
  const roster = useAsync(() => listCommunityRoster(communityId), [communityId])
  const ranks = useAsync(() => listCommunityRanks(communityId), [communityId])
  const requests = useAsync(
    async () => (rights?.can_manage_members ? listCommunityRequests(communityId) : []),
    [communityId, rights?.can_manage_members],
  )

  const guard = async (run: () => Promise<void>) => {
    try {
      await run()
      roster.reload()
      requests.reload()
      onChanged()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {rights?.can_manage_members && !!requests.data?.length && (
        <section>
          <h3 className="mb-3 font-display text-lg font-extrabold">
            Waiting to join ({requests.data.length})
          </h3>
          <Card className="overflow-hidden">
            <ul>
              {requests.data.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center gap-3 border-b border-ink-line/70 px-4 py-3 last:border-0"
                >
                  <Avatar src={avatarOf(person)} personId={person.id} name={person.display_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link to={profileLink(person)} className="block truncate font-bold hover:underline">
                      {person.display_name}
                    </Link>
                    <p className="text-xs text-muted">asked {timeAgo(person.created_at)}</p>
                  </div>
                  <Button
                    size="sm"
                    icon={faCheck}
                    onClick={() => guard(() => answerJoinRequest(communityId, person.id, true))}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={faXmark}
                    aria-label={`Decline ${person.display_name}`}
                    onClick={() => guard(() => answerJoinRequest(communityId, person.id, false))}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section>
        <h3 className="mb-3 font-display text-lg font-extrabold">Members</h3>

        {roster.loading && (
          <Card className="space-y-2 p-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
          </Card>
        )}

        {!!roster.data?.length && (
          <Card className="overflow-hidden">
            <ul>
              {roster.data.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center gap-3 border-b border-ink-line/70 px-4 py-3 last:border-0"
                >
                  <Link to={profileLink(member)} className="shrink-0">
                    <Avatar src={avatarOf(member)} personId={member.id} name={member.display_name} size="md" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={profileLink(member)}
                      className="flex items-center gap-1.5 truncate font-bold hover:underline"
                    >
                      <span className="truncate">{member.display_name}</span>
                      <NameMarks person={member} className="text-xs" />
                    </Link>
                    <LivePresenceLabel person={member} />
                  </div>

                  {rights?.can_manage_ranks && member.id !== ownerId ? (
                    <>
                      <label className="sr-only" htmlFor={`rank-${member.id}`}>
                        Rank for {member.display_name}
                      </label>
                      <Select
                        label={`Rank for ${member.display_name}`}
                        value={member.rank_id ?? ''}
                        onChange={(next) => guard(() => setMemberRank(communityId, member.id, next))}
                        className="w-44"
                        align="right"
                        options={(ranks.data ?? []).map((rank) => ({
                          value: rank.id,
                          label: rank.name,
                          note: String(rank.rank),
                        }))}
                      />
                    </>
                  ) : (
                    member.rank_name && <Badge tone="brand">{member.rank_name}</Badge>
                  )}

                  {rights?.can_manage_members && member.id !== ownerId && (
                    <div className="flex gap-1">
                      <Tooltip label="Remove from the Community" side="top">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={faUserMinus}
                          aria-label={`Remove ${member.display_name}`}
                          onClick={() => guard(() => removeMember(communityId, member.id))}
                        />
                      </Tooltip>
                      <Tooltip label="Remove and ban" side="top">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={faGavel}
                          aria-label={`Ban ${member.display_name}`}
                          onClick={() => guard(() => removeMember(communityId, member.id, true))}
                        />
                      </Tooltip>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}
