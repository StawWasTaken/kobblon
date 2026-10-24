import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faCheck, faComment, faEllipsis, faFilter, faInbox, faUserGroup, faUserPlus,
  faUsers, faXmark, faHeart, faBan, faEyeSlash, faUser,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Menu } from '@/components/ui/Menu'
import { Avatar } from '@/components/ui/Avatar'
import type { Presence } from '@/components/ui/StatusDot'
import { StatusDot } from '@/components/ui/StatusDot'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { useLivePresence } from '@/hooks/usePresenceStore'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useChatDock } from '@/components/chat/ChatDock'
import { presenceNow, usePresenceVersion } from '@/hooks/usePresenceStore'
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
import { NameMarks } from '@/components/brand/Verified'
import { Tooltip } from '@/components/ui/Tooltip'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { FriendPeek } from '@/components/social/FriendPeek'

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
  // Both sides of following wear the heart, because they are one relation
  // read from either end. The star used to mark followers and said nothing
  // about what a follower is.
  { name: 'Followers', icon: faHeart, list: 'followers' },
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
 * One person, on a card.
 *
 * It was a line before, three across, and the line had everything on it at
 * the same weight: a small square picture, the name, the presence and the
 * buttons all on one row, so nothing in it read first. Staw, about the
 * page: "it sucks". He is right, and this is the part that made it so.
 *
 * So: the face at a size worth looking at, the name under nothing else, the
 * presence as its own line with the dot that means it, and the doors along
 * the bottom where the eye lands last. The "..." only shows on hover or
 * when something in it has focus, because six of them in a grid is a row
 * of dots and nothing else.
 */
export function PersonCard({
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
        'group relative flex flex-col gap-3 rounded-2xl border border-ink-line bg-ink-card p-4',
        'transition-colors hover:border-brand/60',
        quiet && 'opacity-70',
      )}
    >
      {menu && (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {menu}
        </div>
      )}

      <div className="flex items-center gap-3">
        <FriendPeek friend={person} className="shrink-0">
          <Link to={profileLink(person)} className="block">
            <PersonAvatar person={person} size="lg" className="h-14 w-14" ring="ring-ink-card" />
          </Link>
        </FriendPeek>

        <div className="min-w-0 flex-1 pr-6">
          <Link to={profileLink(person)} className="flex items-center gap-1.5 hover:text-link">
            {/* A best friend, who is also at the top of the list: the mark is
                what stops that ordering reading as random. */}
            {person.best && (
              <Tooltip label="Best friends" side="top">
                <Glyph icon={faHeart} className="shrink-0 text-[11px] text-brand-bright" />
              </Tooltip>
            )}
            <span className="truncate font-display text-base font-extrabold leading-tight">
              {person.display_name}
            </span>
            <NameMarks person={person} className="text-[11px]" />
          </Link>

          <p className="truncate text-xs text-muted">@{person.username}</p>

          <p className="mt-1 flex items-center gap-1.5 text-xs">
            <StatusDot presence={presence} size="md" />
            <span className={cn('truncate', presence === 'in-space' ? 'text-space-bright' : 'text-muted')}>
              {note ?? presenceWord[presence]}
            </span>
            {person.i_ignore && (
              <span
                title="You are ignoring this person"
                className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted"
              >
                Ignored
              </span>
            )}
          </p>
        </div>
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </li>
  )
}

/**
 * One of the lists, as a tab.
 *
 * The six numbers used to be six big tiles across the top, which gave
 * "Blocked" the same weight on the page as "Friends" and pushed the people
 * below the fold. A tab with its count beside it says the same thing in a
 * row that leaves the page to the list.
 */
export function ListTab({
  icon, name, count, active, onClick,
}: {
  icon: IconDefinition
  name: string
  count: number | null
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-colors',
        active ? 'bg-brand text-white' : 'text-muted hover:bg-ink-hover hover:text-white',
      )}
    >
      <Glyph icon={icon} className="text-xs" />
      {name}
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
          active ? 'bg-black/25 text-white' : 'bg-white/10 text-white/70',
        )}
      >
        {count ?? '·'}
      </span>
    </button>
  )
}

/** A heading over a run of people, with how many are in it. */
function Band({ icon, children, count }: {
  icon: IconDefinition
  children: React.ReactNode
  count?: number
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted">
      <Glyph icon={icon} />
      {children}
      {count !== undefined && <span className="text-white/35 tabular-nums">({count})</span>}
    </h2>
  )
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
}

function Loading() {
  return <List>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[8.5rem] rounded-2xl" />)}</List>
}

export default function Friends() {
  /* The split below reads presence directly, so this page re-renders when
     anybody's moves rather than holding the answer it had at mount. */
  usePresenceVersion()
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

  /*
   * One address for your own list.
   *
   * Staw: "id like that the pages /u/1010/stawrer/friends?list=friends and
   * /friends be actually the same". They rendered the same component
   * already, but as two addresses - which meant two entries in the back
   * button, two things to link to, and a page that had to fetch your own
   * profile by number before it could draw a list it already had. Reaching
   * your own through a profile now lands on /friends, carrying whichever
   * list was asked for.
   */
  const mineAtTheirAddress = !!id && !!profile && viewed.data?.id === profile.id

  const asked = (search.get('list') ?? '').toLowerCase()
  const [tab, setTab] = useState<Tab>(fromQuery[asked] ?? 'Friends')
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
  /*
   * Who is here, asked the same way the card under the name asks.
   *
   * It was `one.is_online` - the row's own flag, which `presenceOf` will
   * not believe once `last_seen_at` has gone stale. So three people sat
   * under "Around now" each saying Offline, which is the heading and the
   * label disagreeing rather than either of them being broken.
   */
  const online = (friends.data ?? []).filter((one) => presenceNow(one) !== 'offline').length
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
            <Glyph icon={faEllipsis} />
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

  /*
   * Friends split by whether anybody is there. The page is mostly used to
   * start something with somebody, and somebody who is not there cannot be
   * started with, so the ones who are go first and say so.
   */
  const here = current.name === 'Friends'
    ? shown.filter((one) => presenceNow(one) !== 'offline')
    : []
  const away = current.name === 'Friends'
    ? shown.filter((one) => presenceNow(one) === 'offline')
    : shown

  const doorsFor = (person: Person) => (
    current.name === 'Blocked'
      ? (
        <Button
          size="sm" variant="subtle" block
          onClick={() => people.askFor({ kind: 'unblock', person })}
        >
          Unblock
        </Button>
      )
      : current.name === 'Ignored'
        ? (
          <Button size="sm" variant="subtle" block onClick={() => people.act('unignore', person)}>
            Stop ignoring
          </Button>
        )
        : (
          <>
            <Button size="sm" variant="subtle" className="flex-1" to={profileLink(person)}>
              Profile
            </Button>
            {isMe && current.name === 'Friends' && (
              <Button size="sm" icon={faComment} className="flex-1" onClick={() => chat(person.id)}>
                Chat
              </Button>
            )}
          </>
        )
  )

  const cardFor = (person: Person) => (
    <PersonCard
      key={person.id}
      person={person}
      quiet={current.name === 'Blocked' || person.i_ignore}
      note={
        current.name === 'Blocked' ? `Blocked ${timeAgo(person.since)}`
          : current.name === 'Ignored' ? `Ignored ${timeAgo(person.since)}`
            : undefined
      }
      actions={doorsFor(person)}
      menu={isMe && current.name !== 'Blocked' && current.name !== 'Ignored'
        ? menuFor(person, {
          are_friends: current.name === 'Friends',
          i_ignore: person.i_ignore,
        })
        : undefined}
    />
  )

  if (mineAtTheirAddress) {
    return <Navigate to={asked ? `/friends?list=${asked}` : '/friends'} replace />
  }

  return (
    <Page className="space-y-5">
      {/*
        * One band across the top: who this list belongs to, how many are in
        * it, the way to find more, and the filter - rather than a title, a
        * row of six tiles and a search box stacked down the page before
        * anybody appears.
        */}
      <header className="overflow-hidden rounded-3xl border border-ink-line bg-ink-card">
        <div className="flex flex-wrap items-center gap-4 bg-gradient-to-br from-brand/25 via-ink-raised to-ink-raised px-5 py-5 sm:px-6">
          {who && (
            <Link to={profileLink(who)} className="shrink-0">
              <Avatar
                src={avatarOf(who)}
                personId={who.id}
                name={who.display_name}
                size="xl"
                className="rounded-2xl ring-2 ring-white/10"
              />
            </Link>
          )}

          <div className="min-w-0 flex-1">
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

          <div className="flex w-full items-center gap-2 sm:w-auto">
            {current.name !== 'Requests' && (
              <Input
                icon={faFilter}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={`Filter ${current.name.toLowerCase()}`}
                aria-label={`Filter ${current.name.toLowerCase()}`}
                className="w-full sm:w-56"
              />
            )}
            {isMe
              ? <Button variant="subtle" icon={faUsers} to="/people" className="shrink-0">Find people</Button>
              : who && (
                <Button variant="subtle" to={profileLink(who)} className="shrink-0">
                  Their profile
                </Button>
              )}
          </div>
        </div>

        {/* The lists, as tabs. On a phone it scrolls sideways, which is the
            one place sideways is right: six words, not sixty faces. */}
        <nav
          aria-label="Lists"
          className="flex gap-1 overflow-x-auto border-t border-ink-line px-2 py-2"
        >
          {shownTabs.map((one) => {
            const of = {
              Friends: friends, Requests: incoming, Followers: followers,
              Following: following, Ignored: ignored, Blocked: blocked,
            }[one.name]
            return (
              <ListTab
                key={one.name}
                icon={one.icon}
                name={one.name}
                count={of.loading ? null : of.data?.length ?? 0}
                active={current.name === one.name}
                onClick={() => setTab(one.name)}
              />
            )
          })}
        </nav>
      </header>

      {source.error && <ErrorState message={source.error} onRetry={source.reload} />}
      {source.loading && <Loading />}

      {current.name === 'Requests' && isMe ? (
        <div className="space-y-6">
          <section>
            <Band icon={faInbox} count={waiting}>Waiting on you</Band>
            {!incoming.loading && !incoming.data?.length && (
              <p className="text-sm text-muted">Nobody has asked.</p>
            )}
            {!!incoming.data?.length && (
              <List>
                {incoming.data.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    note={`Asked ${timeAgo(person.since)}`}
                    actions={
                      <>
                        <Button
                          size="sm" icon={faCheck} className="flex-1"
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
            <Band icon={faUserPlus} count={outgoing.data?.length ?? 0}>You asked</Band>
            {!outgoing.data?.length ? (
              <p className="text-sm text-muted">You have not asked anybody.</p>
            ) : (
              <List>
                {outgoing.data.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    note={`Sent ${timeAgo(person.since)}`}
                    actions={
                      <Button
                        size="sm" variant="subtle" block
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

          {!!here.length && (
            <section>
              <Band icon={faUserGroup} count={here.length}>Around now</Band>
              <List>{here.map(cardFor)}</List>
            </section>
          )}

          {!!away.length && (
            <section>
              {current.name === 'Friends' && !!here.length && (
                <Band icon={faUserGroup} count={away.length}>Everybody else</Band>
              )}
              <List>{away.map(cardFor)}</List>
            </section>
          )}
        </>
      )}

      {people.dialog}
    </Page>
  )
}
