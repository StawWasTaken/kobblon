import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  faChevronDown, faCrown, faPlay, faRightFromBracket, faUserPlus, faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useParty } from '@/hooks/useParty'
import {
  acceptPartyInvite, declinePartyInvite, leaveParty, removeFromParty,
  type Party, type PartyInvite,
} from '@/lib/api'
import { play } from '@/lib/app'
import { avatarOf, nameOf } from '@/lib/avatars'
import { profileLink, worldLink } from '@/lib/links'
import { cn } from '@/lib/cn'

/*
 * The party, in the corner, beside the chats.
 *
 * It is the one window on this site that is about people rather than about
 * what they are saying: who you are with, where you are going, and the one
 * button that takes you all there. The chat dock's shape, because two
 * windows along the same edge that are nearly the same read as one of them
 * being broken.
 *
 * It draws nothing at all when there is no party and nobody has asked you
 * into one - an empty window saying "no party" is a window to close.
 */
export function PartyDock() {
  const { profile } = useAuth()
  const { party, invites, reload } = useParty()
  const say = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  if (!profile || profile.is_guest) return null

  const run = async (key: string, what: () => Promise<void>) => {
    setBusy(key)
    try {
      await what()
      await reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <PartyPanel
      me={profile.id}
      party={party}
      invites={invites}
      busy={busy}
      onAccept={(id) => void run(`yes:${id}`, () => acceptPartyInvite(id))}
      onDecline={(id) => void run(`no:${id}`, () => declinePartyInvite(id))}
      onLeave={() => void run('leave', leaveParty)}
      onRemove={(id) => void run(`out:${id}`, () => removeFromParty(id))}
      onPlay={() => {
        if (!party?.world_id) return
        play(party.world_id, () => {
          say('Kobblon is not installed on this machine.', 'info')
        }, party.server_id ?? undefined)
      }}
    />
  )
}

/**
 * The window itself, which knows nothing about where the party came from.
 *
 * Kept apart from the wiring above so it can be mounted on its own under
 * `tools/site` - the rule this project has broken three times is a shared
 * piece that needs a provider the application cannot give it.
 */
export function PartyPanel({
  me, party, invites, busy, onAccept, onDecline, onLeave, onRemove, onPlay,
}: {
  me: string
  party: Party | null
  invites: PartyInvite[]
  busy?: string | null
  onAccept: (party: string) => void
  onDecline: (party: string) => void
  onLeave: () => void
  onRemove: (who: string) => void
  onPlay: () => void
}) {
  const [open, setOpen] = useState(true)

  if (!party && !invites.length) return null

  const leader = party?.leader_id === me
  const going = party?.world_id && party.world_name

  return (
    <div
      className={cn(
        'pointer-events-auto relative w-72 shrink-0 rounded-t-2xl border-2 border-b-0 border-ink-line bg-ink-card shadow-pop',
        'before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-space-bright',
        open ? 'max-h-[22rem]' : 'h-12',
        'flex flex-col overflow-hidden',
      )}
      aria-label="Party"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-line bg-ink px-3">
        <button
          onClick={() => setOpen((was) => !was)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-extrabold"
          aria-expanded={open}
        >
          <Glyph icon={faCrown} className="text-mini text-space-bright" />
          Party
          {!!party && <span className="text-xs font-bold text-muted">{party.members.length}</span>}
        </button>
        <Glyph
          icon={faChevronDown}
          className={cn('text-mini text-muted transition-transform', open && 'rotate-180')}
        />
      </header>

      {open && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 kob-scroll">
          {/* Somebody asking you in. Above your own party, because it is
              the thing that just happened. */}
          {invites.map((one) => (
            <div
              key={one.party_id}
              className="mb-3 rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised p-3"
            >
              <div className="flex items-center gap-2">
                <Avatar src={avatarOf(one)} personId={one.asked_by} name={nameOf(one)} size="sm" />
                <p className="min-w-0 flex-1 text-xs">
                  <span className="font-bold">{nameOf(one)}</span> asked you in
                </p>
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="yes"
                  loading={busy === `yes:${one.party_id}`}
                  onClick={() => onAccept(one.party_id)}
                >
                  Join
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === `no:${one.party_id}`}
                  onClick={() => onDecline(one.party_id)}
                >
                  No
                </Button>
              </div>
            </div>
          ))}

          {party && (
            <>
              <ul className="space-y-1">
                {party.members.map((one) => (
                  <li key={one.user_id} className="group flex items-center gap-2.5 rounded-lg p-1.5">
                    <Link to={profileLink(one)} className="shrink-0">
                      <Avatar src={avatarOf(one)} personId={one.user_id} name={nameOf(one)} size="sm" />
                    </Link>
                    <Link to={profileLink(one)} className="min-w-0 flex-1 truncate text-sm font-bold hover:text-link">
                      {nameOf(one)}
                    </Link>
                    {party.leader_id === one.user_id && (
                      <Tooltip label="Leader" side="top">
                        <Glyph icon={faCrown} className="shrink-0 text-mini text-space-bright" />
                      </Tooltip>
                    )}
                    {leader && one.user_id !== me && (
                      <button
                        type="button"
                        aria-label={`Take ${nameOf(one)} out of the party`}
                        onClick={() => onRemove(one.user_id)}
                        className="shrink-0 rounded-lg p-1 text-mini text-white/35 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      >
                        <Glyph icon={faXmark} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {/* Where it is going, when the leader has said. */}
              {going && (
                <Link
                  to={worldLink({
                    content_id: party.world_content_id ?? 0,
                    name: party.world_name ?? '',
                  })}
                  className="mt-3 block truncate rounded-xl border-2 border-ink-line bg-ink-raised px-3 py-2 text-xs hover:border-brand/60"
                >
                  <span className="text-muted">Going to </span>
                  <span className="font-bold">{party.world_name}</span>
                </Link>
              )}

              <div className="mt-3 flex items-center gap-2">
                {going && (
                  <Button
                    size="sm"
                    variant="yes"
                    icon={faPlay}
                    onClick={onPlay}
                  >
                    Play
                  </Button>
                )}
                <Button size="sm" variant="subtle" icon={faUserPlus} to="/friends">
                  Ask somebody
                </Button>
                <Tooltip label="Leave the party" side="top">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={faRightFromBracket}
                    aria-label="Leave the party"
                    loading={busy === 'leave'}
                    onClick={onLeave}
                  />
                </Tooltip>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
