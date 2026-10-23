import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faUserPlus, faCheck, faEllipsis, faUser, faBolt, faSeedling,
  faArrowDownAZ, faUserGroup, faUsers, faComment,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { BrowseHero } from '@/components/browse/BrowseHero'
import { BrowseRail, BrowseFrame, BrowseHeading } from '@/components/browse/BrowseRail'
import type { RailItem } from '@/components/browse/BrowseRail'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { NameMarks } from '@/components/brand/Verified'
import { StatusDot, presenceOf, presenceWords } from '@/components/ui/StatusDot'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { listPeople, peopleList, sendFriendRequest, startConversation } from '@/lib/api'
import { useChatDock } from '@/components/chat/ChatDock'
import { Menu } from '@/components/ui/Menu'
import { usePersonActions } from '@/components/social/personActions'
import type { PeopleSort } from '@/lib/api'
import { profileLink } from '@/lib/links'
import { formatCount, timeAgo } from '@/lib/format'
import type { Profile } from '@/types/db'
import { AdBanner } from '@/components/ads/AdBanner'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { cn } from '@/lib/cn'

/*
 * People, put in order.
 *
 * Staw, on what was wrong with it: "a grid of cards with an advert cut into
 * the middle of it, and every card the same weight whether it is you, a
 * friend or a stranger."
 *
 * Both fixed here, and they are the same fix twice - the page had no idea
 * who it was showing you. The advert is out of the grid and at the foot of
 * the rail; your own card is a strip above the grid rather than the
 * fourteenth tile in it; and a friend's card says so and offers the thing
 * you actually do with a friend, which is write to them, instead of offering
 * to befriend somebody you already befriended.
 */

type Shelf = PeopleSort | 'friends'

const SHELVES: { value: Shelf; label: string; icon: typeof faBolt }[] = [
  { value: 'active', label: 'Around now', icon: faBolt },
  { value: 'new', label: 'Newest', icon: faSeedling },
  { value: 'name', label: 'A to Z', icon: faArrowDownAZ },
]

export default function People() {
  useTitle('People')
  const { profile } = useAuth()
  const toast = useToast()
  const { openConversation } = useChatDock()

  const [params, setParams] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(term)
  const [shelf, setShelf] = useState<Shelf>('active')
  const [sent, setSent] = useState<string[]>([])

  // The words live in the address, so the bar at the top of the site hands
  // its search straight to this page and a search can be linked to.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(term)
      setParams(term ? { q: term } : {}, { replace: true })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [term, setParams])

  const sort: PeopleSort = shelf === 'friends' ? 'active' : shelf

  const people = useAsync(
    () => listPeople({ search: debounced, sort, limit: 48 }),
    [debounced, sort],
  )

  /*
   * Who you are already friends with, so a card can weigh itself. Asked
   * once for the page rather than per card: forty-eight cards each asking
   * about one person is forty-eight requests to answer a question one
   * request answers.
   */
  const friends = useAsync(
    async () => (profile && !profile.is_guest ? peopleList(profile.id, 'friends') : []),
    [profile?.id, profile?.is_guest],
  )

  const friendIds = useMemo(
    () => new Set((friends.data ?? []).map((one) => one.id)),
    [friends.data],
  )

  const add = async (person: Profile) => {
    if (!profile) return
    try {
      await sendFriendRequest(profile.id, person.id)
      setSent((all) => [...all, person.id])
      toast(`Friend request sent to ${person.display_name}.`, 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'That did not send.'
      toast(
        message.includes('row-level security')
          ? 'Guests cannot add friends. Make an account and you can.'
          : message.includes('duplicate')
            ? 'You already asked this person.'
            : message,
        'error',
      )
    }
  }

  const actions = usePersonActions(() => people.reload())

  /*
   * Writing to a friend opens the chat dock, the way the friend list's hover
   * card does. Not a link to /inbox with a username on it: no such address
   * exists, and a button that goes nowhere is the fake functionality the
   * ethos rules out.
   */
  const chat = async (person: Profile) => {
    try {
      openConversation(await startConversation(person.id))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open that chat.', 'error')
    }
  }

  const menuFor = (person: Profile) => (
    <Menu
      label={`Options for ${person.display_name}`}
      trigger={
        <span className="grid h-8 w-8 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white">
          <Glyph icon={faEllipsis} />
        </span>
      }
      items={[
        { label: 'Open profile', icon: faUser, to: profileLink(person) },
        ...actions.itemsFor(person, {}),
      ]}
    />
  )

  const found = people.data ?? []

  /*
   * Your own card is lifted out of the grid. It was in there, sorted among
   * strangers with a small "You" tag on it, which means the one card on the
   * page you can do nothing with was taking a tile in the middle of the
   * forty-seven you can.
   */
  const you = profile ? found.find((one) => one.id === profile.id) ?? null : null
  const others = useMemo(() => {
    const rows = found.filter((one) => one.id !== profile?.id)
    return shelf === 'friends' ? rows.filter((one) => friendIds.has(one.id)) : rows
  }, [found, profile?.id, shelf, friendIds])

  const items: RailItem<Shelf>[] = [
    /* No count on the three sorts: it would be the length of whatever is
       on screen printed three times, true of one of them. "Your friends" is
       a real number of its own, so it keeps one. */
    ...SHELVES.map((one) => ({
      value: one.value,
      label: one.label,
      icon: one.icon,
    })),
    ...(profile && !profile.is_guest
      ? [{
        value: 'friends' as const,
        label: 'Your friends',
        icon: faUserGroup,
        count: friends.loading ? null : (friends.data?.length ?? 0),
      }]
      : []),
  ]

  const heading = debounced
    ? 'Results'
    : shelf === 'friends'
      ? 'Your friends'
      : shelf === 'new'
        ? 'Newest here'
        : shelf === 'name'
          ? 'Everybody, A to Z'
          : 'Around now'

  return (
    <Page width="wide" className="space-y-6">
      <BrowseHero
        title="People"
        lead="Everybody on Kobblon. Search a name, a username, or the words somebody wrote about themselves."
        icon={faUsers}
        value={term}
        onChange={setTerm}
        placeholder="Search everybody"
      />

      <BrowseFrame
        rail={
          <BrowseRail
            label="How to look through the people"
            items={items}
            value={shelf}
            onChange={setShelf}
            foot={<AdBanner size="tall" quiet />}
          />
        }
      >
        {/* You, once, at the top. One rectangle with your face and where to
            go from it, which is all your own card on this page can be. */}
        {you && (
          <Link
            to={profileLink(you)}
            className="mb-5 flex items-center gap-4 rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/20 via-ink-card to-ink-card p-4 transition-colors hover:border-brand/70"
          >
            <PersonAvatar person={you} size="lg" square ring="ring-ink-card" />
            <span className="min-w-0 flex-1">
              <span className="font-display text-[10px] font-extrabold uppercase tracking-[0.25em] text-white/45">
                This is you
              </span>
              <span className="mt-0.5 flex items-center gap-1.5">
                <span className="truncate font-bold">{you.display_name}</span>
                <NameMarks person={you} className="text-[11px]" />
              </span>
              <span className="block truncate text-xs text-muted">@{you.username}</span>
            </span>
            <span className="hidden text-xs font-bold text-link sm:block">Your profile</span>
          </Link>
        )}

        <BrowseHeading
          title={heading}
          note={
            people.loading
              ? 'Looking…'
              : debounced
                ? `${formatCount(others.length)} for "${debounced}"`
                : `${formatCount(others.length)} ${others.length === 1 ? 'person' : 'people'}`
          }
        />

        {people.loading && (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[7.5rem] rounded-2xl" />
            ))}
          </div>
        )}

        {people.error && <ErrorState message={people.error} onRetry={people.reload} />}

        {!people.loading && !people.error && !others.length && (
          <Card className="p-5">
            <EmptyState
              mood="noResults"
              title={
                shelf === 'friends'
                  ? 'No friends yet'
                  : 'Kobby could not find anybody'
              }
              body={
                debounced
                  ? `Nothing matches "${debounced}".`
                  : shelf === 'friends'
                    ? 'Add somebody from this page and they will be here once they say yes.'
                    : 'Nobody to show yet.'
              }
              action={
                debounced
                  ? <Button variant="subtle" onClick={() => setTerm('')}>Clear the search</Button>
                  : shelf === 'friends'
                    ? <Button variant="subtle" onClick={() => setShelf('active')}>
                      Everybody
                    </Button>
                    : undefined
              }
            />
          </Card>
        )}

        {!people.loading && !!others.length && (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                friend={friendIds.has(person.id)}
                sent={sent.includes(person.id)}
                onAdd={() => add(person)}
                onMessage={() => chat(person)}
                menu={menuFor(person)}
              />
            ))}
          </div>
        )}

        {/* The rail's foot is hidden on a phone, so the slot goes under the
            grid there rather than into the middle of it. */}
        {!people.loading && !!others.length && <AdBanner className="mt-6 lg:hidden" quiet />}
      </BrowseFrame>

      {actions.dialog}
    </Page>
  )
}

/**
 * One person, and the card knows which one.
 *
 * A stranger gets "Add". A friend gets a green edge, the word, and the door
 * you actually use on a friend, which is a message. Offering to befriend
 * somebody who is already your friend is the kind of control that teaches
 * people not to read the buttons.
 */
function PersonCard({ person, friend, sent, onAdd, onMessage, menu }: {
  person: Profile
  friend: boolean
  sent: boolean
  onAdd: () => void
  onMessage: () => void
  menu?: React.ReactNode
}) {
  const presence = presenceOf(person)
  const here = presence !== 'offline'

  return (
    <article
      className={cn(
        'group flex flex-col gap-3 rounded-2xl border bg-ink-card p-4 transition-colors',
        friend ? 'border-space/40 hover:border-space/70' : 'border-ink-line hover:border-brand/60',
      )}
    >
      <div className="flex items-start gap-3.5">
        <Link to={profileLink(person)} className="relative shrink-0">
          <PersonAvatar person={person} size="lg" square ring="ring-ink-card" />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to={profileLink(person)}
            className="flex items-center gap-1.5 hover:text-link"
          >
            <span className="truncate font-bold">{person.display_name}</span>
            <NameMarks person={person} className="text-[11px]" />
          </Link>
          <p className="truncate text-xs text-muted">@{person.username}</p>

          {/* The second line: where they are, or when they last were. It is
              the one thing about a stranger worth knowing from a grid. */}
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold">
            <StatusDot presence={presence} size="xs" />
            <span className={here ? 'text-white/70' : 'text-white/40'}>
              {here
                ? presenceWords[presence]
                : person.last_seen_at
                  ? `Last seen ${timeAgo(person.last_seen_at)}`
                  : 'Offline'}
            </span>
            {friend && (
              <span className="ml-1 font-extrabold uppercase tracking-wide text-space-bright">
                Friend
              </span>
            )}
          </p>
        </div>

        {menu}
      </div>

      <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-white/55">
        {person.bio || <span className="text-white/25">Nothing written yet.</span>}
      </p>

      <div className="flex items-center gap-1.5">
        {friend ? (
          <Button size="sm" variant="subtle" icon={faComment} onClick={onMessage}>
            Message
          </Button>
        ) : (
          <Button
            size="sm"
            variant={sent ? 'subtle' : 'primary'}
            icon={sent ? faCheck : faUserPlus}
            disabled={sent}
            onClick={onAdd}
          >
            {sent ? 'Sent' : 'Add'}
          </Button>
        )}
        <Button size="sm" variant="ghost" to={profileLink(person)}>Profile</Button>
      </div>
    </article>
  )
}
