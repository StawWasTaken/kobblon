import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown, faChevronUp, faXmark, faPaperPlane, faMagnifyingGlass, faPenToSquare,
  faGear, faArrowLeft, faUserGroup, faEyeSlash,
} from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { NewGroupDialog } from './NewGroupDialog'
import { MessageRow } from './MessageRow'
import { SafetyNote } from './SafetyNote'
import { usePersonActions } from '@/components/social/personActions'
import { TimeSeparator } from './TimeSeparator'
import { ReportDialog } from '@/components/social/ReportDialog'
import { useAuth } from '@/hooks/useAuth'
import {
  chatRoster, conversationName, deleteMessage, editMessage, ignorePerson, listMessages,
  markConversationRead, sendMessage, startConversation, unignorePerson,
  myChatStanding, chatCardSeen, type ChatStanding,
} from '@/lib/api'
import { ChatSuspended } from '@/components/chat/ChatSuspended'
import { ChatLockedBar } from '@/components/chat/ChatLockedBar'
import { supabase } from '@/lib/supabase'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Conversation, Message } from '@/types/db'
import { avatarOf } from '@/lib/avatars'
import { profileLink } from '@/lib/links'
import { LivePresenceLabel, PersonAvatar } from '@/components/ui/PersonAvatar'

type ChatValue = { openConversation: (id: string) => void }
const ChatContext = createContext<ChatValue>({ openConversation: () => {} })

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
  conversation, onClose, onOpened,
}: {
  conversation: Conversation
  onClose: () => void
  onOpened: (conversationId: string) => void
}) {
  const { profile } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [details, setDetails] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  const name = conversationName(conversation)
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
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversation.id, pending])

  useEffect(() => {
    if (!collapsed && !details) bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages, collapsed, details])

  const quiet = useChatStanding()
  const locked = Boolean(quiet.standing && !quiet.standing.over)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
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
        'pointer-events-auto flex w-72 flex-col overflow-hidden rounded-t-xl border border-b-0 border-ink-line bg-ink-card shadow-pop',
        collapsed ? 'h-11' : 'h-96',
      )}
      aria-label={`Chat with ${name}`}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-ink-line px-2">
        {details ? (
          <>
            <button
              onClick={() => setDetails(false)}
              aria-label="Back to the conversation"
              className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
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
                  <FontAwesomeIcon icon={faUserGroup} />
                </span>
              )}
            </span>
            <span className="truncate text-sm font-bold">{name}</span>
          </button>
        )}

        {!details && (
          <Tooltip label="Chat details" side="top">
            <button
              onClick={() => { setDetails(true); setCollapsed(false) }}
              aria-label="Chat details"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <FontAwesomeIcon icon={faGear} />
            </button>
          </Tooltip>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </header>

      {!collapsed && details && (
        <div className="flex-1 overflow-y-auto p-3 kob-scroll">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Members</p>
          <ul className="space-y-1">
            {conversation.members.map((member) => (
              <li key={member.id}>
                <Link
                  to={profileLink(member)}
                  className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-ink-hover"
                >
                  <Avatar src={avatarOf(member)} personId={member.id} name={member.display_name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{member.display_name}</span>
                    <LivePresenceLabel person={member} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
                      await editMessage(m.id, body)
                      setMessages((all) =>
                        all.map((x) =>
                          x.id === m.id ? { ...x, body, edited_at: new Date().toISOString() } : x))
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
              <div className="flex items-center gap-1.5">
                <label className="sr-only" htmlFor={`draft-${conversation.id}`}>Message</label>
                <input
                  id={`draft-${conversation.id}`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={2000}
                  /*
                   * A chat box is not a form field worth remembering. Left
                   * to itself the browser keeps every line anybody has sent
                   * and offers them back in a dropdown, which puts one
                   * person's messages on screen in front of the next person
                   * to use the computer.
                   */
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck
                  name={`draft-${conversation.id}`}
                  placeholder="Send a message"
                  className="h-9 min-w-0 flex-1 rounded-full border border-ink-line bg-ink-raised px-3.5 text-sm placeholder:text-white/30 focus:border-brand-bright"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="Send"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-bright disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
                </button>
              </div>
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
          targetName={solo.display_name}
        />
      )}

      {people.dialog}
    </section>
  )
}

function List({
  conversations, loading, onOpen, onNewGroup,
}: {
  conversations: Conversation[]
  loading: boolean
  onOpen: (id: string) => void
  onNewGroup: () => void
}) {
  // Open the first time somebody sees it, and however they left it after that.
  const [open, setOpen] = useRemembered(LIST_STATE, true)
  const [term, setTerm] = useState('')

  const shown = conversations.filter((c) =>
    conversationName(c).toLowerCase().includes(term.trim().toLowerCase()))

  return (
    <section
      className={cn(
        'pointer-events-auto flex w-72 flex-col overflow-hidden rounded-t-xl border border-b-0 border-ink-line bg-ink-card shadow-pop',
        open ? 'h-96' : 'h-11',
      )}
      aria-label="Chat"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-ink-line px-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left text-sm font-extrabold"
          aria-expanded={open}
        >
          Chat
        </button>

        <Tooltip label="New chat group" side="top">
          <button
            onClick={onNewGroup}
            aria-label="New chat group"
            className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
          >
            <FontAwesomeIcon icon={faPenToSquare} />
          </button>
        </Tooltip>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Minimise chat' : 'Open chat'}
          className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
        >
          <FontAwesomeIcon icon={open ? faChevronDown : faChevronUp} />
        </button>
      </header>

      {open && (
        <>
          <div className="relative shrink-0 p-2">
            <label className="sr-only" htmlFor="chat-filter">Search for friends</label>
            <FontAwesomeIcon
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
                        <FontAwesomeIcon icon={faUserGroup} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold">{conversationName(c)}</span>
                      {c.ignored && (
                        <FontAwesomeIcon
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
    const channel = supabase
      .channel('my-chat-standing')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_timeouts' },
        () => ask(),
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
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

  return { standing, left, read, ask }
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

  const openConversation = useCallback((id: string) => {
    setOpenIds((all) => (all.includes(id) ? all : [id, ...all].slice(0, MAX_OPEN)))
    load()
  }, [load])

  const value = useMemo(() => ({ openConversation }), [openConversation])

  return (
    <ChatContext.Provider value={value}>
      {children}

      {profile && !profile.is_guest && (
        <div className="pointer-events-none fixed bottom-0 right-0 z-40 hidden items-end gap-2 px-6 md:flex">
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

      {/*
        * The card, over everything, once each way.
        *
        * Shown when a suspension has not been read, and again when it has
        * run out and that has not been read — which is what Staw asked
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
            onUnderstand={quiet.read}
          />
        </div>
      )}
    </ChatContext.Provider>
  )
}
