import { useState } from 'react'
import {
  faChevronDown, faChevronUp, faMagnifyingGlass, faPenToSquare, faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { ConversationFace, soloOf } from '@/components/chat/ConversationFace'
import { LivePresenceLabel } from '@/components/ui/PersonAvatar'
import { useLivePresence } from '@/hooks/usePresenceStore'
import { useParty } from '@/hooks/useParty'
import { conversationName } from '@/lib/api'
import { avatarOf, nameOf } from '@/lib/avatars'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Conversation } from '@/types/db'

/*
 * Who you know, at the foot of the page.
 *
 * Rebuilt. It was a flat list of chats newest first, with a switcher
 * bolted on the top of it for the party; Staw threw all of it out and said
 * what he wants instead: no switcher, and the feel of Xbox and Steam.
 *
 * What that actually means, taken from those two and not just said:
 *
 *   * **The people who are doing something come first.** Steam sorts its
 *     friends by what they are up to, not by who typed last, because the
 *     reason the list is open is to find somebody to play with. So: in a
 *     World, then around, then everybody else, under three quiet headings.
 *   * **A row says what they are doing**, not what they last said. The
 *     World they are in, the thing they are building, their thought - and
 *     a Join on the end of it when there is somewhere to join.
 *   * **The party is a module, not a tab.** Xbox keeps the party at the
 *     top of the guide where you can always see it. It sits above the
 *     list, with its own green, and opens its window.
 *
 * The chat is still one press away - a row opens it. It is the list that
 * stopped being a list of chats.
 */
type Row = { conversation: Conversation; presence: ReturnType<typeof useLivePresence> }

export function FriendsWindow({
  conversations, loading, onOpen, onNewGroup, onOpenParty, open, onToggle, full,
}: {
  conversations: Conversation[]
  loading: boolean
  onOpen: (id: string) => void
  onNewGroup: () => void
  onOpenParty: () => void
  open: boolean
  onToggle: () => void
  full?: boolean
}) {
  const [term, setTerm] = useState('')
  const { party, invites } = useParty()

  const looking = term.trim().toLowerCase()
  const shown = conversations.filter((c) =>
    !c.party_id && conversationName(c).toLowerCase().includes(looking))

  return (
    <section
      className={cn(
        'pointer-events-auto flex flex-col overflow-hidden border-ink-line bg-ink-card',
        full
          ? 'h-full w-full'
          : cn(
              'relative w-80 rounded-t-2xl border-2 border-b-0 border-t-0 shadow-pop',
              'before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-brand-bright',
              open ? 'h-[26rem]' : 'h-12',
            ),
      )}
      aria-label="Friends"
    >
      {!full && (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-line bg-ink px-3">
          <button
            onClick={onToggle}
            className="flex flex-1 items-center gap-2 text-left text-sm font-extrabold"
            aria-expanded={open}
          >
            <Icon name="users" className="h-4 w-4" />
            Friends
          </button>

          <Tooltip label="New chat group" side="top">
            <button
              onClick={onNewGroup}
              aria-label="New chat group"
              className="grid h-7 w-7 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <Glyph icon={faPenToSquare} />
            </button>
          </Tooltip>

          <button
            onClick={onToggle}
            aria-label={open ? 'Minimise' : 'Open'}
            className="grid h-7 w-7 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
          >
            <Glyph icon={open ? faChevronDown : faChevronUp} />
          </button>
        </header>
      )}

      {open && (
        <>
          {/* The party, where Xbox keeps it: at the top, always in sight. */}
          {(!!party || !!invites.length) && (
            <PartyStrip
              names={(party?.members ?? []).map((one) => ({
                id: one.user_id,
                name: nameOf(one),
                avatar: avatarOf(one),
              }))}
              asked={invites.length}
              going={party?.world_name ?? null}
              onOpen={onOpenParty}
            />
          )}

          <div className="relative shrink-0 p-2">
            <label className="sr-only" htmlFor="friends-filter">Search</label>
            <Glyph
              icon={faMagnifyingGlass}
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-xs text-white/35"
            />
            <input
              id="friends-filter"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search"
              className="h-9 w-full rounded-full border-2 border-ink-line bg-ink-raised pl-8 pr-3 text-sm placeholder:text-white/30 focus:border-brand-bright"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden kob-scroll">
            {loading && (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
              </div>
            )}

            {!loading && !shown.length && (
              <p className="px-4 py-6 text-center text-xs text-muted">
                {looking ? 'Nobody by that name.' : 'Nobody yet.'}
              </p>
            )}

            {!loading && <Sorted conversations={shown} onOpen={onOpen} />}
          </div>
        </>
      )}
    </section>
  )
}

/**
 * The three headings, in the order somebody opening this cares about.
 *
 * Groups sit at the top with the party because a room full of people is
 * never "offline", and sorting one by presence would mean picking a person
 * in it to stand for all of them.
 */
function Sorted({ conversations, onOpen }: {
  conversations: Conversation[]
  onOpen: (id: string) => void
}) {
  const groups = conversations.filter((c) => c.is_group)
  const solos = conversations.filter((c) => !c.is_group)

  return (
    <>
      {!!groups.length && (
        <Section label="Groups">
          {groups.map((c) => <RowLine key={c.id} conversation={c} onOpen={onOpen} />)}
        </Section>
      )}
      <ByPresence conversations={solos} onOpen={onOpen} />
    </>
  )
}

function ByPresence({ conversations, onOpen }: {
  conversations: Conversation[]
  onOpen: (id: string) => void
}) {
  /*
   * One hook per row would be a hook inside a loop, so the rows read their
   * own presence and the sorting asks them for it through a key. The store
   * is a module-level map with a version counter, so this is one read per
   * row either way.
   */
  const rows: Row[] = conversations.map((conversation) => ({
    conversation,
    presence: presenceOf(conversation),
  }))

  const playing = rows.filter((r) => r.presence === 'in-space' || r.presence === 'building')
  const around = rows.filter((r) => r.presence === 'online')
  const away = rows.filter((r) => r.presence === 'offline')

  return (
    <>
      {!!playing.length && (
        <Section label="In a World">
          {playing.map((r) => (
            <RowLine key={r.conversation.id} conversation={r.conversation} onOpen={onOpen} />
          ))}
        </Section>
      )}
      {!!around.length && (
        <Section label="Online">
          {around.map((r) => (
            <RowLine key={r.conversation.id} conversation={r.conversation} onOpen={onOpen} />
          ))}
        </Section>
      )}
      {!!away.length && (
        <Section label="Offline">
          {away.map((r) => (
            <RowLine key={r.conversation.id} conversation={r.conversation} onOpen={onOpen} dim />
          ))}
        </Section>
      )}
    </>
  )
}

/* Read outside a component, so the sort does not call a hook in a loop. */
function presenceOf(conversation: Conversation) {
  const solo = soloOf(conversation)
  if (!solo) return 'online' as const
  if (solo.in_space_id) return 'in-space' as const
  return solo.is_online ? ('online' as const) : ('offline' as const)
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pb-1">
      <p className="px-3 pb-1 pt-2 text-tiny font-extrabold uppercase tracking-wide text-white/30">
        {label}
      </p>
      {children}
    </div>
  )
}

function RowLine({ conversation, onOpen, dim }: {
  conversation: Conversation
  onOpen: (id: string) => void
  dim?: boolean
}) {
  const solo = soloOf(conversation)

  return (
    <button
      onClick={() => onOpen(conversation.id)}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ink-hover',
        dim && 'opacity-60 hover:opacity-100',
      )}
    >
      <ConversationFace conversation={conversation} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">
          {conversationName(conversation)}
        </span>
        {/*
          * What they are doing, not what they last said.
          *
          * The last line of a chat is what a chat list shows; this is a
          * list of people, and the reason it is open is to find somebody
          * who is around. The message is still there - it is one press
          * away, in the window.
          */}
        <span className={cn('block truncate text-xs', conversation.ignored && 'blur-[3px]')}>
          {solo
            ? <LivePresenceLabel person={solo} />
            : <span className="text-muted">{conversation.last_message ?? 'No messages yet'}</span>}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block text-mini text-muted">{timeAgo(conversation.last_message_at)}</span>
        {conversation.unread_count > 0 && (
          <span className="mt-0.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-mini font-extrabold text-on-art">
            {conversation.unread_count}
          </span>
        )}
      </span>
    </button>
  )
}

/**
 * The party, pinned.
 *
 * Faces, how many, and one way in. Green, because that is the party's
 * colour everywhere else on the platform now.
 */
export function PartyStrip({ names, asked, going, onOpen }: {
  names: { id: string; name: string; avatar: string | null }[]
  asked: number
  going: string | null
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="group relative flex w-full items-center gap-2.5 overflow-hidden border-b-2 border-ink-line bg-ink-raised px-3 py-2.5 text-left transition-colors hover:bg-ink-hover"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-space" />

      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white ring-2 ring-space/40">
        <Icon name="party" tone="#1CAE71" className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold">
          {asked && !names.length ? 'Somebody asked you in' : 'Party'}
        </span>
        <span className="block truncate text-xs text-muted">
          {going
            ? <>Going to <span className="font-bold text-space">{going}</span></>
            : names.length
              ? `${names.length} with you`
              : 'Open to answer'}
        </span>
      </span>

      {!!names.length && (
        <span className="flex shrink-0 items-center -space-x-2">
          {names.slice(0, 3).map((one) => (
            <Avatar
              key={one.id}
              src={one.avatar ?? undefined}
              personId={one.id}
              name={one.name}
              size="xs"
              className="ring-2 ring-ink-raised"
            />
          ))}
        </span>
      )}

      {!!going && <Glyph icon={faPlay} className="shrink-0 text-tiny text-space" />}
    </button>
  )
}
