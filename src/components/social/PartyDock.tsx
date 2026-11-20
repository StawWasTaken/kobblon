import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  faCrown, faPlay, faRightFromBracket, faUserPlus, faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
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
import { PartyInviteDialog } from '@/components/social/PartyInviteDialog'

/** As many as one party holds, matching `party_cap()`. */
export const PARTY_CAP = 8

/*
 * The party, inside the Friends Chat dock.
 *
 * It had a window of its own beside the chats. Staw: "make that the
 * parties can be in the friends chat dock too (and that in the other
 * session they make that we can acess them through the friends chat Ui of
 * the launcher too, ingame)" - and the Launcher has one chat panel, not a
 * row of docked windows, so a party that lives beside the chats cannot be
 * reached there at all. One place for it, on both sides: a tab in the
 * chat dock.
 *
 * `PartyWiring` is the whole feature with nothing around it, ready to be
 * dropped into that tab. The drawing below it takes props only, so it
 * mounts with no providers at all - the rule this project has broken three
 * times.
 */
export function PartyWiring({ className }: { className?: string }) {
  const { profile } = useAuth()
  const { party, invites, reload } = useParty()
  const say = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

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
    <>
      <PartyPanel
        me={profile.id}
        party={party}
        invites={invites}
        busy={busy}
        className={className}
        onAccept={(id) => void run(`yes:${id}`, () => acceptPartyInvite(id))}
        onDecline={(id) => void run(`no:${id}`, () => declinePartyInvite(id))}
        onLeave={() => void run('leave', leaveParty)}
        onRemove={(id) => void run(`out:${id}`, () => removeFromParty(id))}
        onInvite={() => setAsking(true)}
        onPlay={() => {
          if (!party?.world_id) return
          play(party.world_id, () => {
            say('Kobblon is not installed on this machine.', 'info')
          }, party.server_id ?? undefined)
        }}
      />

      {asking && (
        <PartyInviteDialog
          me={profile.id}
          already={(party?.members ?? []).map((one) => one.user_id)}
          full={(party?.members.length ?? 0) >= PARTY_CAP}
          onClose={() => { setAsking(false); void reload() }}
        />
      )}
    </>
  )
}

/**
 * The party itself, which knows nothing about where it came from.
 *
 * No window, no header, no collapse: it is the inside of a tab now, and
 * whatever holds it draws its own edges.
 */
export function PartyPanel({
  me, party, invites, busy, onAccept, onDecline, onLeave, onRemove, onInvite, onPlay, className,
}: {
  me: string
  party: Party | null
  invites: PartyInvite[]
  busy?: string | null
  onAccept: (party: string) => void
  onDecline: (party: string) => void
  onLeave: () => void
  onRemove: (who: string) => void
  onInvite: () => void
  onPlay: () => void
  className?: string
}) {
  const leader = party?.leader_id === me
  const going = party?.world_id && party.world_name

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 kob-scroll">
        {/* Somebody asking you in, above your own party because it is the
            thing that just happened. */}
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

        {party ? (
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
          </>
        ) : (
          !invites.length && (
            /* Nobody to show. One line and the one button, rather than an
               explanation of what a party is. */
            <div className="grid h-full place-items-center px-4 text-center">
              <div>
                <Icon name="party" className="mx-auto h-8 w-8 text-white/20" />
                <p className="mt-2 text-xs text-muted">Nobody with you yet.</p>
              </div>
            </div>
          )
        )}
      </div>

      {/* The buttons stay at the foot, where a chat's box is, so the two
          tabs of this dock have their controls in the same place. */}
      <div className="flex shrink-0 items-center gap-2 border-t-2 border-ink-line p-2">
        {going && (
          <Button size="sm" variant="yes" icon={faPlay} onClick={onPlay}>
            Play
          </Button>
        )}
        <Button size="sm" variant="subtle" icon={faUserPlus} onClick={onInvite}>
          Invite
        </Button>
        {!!party && (
          <Tooltip label="Leave the party" side="top">
            <Button
              size="sm"
              variant="ghost"
              icon={faRightFromBracket}
              aria-label="Leave the party"
              loading={busy === 'leave'}
              onClick={onLeave}
              className="ml-auto"
            />
          </Tooltip>
        )}
      </div>
    </div>
  )
}
