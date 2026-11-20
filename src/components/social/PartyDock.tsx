import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  faComment, faCrown, faPlay, faRightFromBracket, faUserPlus, faXmark,
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
export function PartyWiring({ onOpenChat, compact, className }: {
  /**
   * Open the party's chat window.
   *
   * Passed in rather than reached for, because the thing that knows how to
   * open a dock window is the dock, and the dock is what draws this - so
   * asking it from here would be two files importing each other.
   */
  onOpenChat?: () => void
  /** A strip over the party's own chat rather than a tab of its own. */
  compact?: boolean
  className?: string
}) {
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
        compact={compact}
        onAccept={(id) => void run(`yes:${id}`, () => acceptPartyInvite(id))}
        onDecline={(id) => void run(`no:${id}`, () => declinePartyInvite(id))}
        onLeave={() => void run('leave', leaveParty)}
        onRemove={(id) => void run(`out:${id}`, () => removeFromParty(id))}
        onInvite={() => setAsking(true)}
        onOpenChat={onOpenChat}
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
  me, party, invites, busy, onAccept, onDecline, onLeave, onRemove, onInvite, onPlay,
  onOpenChat, compact, className,
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
  /** Opens the party's chat. Absent where there is nowhere to open it. */
  onOpenChat?: () => void
  /**
   * The short version: a row of faces, where it is going, and the buttons.
   *
   * It sits over the party's own messages, so it has to leave the chat
   * most of the window - a list of eight names above a thread is a thread
   * nobody can read.
   */
  compact?: boolean
  className?: string
}) {
  const leader = party?.leader_id === me
  const going = party?.world_id && party.world_name

  /*
   * The strip over the chat: faces rather than a list, one line for where
   * it is going, and the buttons on the end of it.
   */
  if (compact) {
    return (
      <div className={cn('shrink-0 border-b-2 border-ink-line px-2.5 py-2', className)}>
        {invites.map((one) => (
          <div key={one.party_id} className="mb-2 flex items-center gap-2">
            <Avatar src={avatarOf(one)} personId={one.asked_by} name={nameOf(one)} size="xs" />
            <p className="min-w-0 flex-1 truncate text-xs">
              <span className="font-bold">{nameOf(one)}</span> asked you in
            </p>
            <Button
              size="sm"
              variant="yes"
              loading={busy === `yes:${one.party_id}`}
              onClick={() => onAccept(one.party_id)}
            >
              Join
            </Button>
          </div>
        ))}

        {!!party && (
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center -space-x-2">
              {party.members.slice(0, 6).map((one) => (
                <Link
                  key={one.user_id}
                  to={profileLink(one)}
                  title={nameOf(one)}
                  className="relative shrink-0 rounded-full ring-2 ring-ink-card transition-transform hover:z-10 hover:-translate-y-0.5"
                >
                  <Avatar src={avatarOf(one)} personId={one.user_id} name={nameOf(one)} size="xs" />
                  {party.leader_id === one.user_id && (
                    <Glyph
                      icon={faCrown}
                      className="absolute -right-0.5 -top-1 text-[0.5rem] text-space"
                    />
                  )}
                </Link>
              ))}
              {party.members.length > 6 && (
                <span className="pl-3 text-mini font-bold text-muted">
                  +{party.members.length - 6}
                </span>
              )}
            </div>

            {going && (
              <Button size="sm" variant="yes" icon={faPlay} onClick={onPlay} aria-label="Play" />
            )}
            <Tooltip label="Ask somebody in" side="top">
              <Button size="sm" variant="subtle" icon={faUserPlus} aria-label="Ask somebody in" onClick={onInvite} />
            </Tooltip>
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
        )}

        {going && (
          <Link
            to={worldLink({
              content_id: party.world_content_id ?? 0,
              name: party.world_name ?? '',
            })}
            className="mt-1.5 block truncate text-mini text-muted hover:text-link"
          >
            Going to <span className="font-bold text-white/70">{party.world_name}</span>
          </Link>
        )}
      </div>
    )
  }

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
        {!!party && !!onOpenChat && (
          <Button size="sm" variant="subtle" icon={faComment} onClick={onOpenChat}>
            Open
          </Button>
        )}
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
