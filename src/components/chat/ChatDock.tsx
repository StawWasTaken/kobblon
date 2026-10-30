import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
} from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faChevronDown, faChevronUp, faXmark, faMagnifyingGlass, faPenToSquare,
  faGear, faArrowLeft, faUserGroup, faEyeSlash, faPen, faRightFromBracket, faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { LoadingMark } from '@/components/ui/Loading'
import { Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { Icon } from '@/components/brand/Icon'
import { NewGroupDialog } from './NewGroupDialog'
import { Composer } from '@/components/chat/Composer'
import { MessageRow } from './MessageRow'
import { SafetyNote } from './SafetyNote'
import { usePersonActions } from '@/components/social/personActions'
import { TimeSeparator } from './TimeSeparator'
import { ReportDialog } from '@/components/social/ReportDialog'
import { useAuth } from '@/hooks/useAuth'
import { useNarrow } from '@/hooks/useWidth'
import {
  chatRoster, conversationName, deleteMessage, editMessage, ignorePerson, listMessages,
  markConversationRead, sendMessage, startConversation, unignorePerson,
  myChatStanding, chatCardSeen, renameConversation, leaveConversation,
  type ChatStanding,
} from '@/lib/api'
import { ChatSuspended } from '@/components/chat/ChatSuspended'
import { ChatLockedBar } from '@/components/chat/ChatLockedBar'
import { supabase } from '@/lib/supabase'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Conversation, Message } from '@/types/db'
import { avatarOf, nameOf } from '@/lib/avatars'
import { profileLink } from '@/lib/links'
import { LivePresenceLabel, PersonAvatar } from '@/components/ui/PersonAvatar'

/*
 * The standing lives here, once.
 *
 * It used to be a hook called in two places - the dock, and every open
 * conversation - which is two separate answers to one question. The card
 * is rendered by the dock and the only thing that pokes a standing awake
 * on a refusal is a conversation's failed send, so a suspension handed out
 * mid-sentence locked the bar and never raised the card: the copy that
 * learned it was not the copy that draws it. One standing, shared.
 */
type Quiet = ReturnType<typeof useChatStanding>
type ChatValue = {
  openConversation: (id: string) => void
  quiet: Quiet
  /**
   * Open the chat on a phone. The bottom bar carries the chat now, so the
   * thing that opens it is no longer inside this file.
   */
  openChat: () => void
  /** Whether the phone sheet is showing, so the bar can say it is on. */
  chatOpen: boolean
  /** Unread across every conversation, for the bar's number. */
  chatUnread: number
}

/*
 * A default, and it matters: `useChatDock` is read by things that mount
 * outside this provider - the Workspace's panels among them - and a context
 * with no default throws there. `useAuth` does throw, and that has taken a
 * panel down twice.
 */
const ChatContext = createContext<ChatValue>({
  openConversation: () => {},
  quiet: { standing: null, left: '', read: () => {}, ask: () => {} },
  openChat: () => {},
  chatOpen: false,
  chatUnread: 0,
})

/** Lets any page pop a conversation open in the dock. */
export const useChatDock = () => useContext(ChatContext)

const MAX_OPEN = 3
const LIST_STATE = 'kobblon.chat.listOpen'

/** The dock remembers whether it was left open, per device. */
function useRemembered(key: string, fallback: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? fallback : stored === 'true'
    } catch {
      return fallback
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value))
    } catch {
      // Blocked storage just means it does not persist.
    }
  }, [key, value])

  return [value, setValue] as const
}

function Window({
  conversation, onClose, onOpened, full,
}: {
  conversation: Conversation
  onClose: () => void
  onOpened: (conversationId: string) => void
  /**
   * Filling the screen instead of sitting in the corner.
   *
   * Staw: "the chat docks for mobile isnt convenient and we cant see the
   * chat docks". A 288-pixel window pinned to the bottom right of a phone
   * is a desktop idea, and the dock was `hidden md:flex` anyway - so on a
   * phone there was no chat at all. The same component, given the whole
   * screen, rather than a second chat written for small windows.
   */
  full?: boolean
}) {
  const { profile } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [details, setDetails] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  /* Renaming the group, from the details panel. `null` while nobody is. */
  const [naming, setNaming] = useState<string | null>(null)
  /* What the server says it is called, once somebody has renamed it here.
     The row in the list is refreshed on its own poll; this is so the
     window's own header changes the moment the name takes. */
  const [renamed, setRenamed] = useState<string | null | undefined>(undefined)
  const [leaving, setLeaving] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  const name = renamed === undefined
    ? conversationName(conversation)
    : conversationName({ ...conversation, title: renamed })
  const solo = conversation.members.length === 1 ? conversation.members[0] : null

  // A row for a friend nobody has messaged yet carries no real conversation
  // until the first message opens one.
  const pending = conversation.id.startsWith('friend:')

  /*
   * Ignoring somebody from inside the chat itself, which is where you
   * usually decide you have had enough of it. Blocking asks first, because
   * it ends the friendship and empties the chat out of both lists.
   */
  const [covered, setCovered] = useState(Boolean(conversation.ignored))
  const people = usePersonActions(() => onClose())

  const toggleIgnore = async (targetId: string) => {
    try {
      if (covered) {
        await unignorePerson(targetId)
        setCovered(false)
      } else {
        await ignorePerson(targetId)
        setCovered(true)
      }
    } catch {
      setError('That did not work.')
    }
  }

  useEffect(() => {
    if (pending) {
      setLoading(false)
      return
    }
    let active = true
    listMessages(conversation.id)
      .then((rows) => active && setMessages(rows))
      .finally(() => active && setLoading(false))
    if (profile) markConversationRead(conversation.id, profile.id)
    return () => { active = false }
  }, [conversation.id, profile, pending])

  useEffect(() => {
    if (pending) return
    const channel = supabase
      .channel(`dock:${conversation.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const incoming = payload.new as Message
          setMessages((all) => (all.some((m) => m.id === incoming.id) ? all : [...all, incoming]))
        })
      /*
       * Edits and deletions, too.
       *
       * Only inserts were listened for, so an edit or a deletion reached
       * the other side on their next reload and not before - they sat
       * reading a sentence that had been taken back minutes ago. A delete
       * here is an update of `is_removed`, so both arrive as the same
       * event and the row is simply replaced by whatever the server now
       * holds.
       */
      .on('postgres_changes',
        {
          event: 'UPDATE', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const changed = payload.new as Message
          setMessages((all) => all.map((m) => (m.id === changed.id ? changed : m)))
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversation.id, pending])

  useEffect(() => {
    if (!collapsed && !details) bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages, collapsed, details])

  const { quiet } = useChatDock()
  const locked = Boolean(quiet.standing && !quiet.standing.over)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const body = draft.trim()
    if (!body || !profile) return
    setDraft('')
    setError(null)
    try {
      const target = pending
        ? await startConversation(conversation.id.replace('friend:', ''))
        : conversation.id
      await sendMessage(target, profile.id, body)
      if (pending) onOpened(target)
    } catch (err) {
      setDraft(body)
      setError(err instanceof Error ? err.message : 'That did not send.')
      /*
       * A suspension given while somebody is sitting here was only ever
       * caught by this failing, and nothing then told the window - so the
       * box stayed typable and the card never came up. Asking again on any
       * refusal is one call and needs no guess at which refusal it was;
       * reading the error text to decide would be a window parsing English
       * the server is free to reword.
       */
      quiet.ask()
    }
  }

  return (
    <section
      className={cn(
        'pointer-events-auto flex flex-col overflow-hidden border-ink-line bg-ink-card',
        full
          ? 'h-full w-full'
          /*
            * The dock's own shape, rather than a card with a chat in it.
            * Staw: the docks should be "more unique". So: a wider window,
            * a deeper corner at the top, and a brand line along the head
            * of it - the same line the rail uses for where you are, which
            * is what makes a window that is open read as a place you are
            * rather than a panel lying on the page.
            */
          : cn(
              'w-80 rounded-t-2xl border border-b-0 border-t-0 shadow-pop',
              'before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r',
              'before:from-brand before:via-brand-bright before:to-space',
              'relative',
              collapsed ? 'h-12' : 'h-[26rem]',
            ),
      )}
      aria-label={`Chat with ${name}`}
    >
      <header className={cn(
        'flex shrink-0 items-center gap-2 border-b border-ink-line px-2',
        full ? 'h-11' : 'h-12 bg-gradient-to-b from-brand-deep/35 to-transparent',
      )}>
        {details ? (
          <>
            <button
              onClick={() => setDetails(false)}
              aria-label="Back to the conversation"
              className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <Glyph icon={faArrowLeft} />
            </button>
            <h3 className="flex-1 truncate text-sm font-bold">Chat Details</h3>
          </>
        ) : (
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-ink-hover"
            aria-expanded={!collapsed}
          >
            <span className="shrink-0">
              {solo ? (
                <>
                  <PersonAvatar person={solo} size="xs" />
                </>
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-deep text-[10px] text-white">
                  <Glyph icon={faUserGroup} />
                </span>
              )}
            </span>
            <span className="truncate font-display text-sm font-extrabold tracking-tight">{name}</span>
          </button>
        )}

        {!details && (
          <Tooltip label="Chat details" side="top">
            <button
              onClick={() => { setDetails(true); setCollapsed(false) }}
              aria-label="Chat details"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <Glyph icon={faGear} />
            </button>
          </Tooltip>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
        >
          <Glyph icon={faXmark} />
        </button>
      </header>

      {!collapsed && details && (
        <div className="flex-1 overflow-y-auto p-3 kob-scroll">
          {/*
            * A group can be renamed and walked out of; a chat between two
            * people can be neither. There is nothing to name - it is
            * called by who is in it - and leaving would mean the other
            * person writing into a room nobody is in, which is what
            * unfriending is for.
            */}
          {conversation.is_group && !pending && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Name</p>

              {naming === null ? (
                <button
                  onClick={() => setNaming((renamed === undefined ? conversation.title : renamed) ?? '')}
                  className="flex w-full items-center gap-2 rounded-lg border border-ink-line bg-ink-raised px-2.5 py-2 text-left text-sm transition-colors hover:border-brand-bright/50"
                >
                  <span className="min-w-0 flex-1 truncate font-bold">{name}</span>
                  <Glyph icon={faPen} className="shrink-0 text-[11px] text-muted" />
                </button>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    try {
                      const held = await renameConversation(conversation.id, naming)
                      setRenamed(held)
                      setNaming(null)
                      setError(null)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'That name did not take.')
                    }
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    autoFocus
                    value={naming}
                    onChange={(e) => setNaming(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setNaming(null) }}
                    maxLength={48}
                    placeholder="Nothing, and it goes by who is in it"
                    aria-label="What this group is called"
                    className="h-8 min-w-0 flex-1 rounded-lg border border-ink-line bg-ink-raised px-2.5 text-sm placeholder:text-white/25 focus:border-brand-bright focus:outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Save the name"
                    title="Save the name"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-bright"
                  >
                    <Glyph icon={faCheck} className="text-xs" />
                  </button>
                </form>
              )}

              {error && <p className="text-xs text-danger">{error}</p>}
            </div>
          )}

          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Members</p>
          <ul className="space-y-1">
            {conversation.members.map((member) => (
              <li key={member.id}>
                <Link
                  to={profileLink(member)}
                  className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-ink-hover"
                >
                  <Avatar src={avatarOf(member)} personId={member.id} name={nameOf(member)} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{nameOf(member)}</span>
                    <LivePresenceLabel person={member} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {conversation.is_group && !pending && (
            <button
              onClick={async () => {
                setLeaving(true)
                try {
                  await leaveConversation(conversation.id)
                  onClose()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'That did not work.')
                  setLeaving(false)
                }
              }}
              disabled={leaving}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-danger/40 px-2.5 py-2 text-sm font-bold text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
            >
              <Glyph icon={faRightFromBracket} className="text-xs" />
              Leave this group
            </button>
          )}
        </div>
      )}

      {!collapsed && !details && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-3 kob-scroll">
            {loading && (
              <div className="space-y-2">
                {[0, 1].map((i) => <Skeleton key={i} className="h-8 w-2/3" />)}
              </div>
            )}

            {/* Stays at the top of the history rather than only showing when
                the conversation is empty. */}
            {!loading && solo && (
              <SafetyNote
                className="mb-1"
                person={solo}
                ignored={covered}
                onIgnore={() => toggleIgnore(solo.id)}
                onBlock={() => people.askFor({ kind: 'block', person: solo })}
                onReport={() => setReporting(true)}
              />
            )}

            {!loading && !messages.length && !solo && (
              <p className="py-6 text-center text-xs text-muted">Say something to the group.</p>
            )}

            {messages.map((m, i) => {
              const before = messages[i - 1]
              const apart = before
                ? new Date(m.created_at).getTime() - new Date(before.created_at).getTime()
                : Infinity
              // A quarter of an hour of silence is worth marking.
              const gap = apart > 15 * 60_000
              const grouped = Boolean(
                before && before.sender_id === m.sender_id && !gap && apart < 5 * 60_000,
              )

              return (
                <div key={m.id}>
                  {gap && <TimeSeparator at={m.created_at} />}
                  <MessageRow
                    message={m}
                    mine={m.sender_id === profile?.id}
                    grouped={grouped}
                    covered={covered}
                    sender={
                      m.sender_id === profile?.id
                        ? {
                            id: profile.id,
                            username: profile.username,
                            display_name: profile.display_name,
                            avatar_url: profile.avatar_url,
                            is_guest: profile.is_guest,
                            is_online: profile.is_online,
                            in_space_id: profile.in_space_id,
                          }
                        : conversation.members.find((member) => member.id === m.sender_id)
                    }
                    onEdit={async (body) => {
                      // The stored row, not the typed text: an edit can come
                      // back masked, and painting what was typed would hide
                      // that until a reload.
                      const saved = await editMessage(m.id, body)
                      setMessages((all) => all.map((x) => (x.id === m.id ? saved : x)))
                    }}
                    onDelete={async () => {
                      await deleteMessage(m.id)
                      setMessages((all) =>
                        all.map((x) => (x.id === m.id ? { ...x, is_removed: true } : x)))
                    }}
                  />
                </div>
              )
            })}
            <div ref={bottom} />
          </div>

          <form
            onSubmit={submit}
            autoComplete="off"
            className="shrink-0 border-t border-ink-line p-2"
          >
            {error && !locked && (
              <p className="px-1 pb-1.5 text-xs text-danger">{error}</p>
            )}

            {/*
              * The bar replaces the box rather than greying it out. A
              * disabled input under a line of red reads as something that
              * went wrong; a solid bar with a lock on it reads as a
              * decision, which is what it is - and it is what somebody sees
              * when they come back in an hour, so it says how long is left
              * rather than only that something happened.
              */}
            {locked ? (
              <ChatLockedBar until={quiet.standing!.until} onOver={quiet.ask} />
            ) : (
              <Composer
                id={`draft-${conversation.id}`}
                value={draft}
                onChange={setDraft}
                onSend={() => void submit()}
              />
            )}
          </form>
        </>
      )}

      {solo && (
        <ReportDialog
          open={reporting}
          onClose={() => setReporting(false)}
          targetType="profile"
          targetId={solo.id}
          targetName={nameOf(solo)}
        />
      )}

      {people.dialog}
    </section>
  )
}

function List({
  conversations, loading, onOpen, onNewGroup, full,
}: {
  conversations: Conversation[]
  loading: boolean
  onOpen: (id: string) => void
  onNewGroup: () => void
  /** Filling a phone's screen rather than sitting in a corner of a desktop. */
  full?: boolean
}) {
  // Open the first time somebody sees it, and however they left it after that.
  const [remembered, setOpen] = useRemembered(LIST_STATE, true)
  /*
   * Filling the screen means always open: the collapse is what makes a
   * corner window get out of the way, and a sheet somebody deliberately
   * opened has nothing to get out of the way of.
   */
  const open = full ? true : remembered
  const [term, setTerm] = useState('')

  const shown = conversations.filter((c) =>
    conversationName(c).toLowerCase().includes(term.trim().toLowerCase()))

  return (
    <section
      className={cn(
        'pointer-events-auto flex flex-col overflow-hidden border-ink-line bg-ink-card',
        full
          ? 'h-full w-full'
          /* The same shape as a conversation window: the two sit side by
             side at the foot of the page and a pair that do not match
             reads as one of them being a different kind of thing. */
          : cn(
              'relative w-80 rounded-t-2xl border border-b-0 border-t-0 shadow-pop',
              'before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r',
              'before:from-brand before:via-brand-bright before:to-space',
              open ? 'h-[26rem]' : 'h-12',
            ),
      )}
      aria-label="Friends Chat"
    >
      {/*
        * No header in the sheet. The phone sheet draws its own title bar
        * with a way out of it, so this one made "Friends Chat" appear twice
        * down the top of the screen - and its collapse chevron did nothing
        * there, because `full` forces the list open.
        */}
      {!full && (
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-line bg-gradient-to-b from-brand-deep/35 to-transparent px-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-extrabold"
          aria-expanded={open}
        >
          {/* Staw's own mark, not a glyph that looks like it. */}
          <Icon name="chatbubble" className="h-4 w-4" />
          Friends Chat
        </button>

        <Tooltip label="New chat group" side="top">
          <button
            onClick={onNewGroup}
            aria-label="New chat group"
            className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
          >
            <Glyph icon={faPenToSquare} />
          </button>
        </Tooltip>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Minimise chat' : 'Open chat'}
          className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
        >
          <Glyph icon={open ? faChevronDown : faChevronUp} />
        </button>
      </header>
      )}

      {open && (
        <>
          <div className="relative shrink-0 p-2">
            <label className="sr-only" htmlFor="chat-filter">Search for friends</label>
            <Glyph
              icon={faMagnifyingGlass}
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-xs text-white/35"
            />
            <input
              id="chat-filter"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search for friends"
              className="h-9 w-full rounded-full border border-ink-line bg-ink-raised pl-8 pr-3 text-sm placeholder:text-white/30 focus:border-brand-bright"
            />
          </div>

          <div className="flex-1 overflow-y-auto kob-scroll">
            {loading && (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
              </div>
            )}

            {!loading && !conversations.length && (
              <p className="px-4 py-6 text-center text-xs text-muted">
                No chats yet. You can message people once you are friends.
              </p>
            )}

            {shown.map((c) => {
              const solo = c.members.length === 1 ? c.members[0] : null
              return (
                <button
                  key={c.id}
                  onClick={() => onOpen(c.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ink-hover"
                >
                  <span className="shrink-0">
                    {solo ? (
                      <>
                        <PersonAvatar person={solo} size="sm" />
                      </>
                    ) : (
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-deep text-xs text-white">
                        <Glyph icon={faUserGroup} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold">{conversationName(c)}</span>
                      {c.ignored && (
                        <Glyph
                          icon={faEyeSlash}
                          title="You are ignoring this person"
                          className="shrink-0 text-[10px] text-white/35"
                        />
                      )}
                    </span>
                    {/* What somebody you are ignoring said stays covered here
                        as well, not only inside the chat. */}
                    <span
                      className={cn(
                        'block truncate text-xs text-muted',
                        c.ignored && c.last_message && 'blur-[3px]',
                      )}
                    >
                      {c.last_message ?? 'No messages yet'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] text-muted">{timeAgo(c.last_message_at)}</span>
                    {c.unread_count > 0 && (
                      <span className="mt-1 inline-grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                        {c.unread_count > 9 ? '9+' : c.unread_count}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

/**
 * Whether this person is allowed to talk, and the card that says so.
 *
 * Asked once when the dock mounts and again when the clock runs out, not
 * on a timer: the server said when it ends, so the only moment the answer
 * can change on its own is that one. (A suspension *given* while somebody
 * is sitting here is caught by the send being refused, which is the
 * server's job and not a poll's.)
 */
function useChatStanding() {
  const mine = useId()
  const [standing, setStanding] = useState<ChatStanding | null>(null)
  const [left, setLeft] = useState('')

  const ask = useCallback(() => { void myChatStanding().then(setStanding) }, [])
  useEffect(() => { ask() }, [ask])

  /*
   * Being told, rather than finding out.
   *
   * Asking on mount and at the end of the clock misses the one case that
   * matters most: a suspension handed out while somebody is sitting here.
   * Before this, the first they knew of it was a message of theirs
   * failing, which is the worst possible way to learn it.
   *
   * The row is heard, not read: realtime hands over a `chat_timeouts` row
   * and the card is worked out by `my_chat_standing` from it, so there is
   * one place that decides what a suspension means rather than a second
   * assembled here out of a payload. The row policy is what keeps this
   * private - realtime applies it, so somebody hears about their own
   * suspension and nobody else's.
   */
  useEffect(() => {
    /*
     * The topic carries the instance's own id, because this hook runs in
     * two places - the dock, and each open conversation - and two channels
     * on one topic is not two listeners. The second subscribe is refused,
     * and whichever panel unmounts first takes the other's down with it, so
     * the dock would quietly stop hearing anything the moment somebody
     * closed a conversation.
     */
    const channel = supabase
      .channel(`my-chat-standing:${mine}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_timeouts' },
        () => ask(),
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [ask, mine])

  /*
   * And a way that does not depend on the socket.
   *
   * Realtime only delivers once `chat_timeouts` is in the publication, and
   * a dropped socket is silent - the card simply never appears, which is
   * exactly how this read when it was broken. Asking again when the tab
   * comes back to the front, and every half minute while it is in front,
   * costs one small call and means the worst case is thirty seconds late
   * rather than "until you reload".
   */
  useEffect(() => {
    const again = () => { if (document.visibilityState === 'visible') ask() }
    document.addEventListener('visibilitychange', again)
    window.addEventListener('focus', again)
    const timer = setInterval(again, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', again)
      window.removeEventListener('focus', again)
      clearInterval(timer)
    }
  }, [ask])

  useEffect(() => {
    if (!standing || standing.over) return
    const tick = () => {
      const ms = new Date(standing.until).getTime() - Date.now()
      if (ms <= 0) { ask(); return }
      const all = Math.ceil(ms / 1000)
      setLeft(`${Math.floor(all / 60)}:${String(all % 60).padStart(2, '0')}`)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [standing, ask])

  const read = useCallback(() => {
    if (!standing) return
    void chatCardSeen(standing.id, standing.over)
    // Seen is seen: the card goes now rather than after a round trip, and
    // the row behind it is what stops it coming back.
    setStanding(standing.over ? null : { ...standing, seen: true })
  }, [standing])

  // Memoised because this now goes through a context: a fresh object every
  // render would hand every conversation a new value on every render of the
  // dock.
  return useMemo(() => ({ standing, left, read, ask }), [standing, left, read, ask])
}

export function ChatDock({ children }: { children: ReactNode }) {
  const quiet = useChatStanding()
  const { profile } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [openIds, setOpenIds] = useState<string[]>([])
  const [making, setMaking] = useState(false)

  const load = useCallback(async () => {
    if (!profile) {
      setConversations([])
      setLoading(false)
      return
    }
    try {
      setConversations(await chatRoster())
    } catch {
      setConversations([])
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('dock-conversations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, load])

  /*
   * Opening a conversation from anywhere on the site.
   *
   * It used to set `openIds` and nothing else - and `openIds` is only ever
   * drawn by the docked windows, which are `hidden md:flex`. So on a phone,
   * every Chat button on the site did exactly nothing: the state changed,
   * the thing that draws it was not on the screen, and there was no error
   * to find. okayCooki3 reported it twice from two different pages, which
   * is what a silent bug looks like from outside.
   *
   * Both are set, and the width is not asked here at all any more. It used
   * to be read at this line to decide whether to open the sheet, which
   * worked and left the hidden desktop window mounted beside it: one
   * conversation, two live windows, both on the channel and both marking
   * the same messages read. The width now decides which tree is *mounted*,
   * once, below - so this says what was opened and nothing about where,
   * and rotating mid-conversation still lands on the same thread.
   */
  /*
   * What the phone is showing: nothing, the list, or one conversation by
   * id. One value rather than an "open" flag and a "which" - two pieces of
   * state that can disagree is how a sheet ends up open with nothing in it.
   */
  const [phone, setPhone] = useState<string | null>(null)

  const openConversation = useCallback((id: string) => {
    setOpenIds((all) => (all.includes(id) ? all : [id, ...all].slice(0, MAX_OPEN)))
    setPhone(id)
    load()
  }, [load])

  const unread = conversations.reduce((all, one) => all + (one.unread_count ?? 0), 0)

  const openChat = useCallback(() => setPhone('list'), [])

  /*
   * Which of the two chats exists, rather than which one is painted.
   *
   * `hidden md:flex` on the windows and `md:hidden` on the sheet drew the
   * right one and mounted both, so a phone carried the whole desktop dock
   * behind the page: the roster list, and a Window per open conversation,
   * each subscribed to `dock:<id>` alongside the one on screen. Mounting
   * one of them is also why the sheet can be the only thing that answers
   * for the phone - there is nothing hidden behind it to disagree with.
   */
  const narrow = useNarrow()
  const signedIn = !!profile && !profile.is_guest
  const docked = signedIn && !narrow

  const value = useMemo(
    () => ({ openConversation, quiet, openChat, chatOpen: !!phone, chatUnread: unread }),
    [openConversation, quiet, openChat, phone, unread],
  )

  return (
    <ChatContext.Provider value={value}>
      {children}

      {docked && (
        <div className="pointer-events-none fixed bottom-0 right-0 z-40 flex items-end gap-2 px-6">
          {making && (
            <NewGroupDialog
              onClose={() => setMaking(false)}
              onCreated={(id) => {
                setMaking(false)
                load().then(() => openConversation(id))
              }}
            />
          )}

          {openIds.map((id) => {
            const conversation = conversations.find((c) => c.id === id)
            if (!conversation) return null
            return (
              <Window
                key={id}
                conversation={conversation}
                onClose={() => setOpenIds((all) => all.filter((open) => open !== id))}
                onOpened={(real) => {
                  setOpenIds((all) => all.map((open) => (open === id ? real : open)))
                  load()
                }}
              />
            )
          })}

          <List
            conversations={conversations}
            loading={loading}
            onOpen={openConversation}
            onNewGroup={() => setMaking(true)}
          />
        </div>
      )}

      {/* ------------------------------------------------- chat, on a phone */}
      {signedIn && narrow && (
        <div>
          {/*
            * There is no floating button any more. The bottom bar has a
            * Chat slot, which is where Staw asked for it and where Roblox
            * puts it - and the round button had been sitting over the
            * bottom-right corner of every page, on People right on top of
            * somebody's Profile link.
            */}
          {/*
            * Naming a group, as a screen rather than as a corner panel.
            *
            * The pencil set `making`, and the only thing that drew it was
            * inside the docked corner - a 288 by 384 box positioned for the
            * bottom right of a desktop, inside a container a phone never
            * paints. So the button did nothing there, which is the same
            * silent shape as the Chat button okayCooki3 reported: state
            * changed, nothing on screen, no error.
            */}
          {making && (
            <div className="fixed inset-0 z-[65] flex flex-col bg-ink">
              <NewGroupDialog
                full
                onClose={() => setMaking(false)}
                onCreated={(id) => {
                  setMaking(false)
                  load().then(() => openConversation(id))
                }}
              />
            </div>
          )}

          {phone && (
            <div className="fixed inset-0 z-[60] flex flex-col bg-ink">
              <div className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-line px-3">
                <button
                  type="button"
                  onClick={() => setPhone(phone === 'list' ? null : 'list')}
                  aria-label={phone === 'list' ? 'Close chat' : 'Back to your chats'}
                  className="grid h-9 w-9 place-items-center rounded-lg text-white/60 transition-colors hover:bg-ink-hover hover:text-white"
                >
                  <Glyph icon={phone === 'list' ? faXmark : faArrowLeft} />
                </button>
                <p className="flex-1 font-display text-sm font-bold">Friends Chat</p>
                {phone === 'list' && (
                  <button
                    type="button"
                    onClick={() => setMaking(true)}
                    aria-label="New chat group"
                    className="grid h-9 w-9 place-items-center rounded-lg text-white/60 transition-colors hover:bg-ink-hover hover:text-white"
                  >
                    <Glyph icon={faPenToSquare} />
                  </button>
                )}
              </div>

              <div className="min-h-0 flex-1">
                {phone === 'list' ? (
                  <List
                    full
                    conversations={conversations}
                    loading={loading}
                    onOpen={(id) => { openConversation(id); setPhone(id) }}
                    onNewGroup={() => setMaking(true)}
                  />
                ) : (
                  (() => {
                    const conversation = conversations.find((c) => c.id === phone)
                    /*
                     * A conversation that is no longer in the roster - left,
                     * blocked, or opened by an id that has since changed -
                     * goes back to the list rather than showing an empty
                     * screen with no way out of it.
                     */
                    /*
                     * Not yet, and gone, are two different things. A
                     * conversation opened from a Chat button is in state
                     * before the roster that holds it has come back, so
                     * saying it is not here any more while it is still
                     * loading would be telling somebody their chat is gone
                     * every single time they pressed the button.
                     */
                    if (!conversation) return loading ? (
                      <div className="grid h-full place-items-center p-6">
                        <LoadingMark />
                      </div>
                    ) : (
                      <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
                        That conversation is not here any more.
                      </div>
                    )
                    return (
                      <Window
                        full
                        conversation={conversation}
                        onClose={() => setPhone('list')}
                        onOpened={(real) => { setPhone(real); load() }}
                      />
                    )
                  })()
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/*
        * The card, over everything, once each way.
        *
        * Shown when a suspension has not been read, and again when it has
        * run out and that has not been read - which is what Staw asked
        * for: "this popup will appear then it'll appear again once its
        * gone". Both facts are rows on the server, so closing the window
        * or coming back tomorrow shows whichever is still unread rather
        * than nothing.
        */}
      {quiet.standing && (quiet.standing.over || !quiet.standing.seen) && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4">
          <ChatSuspended
            minutes={quiet.standing.minutes}
            until={quiet.standing.until}
            over={quiet.standing.over}
            reason={quiet.standing.reason}
            evidence={quiet.standing.evidence}
            ruleOrd={quiet.standing.rule_ord}
            ruleTitle={quiet.standing.rule_title}
            channels={quiet.standing.channels}
            source={quiet.standing.source}
            onUnderstand={quiet.read}
          />
        </div>
      )}
    </ChatContext.Provider>
  )
}
