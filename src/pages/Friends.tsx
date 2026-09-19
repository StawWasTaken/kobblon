import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck, faComment, faEllipsis, faFilter, faInbox, faUserGroup, faUserPlus,
  faUsers, faXmark, faHeart, faStar, faBan, faEyeSlash, faUser,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Menu } from '@/components/ui/Menu'
import { StatTile } from '@/components/ui/StatTile'
import { Avatar } from '@/components/ui/Avatar'
import type { Presence } from '@/components/ui/StatusDot'
import { useLivePresence } from '@/hooks/usePresenceStore'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useChatDock } from '@/components/chat/ChatDock'
import { usePersonActions } from '@/components/social/personActions'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  getProfileByUsername, peopleList, removeFriendship, respondToFriendRequest,
  startConversation, usernameById,
} from '@/lib/api'
import type { PeopleList, PersonRow as Person } from '@/lib/api'
import { avatarOf } from '@/lib/avatars'
import { profileLink } from '@/lib/links'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Verified, isVerified } from '@/components/brand/Verified'
import { PersonAvatar } from '@/components/ui/PersonAvatar'

/*
 * One page for everybody you are tied to, and everybody you are not.
 *
 * Friends, the requests either way, the two sides of following, and, on your
 * own page only, the people you have shut out. Blocking and ignoring belong
 * here rather than buried in settings: they are about people, so they live
 * with the people.
 */
const tabs = [
  { name: 'Friends', icon: faUserGroup, list: 'friends' },
  { name: 'Requests', icon: faInbox, list: 'requests', mineOnly: true },
  { name: 'Followers', icon: faStar, list: 'followers' },
  { name: 'Following', icon: faHeart, list: 'following' },
  { name: 'Ignored', icon: faEyeSlash, list: 'ignored', mineOnly: true },
  { name: 'Blocked', icon: faBan, list: 'blocked', mineOnly: true },
] as const

type Tab = (typeof tabs)[number]['name']

const fromQuery: Record<string, Tab> = {
  friends: 'Friends', requests: 'Requests', followers: 'Followers',
  following: 'Following', ignored: 'Ignored', blocked: 'Blocked',
}

const presenceWord: Record<Presence, string> = {
  'in-space': 'In a World',
  building: 'Building something',
  online: 'Online',
  offline: 'Offline',
}

/**
 * A person in one of your lists: the picture, whether they are about, and
 * what you can do with them, on a single line you can run your eye down.
 */
function PersonLine({
  person, note, actions, menu, quiet,
}: {
  person: Person
  note?: string
  actions?: React.ReactNode
  menu?: React.ReactNode
  quiet?: boolean
}) {
  const presence = useLivePresence(person)

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-ink-line bg-ink-card p-3 transition-colors hover:border-brand/60',
        quiet && 'opacity-70',
      )}
    >
      <Link to={profileLink(person)} className="shrink-0">
        <PersonAvatar person={person} size="md" square ring="ring-ink-card" />
      </Link>

      <div className="min-w-0 flex-1">
        <Link to={profileLink(person)} className="flex items-center gap-1.5 hover:text-link">
          <span className="truncate text-sm font-bold">{person.display_name}</span>
          {isVerified(person) && <Verified className="text-[11px]" />}
          {person.i_ignore && (
            <span
              title="You are ignoring this person"
              className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted"
            >
              Ignored
            </span>
          )}
        </Link>
        <p className="truncate text-xs text-muted">
          @{person.username}
          <span className={cn(presence === 'in-space' && 'text-space-bright')}>
            {' · '}{note ?? presenceWord[presence]}
          </span>
        </p>
      </div>

      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      {menu}
    </li>
  )
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
}

function Loading() {
  return <List>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[4.75rem] rounded-2xl" />)}</List>
}

export default function Friends() {
  const { profile } = useAuth()
  const { openConversation } = useChatDock()
  const toast = useToast()

  /*
   * The same page, for anybody.
   *
   * Reached at /friends it is yours; reached from a profile it is theirs,
   * which is why the counts on a profile are links rather than lists opened
   * in place. Nobody else's requests, and nobody else's blocked list, is
   * anybody's business, so those are only there when the page is your own.
   */
  const { id } = useParams()
  const [search] = useSearchParams()

  const viewed = useAsync(
    async () => {
      if (!id) return null
      const name = await usernameById(Number(id))
      return name ? getProfileByUsername(name) : null
    },
    [id],
  )

  const who = id ? viewed.data : profile
  const isMe = !id || who?.id === profile?.id

  const [tab, setTab] = useState<Tab>(
    fromQuery[(search.get('list') ?? '').toLowerCase()] ?? 'Friends',
  )
  const shownTabs = tabs.filter((one) => isMe || !('mineOnly' in one && one.mineOnly))
  const current = shownTabs.find((one) => one.name === tab) ?? shownTabs[0]

  useTitle(
    !who ? 'Friends'
      : isMe ? 'My friends'
        : `${who.display_name}'s friends`,
  )

  const [term, setTerm] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setFilter(term.trim().toLowerCase()), 200)
    return () => window.clearTimeout(timer)
  }, [term])

  /** One list per kind, each asked for as it is needed and reloaded together. */
  const ask = (which: PeopleList) => useAsync(
    async () => (who ? peopleList(who.id, which) : []),
    [who?.id, which],
  )

  const friends = ask('friends')
  const incoming = ask('requests')
  const outgoing = ask('sent')
  const followers = ask('followers')
  const following = ask('following')
  const ignored = ask('ignored')
  const blocked = ask('blocked')

  const reloadAll = () => {
    friends.reload()
    incoming.reload()
    outgoing.reload()
    followers.reload()
    following.reload()
    ignored.reload()
    blocked.reload()
  }

  const people = usePersonActions(reloadAll)

  const source = {
    Friends: friends, Requests: incoming, Followers: followers,
    Following: following, Ignored: ignored, Blocked: blocked,
  }[current.name]

  const matches = (person: Person) =>
    !filter
    || person.display_name.toLowerCase().includes(filter)
    || person.username.toLowerCase().includes(filter)

  const shown = (source.data ?? []).filter(matches)
  const online = (friends.data ?? []).filter((one) => one.is_online).length
  const waiting = incoming.data?.length ?? 0

  const respond = async (requestId: string, accept: boolean) => {
    try {
      await respondToFriendRequest(requestId, accept)
      toast(accept ? 'You two are friends now.' : 'Request declined.', accept ? 'success' : 'info')
      reloadAll()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  const cancel = async (requestId: string) => {
    try {
      await removeFriendship(requestId)
      toast('Request taken back.', 'info')
      reloadAll()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  const chat = async (otherId: string) => {
    try {
      openConversation(await startConversation(otherId))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open that chat.', 'error')
    }
  }

  /** The "..." behind every line on your own page. */
  const menuFor = (person: Person, standing: {
    are_friends?: boolean; i_blocked?: boolean; i_ignore?: boolean
  }) => {
    const items = [
      { label: 'Open profile', icon: faUser, to: profileLink(person) },
      ...people.itemsFor(person, standing),
    ]
    return (
      <Menu
        label={`Options for ${person.display_name}`}
        trigger={
          <span className="grid h-8 w-8 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white">
            <FontAwesomeIcon icon={faEllipsis} />
          </span>
        }
        items={items}
      />
    )
  }

  const emptyFor: Record<Tab, { title: string; body: string }> = {
    Friends: {
      title: 'No friends yet',
      body: 'People is everybody on Kobblon. Send somebody a request and they turn up here.',
    },
    Requests: { title: 'Nothing waiting', body: 'Nobody has asked, and you have not asked anybody.' },
    Followers: { title: 'No followers yet', body: 'Publish something and people start following you.' },
    Following: { title: 'Not following anybody', body: 'Following somebody puts their new Worlds in front of you.' },
    Ignored: { title: 'Nobody ignored', body: 'Ignoring somebody keeps them as a friend and keeps them quiet.' },
    Blocked: { title: 'Nobody blocked', body: 'Blocking ends everything between you and somebody, both ways.' },
  }

  return (
    <Page className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          {!isMe && who && (
            <Link to={profileLink(who)} className="shrink-0">
              <Avatar src={avatarOf(who)} name={who.display_name} size="lg" className="rounded-2xl" />
            </Link>
          )}
          <div>
            <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
              {isMe ? 'My friends' : who ? `${who.display_name}'s friends` : 'Friends'}
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              {friends.data?.length
                ? `${friends.data.length} ${friends.data.length === 1 ? 'friend' : 'friends'}${isMe ? `, ${online} online` : ''}.`
                : isMe
                  ? 'Nobody yet. People is where you find somebody.'
                  : 'No friends yet.'}
            </p>
          </div>
        </div>

        {isMe
          ? <Button variant="subtle" icon={faUsers} to="/people">Find people</Button>
          : who && <Button variant="subtle" to={profileLink(who)}>Back to their profile</Button>}
      </header>

      {/* The numbers are the lists, and each one is the way in. */}
      <div className={cn('grid grid-cols-2 gap-2.5', isMe ? 'sm:grid-cols-3 xl:grid-cols-6' : 'sm:grid-cols-3')}>
        <StatTile
          icon={faUserGroup}
          value={friends.loading ? null : friends.data?.length ?? 0}
          label="Friends" active={current.name === 'Friends'} onClick={() => setTab('Friends')}
        />
        {isMe && (
          <StatTile
            icon={faInbox}
            value={incoming.loading ? null : waiting}
            label={waiting === 1 ? 'Request' : 'Requests'}
            active={current.name === 'Requests'} onClick={() => setTab('Requests')}
          />
        )}
        <StatTile
          icon={faStar}
          value={followers.loading ? null : followers.data?.length ?? 0}
          label="Followers" active={current.name === 'Followers'} onClick={() => setTab('Followers')}
        />
        <StatTile
          icon={faHeart}
          value={following.loading ? null : following.data?.length ?? 0}
          label="Following" active={current.name === 'Following'} onClick={() => setTab('Following')}
        />
        {isMe && (
          <>
            <StatTile
              icon={faEyeSlash}
              value={ignored.loading ? null : ignored.data?.length ?? 0}
              label="Ignored" active={current.name === 'Ignored'} onClick={() => setTab('Ignored')}
            />
            <StatTile
              icon={faBan}
              value={blocked.loading ? null : blocked.data?.length ?? 0}
              label="Blocked" active={current.name === 'Blocked'} onClick={() => setTab('Blocked')}
            />
          </>
        )}
      </div>

      {current.name !== 'Requests' && (
        <Input
          icon={faFilter}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={`Filter ${current.name.toLowerCase()}`}
          aria-label={`Filter ${current.name.toLowerCase()}`}
        />
      )}

      {source.error && <ErrorState message={source.error} onRetry={source.reload} />}
      {source.loading && <Loading />}

      {current.name === 'Requests' && isMe ? (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted">
              <FontAwesomeIcon icon={faInbox} />
              Waiting on you
            </h2>
            {!incoming.loading && !incoming.data?.length && (
              <p className="text-sm text-muted">Nobody has asked.</p>
            )}
            {!!incoming.data?.length && (
              <List>
                {incoming.data.map((person) => (
                  <PersonLine
                    key={person.id}
                    person={person}
                    note={`Asked ${timeAgo(person.since)}`}
                    actions={
                      <>
                        <Button
                          size="sm" icon={faCheck}
                          onClick={() => person.link_id && respond(person.link_id, true)}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm" variant="ghost" icon={faXmark}
                          aria-label={`Decline ${person.display_name}`}
                          onClick={() => person.link_id && respond(person.link_id, false)}
                        />
                      </>
                    }
                    menu={menuFor(person, { i_ignore: person.i_ignore })}
                  />
                ))}
              </List>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted">
              <FontAwesomeIcon icon={faUserPlus} />
              You asked
            </h2>
            {!outgoing.data?.length ? (
              <p className="text-sm text-muted">You have not asked anybody.</p>
            ) : (
              <List>
                {outgoing.data.map((person) => (
                  <PersonLine
                    key={person.id}
                    person={person}
                    note={`Sent ${timeAgo(person.since)}`}
                    actions={
                      <Button
                        size="sm" variant="subtle"
                        onClick={() => person.link_id && cancel(person.link_id)}
                      >
                        Take back
                      </Button>
                    }
                  />
                ))}
              </List>
            )}
          </section>
        </div>
      ) : (
        <>
          {!source.loading && !shown.length && (
            <Card>
              <EmptyState
                mood={filter ? 'noResults' : 'emptyBox'}
                title={filter ? 'Nobody here matches' : emptyFor[current.name].title}
                body={filter ? 'Try fewer letters.' : emptyFor[current.name].body}
                action={
                  filter
                    ? <Button variant="subtle" onClick={() => setTerm('')}>Clear the filter</Button>
                    : current.name === 'Friends'
                      ? <Button icon={faUsers} to="/people">Find people</Button>
                      : undefined
                }
              />
            </Card>
          )}

          {!!shown.length && (
            <List>
              {shown.map((person) => (
                <PersonLine
                  key={person.id}
                  person={person}
                  quiet={current.name === 'Blocked' || person.i_ignore}
                  note={
                    current.name === 'Blocked' ? `Blocked ${timeAgo(person.since)}`
                      : current.name === 'Ignored' ? `Ignored ${timeAgo(person.since)}`
                        : undefined
                  }
                  actions={
                    current.name === 'Blocked'
                      ? (
                        <Button
                          size="sm" variant="subtle"
                          onClick={() => people.askFor({ kind: 'unblock', person })}
                        >
                          Unblock
                        </Button>
                      )
                      : current.name === 'Ignored'
                        ? (
                          <Button
                            size="sm" variant="subtle"
                            onClick={() => people.act('unignore', person)}
                          >
                            Stop ignoring
                          </Button>
                        )
                        : current.name === 'Friends' && isMe
                          ? <Button size="sm" icon={faComment} onClick={() => chat(person.id)}>Chat</Button>
                          : <Button size="sm" variant="subtle" to={profileLink(person)}>Profile</Button>
                  }
                  menu={isMe && current.name !== 'Blocked' && current.name !== 'Ignored'
                    ? menuFor(person, {
                      are_friends: current.name === 'Friends',
                      i_ignore: person.i_ignore,
                    })
                    : undefined}
                />
              ))}
            </List>
          )}
        </>
      )}

      {people.dialog}
    </Page>
  )
}
