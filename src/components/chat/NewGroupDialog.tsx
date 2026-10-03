import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faUserGroup, faCheck } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/States'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { createGroupConversation, peopleList } from '@/lib/api'
import { cn } from '@/lib/cn'
import { avatarOf } from '@/lib/avatars'
import { LivePresenceLabel } from '@/components/ui/PersonAvatar'

const MAX = 5

/** The panel the pencil opens: name it, pick up to five friends, create. */
export function NewGroupDialog({
  onClose, onCreated,
}: {
  onClose: () => void
  onCreated: (conversationId: string) => void
}) {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [term, setTerm] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, loading } = useAsync(
    async () => (profile ? peopleList(profile.id, 'friends') : []),
    [profile?.id],
  )

  const friends = (data ?? [])
    .filter((friend) =>
      friend.display_name.toLowerCase().includes(term.trim().toLowerCase()) ||
      friend.username.toLowerCase().includes(term.trim().toLowerCase()))

  const toggle = (id: string) => {
    setPicked((all) =>
      all.includes(id) ? all.filter((x) => x !== id) : all.length < MAX ? [...all, id] : all)
  }

  const create = async () => {
    setPending(true)
    setError(null)
    try {
      onCreated(await createGroupConversation(title, picked))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="pointer-events-auto flex h-96 w-72 flex-col overflow-hidden rounded-t-xl border border-b-0 border-ink-line bg-ink-card shadow-pop">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-ink-line px-3">
        <FontAwesomeIcon icon={faUserGroup} className="text-white/40" />
        <h2 className="flex-1 text-sm font-extrabold">New Chat Group</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
        >
          &times;
        </button>
      </header>

      <div className="space-y-2 p-2">
        <label className="sr-only" htmlFor="group-name">Name your chat group</label>
        <input
          id="group-name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={48}
          placeholder="Name your chat group"
          className="h-9 w-full rounded-lg border border-ink-line bg-ink-raised px-3 text-sm placeholder:text-white/30 focus:border-brand-bright"
        />

        <div className="relative">
          <label className="sr-only" htmlFor="group-friends">Search for friends</label>
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/35"
          />
          <input
            id="group-friends"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search for friends"
            className="h-9 w-full rounded-lg border border-ink-line bg-ink-raised pl-8 pr-12 text-sm placeholder:text-white/30 focus:border-brand-bright"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/35">
            ({picked.length}/{MAX})
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto kob-scroll">
        {loading && (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-11" />)}
          </div>
        )}

        {!loading && !friends.length && (
          <p className="px-4 py-6 text-center text-xs text-muted">
            You need friends before you can group them.
          </p>
        )}

        {friends.map((friend) => {
          const on = picked.includes(friend.id)
          return (
            <button
              key={friend.id}
              onClick={() => toggle(friend.id)}
              aria-pressed={on}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ink-hover"
            >
              <Avatar src={avatarOf(friend)} personId={friend.id} name={friend.display_name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{friend.display_name}</span>
                <LivePresenceLabel person={friend} />
              </span>
              <span
                className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center rounded border text-[10px] transition-colors',
                  on ? 'border-brand-bright bg-brand text-white' : 'border-ink-line',
                )}
              >
                {on && <FontAwesomeIcon icon={faCheck} />}
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="px-3 pb-1 text-xs text-danger">{error}</p>}

      <div className="flex shrink-0 gap-2 border-t border-ink-line p-2">
        <Button size="sm" variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          className="flex-1"
          loading={pending}
          disabled={!picked.length}
          onClick={create}
        >
          Create
        </Button>
      </div>
    </section>
  )
}
