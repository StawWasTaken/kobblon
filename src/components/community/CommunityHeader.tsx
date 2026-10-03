import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEllipsis, faGear, faRightFromBracket, faLink, faFlag, faUserPlus, faClock,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Menu } from '@/components/ui/Menu'
import { formatCount } from '@/lib/format'
import { asset } from '@/lib/asset'
import { PAGE_WIDTH } from '@/components/layout/AppShell'
import { cn } from '@/lib/cn'
import { Emblem } from '@/components/community/Emblem'
import type { Community, CommunityOverview } from '@/types/db'
import { Verified } from '@/components/brand/Verified'

/**
 * The top of a Community: its cover fading into the page, the emblem sitting
 * over the join, and everything about it that is not a tab.
 */
export function CommunityHeader({
  group, rights, ownerName, pending, onJoin, onUnask, onLeave, onReport,
}: {
  group: Community
  rights: CommunityOverview | null
  ownerName?: string
  pending: boolean
  onJoin: () => void
  /** Taking back a request to join that nobody has answered. */
  onUnask: () => void
  onLeave: () => void
  onReport: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const isMember = Boolean(rights?.my_rank_id)
  const description = group.description ?? ''
  const long = description.length > 220

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused; the address bar still has it.
    }
  }

  return (
    <header className="relative">
      {/* The cover does not stop at an edge, it dissolves into the page. */}
      <div className="absolute inset-x-0 top-0 h-56 overflow-hidden sm:h-72">
        <img
          src={group.banner_url ?? asset('/brand/banner3.png')}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/10" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="relative pt-40 sm:pt-52">
        <div className={cn('mx-auto w-full px-4 sm:px-6', PAGE_WIDTH.narrow)}>
          <div className="flex items-start gap-4">
            <Emblem
              src={group.icon_url}
              name={group.name}
              rounded="rounded-2xl"
              className="h-20 w-20 text-xl shadow-pop sm:h-24 sm:w-24"
            />

            <div className="min-w-0 flex-1 pt-1">
              <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                {group.name}
                {group.is_verified && (
                  <Verified className="text-lg" />
                )}
              </h1>
              {ownerName && (
                <p className="mt-0.5 text-sm text-white/60">
                  By <Link to={`/u/${ownerName}`} className="font-semibold hover:underline">{ownerName}</Link>
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {isMember ? null : (
                rights?.is_banned ? (
                  <Badge tone="warm">Banned</Badge>
                ) : rights?.has_requested ? (
                  /*
                   * Yours to take back. It was a dead button that said
                   * "Requested" and did nothing, which leaves somebody who
                   * changed their mind with no way to say so - Staw: "add
                   * that we can cancel your own request to join a community".
                   */
                  <Button
                    variant="subtle"
                    icon={faClock}
                    loading={pending}
                    onClick={onUnask}
                  >
                    Asked — take it back
                  </Button>
                ) : (
                  <Button icon={faUserPlus} loading={pending} onClick={onJoin}>
                    {group.join_policy === 'approval' ? 'Ask to Join' : 'Join'}
                  </Button>
                )
              )}

              <Menu
                label="More"
                trigger={
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-ink-line bg-ink-card text-white/70 transition-colors hover:bg-ink-hover hover:text-white">
                    <FontAwesomeIcon icon={faEllipsis} />
                  </span>
                }
                items={[
                  ...(rights?.can_manage_community
                    ? [{ label: 'Configure Community', icon: faGear, to: `/c/${group.slug}/configure` }]
                    : []),
                  ...(isMember
                    ? [{ label: 'Leave Community', icon: faRightFromBracket, onSelect: onLeave }]
                    : []),
                  { label: copied ? 'Link copied' : 'Copy link', icon: faLink, onSelect: copyLink },
                  { label: 'Report abuse', icon: faFlag, onSelect: onReport },
                ]}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="neutral">{formatCount(group.member_count)} Members</Badge>
            {rights?.my_rank_name && <Badge tone="brand">{rights.my_rank_name}</Badge>}
            {group.join_policy === 'approval' && <Badge tone="neutral">Approval needed</Badge>}
          </div>

          {description && (
            <div className="mt-4 max-w-3xl">
              <p
                className={cn(
                  'whitespace-pre-wrap text-sm leading-relaxed text-white/70',
                  !expanded && long && 'line-clamp-3',
                )}
              >
                {description}
              </p>
              {long && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 text-sm font-bold text-white/80 underline hover:text-white"
                >
                  {expanded ? 'less' : 'more'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
