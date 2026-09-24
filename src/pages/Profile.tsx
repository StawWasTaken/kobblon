import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faComment, faFlag, faUserPlus, faClock, faUserCheck,
  faEllipsis, faLink, faCubes, faEye, faAward, faShapes, faUsers, faBan,
  faPalette, faPen, faCircleInfo,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { EmptyState, ErrorState, SpaceCardSkeleton, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { ReportDialog } from '@/components/social/ReportDialog'
import { WorldCard } from '@/components/worlds/WorldCard'
import { BadgeTile } from '@/components/social/BadgeGrid'
import { AssetTile } from '@/components/create/AssetTile'
import { useChatDock } from '@/components/chat/ChatDock'
import { faDiscord } from '@fortawesome/free-brands-svg-icons'
import { worldIcon } from '@/lib/naming'
import { Menu } from '@/components/ui/Menu'
import { Tooltip } from '@/components/ui/Tooltip'
import { Tabs } from '@/components/ui/Tabs'
import { Emblem } from '@/components/community/Emblem'
import { usePersonActions } from '@/components/social/personActions'
import { Dialog } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Input'
import { ColourPicker } from '@/components/ui/ColourPicker'
import { GuestGate } from '@/components/ui/GuestGate'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useCanonicalPath } from '@/hooks/useCanonicalPath'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import {
  addressNow, discordHandleOf, getProfileByUsername, getProfileOverview, isFollowing, listEarnedBadges, peopleList,
  listMemberCommunities, listWorldsByOwner, sendFriendRequest, setFollowing, standingWith,
  startConversation,
  usernameHistory, usernameById, listAssetsByCreator, updateProfile, uploadAvatar,
} from '@/lib/api'
import { formatCount } from '@/lib/format'
import { communityLink, profileLink } from '@/lib/links'
import { avatarOf } from '@/lib/avatars'
import { Verified } from '@/components/brand/Verified'
import { PenIcon } from '@/components/brand/PenIcon'

/** The colour somebody chose for their page, or the house one. */
const BRAND = '#1B34E8'
const accentOf = (colour?: string | null) =>
  (colour && /^#[0-9a-f]{6}$/i.test(colour) ? colour : BRAND)

/**
 * A heading with the person's own colour under it.
 *
 * Sections are how this page is read now: there are no tabs, because a
 * profile is not four filing cabinets, it is somebody's work with their name
 * on it.
 */
function Heading({ icon, children, aside }: {
  icon: IconDefinition
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <h2 className="relative flex items-center gap-2.5 font-display text-xl font-extrabold sm:text-2xl">
        <FontAwesomeIcon icon={icon} className="text-base opacity-70" />
        {children}
        <span
          aria-hidden="true"
          className="absolute -bottom-1.5 left-0 h-[3px] w-10 rounded-full"
          style={{ background: 'var(--me)' }}
        />
      </h2>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  )
}

/** A number that earned its place, said in words rather than stacked in a wall. */
function Fact({ icon, children }: { icon: IconDefinition; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-white/60">
      <FontAwesomeIcon icon={icon} className="text-xs" style={{ color: 'var(--me)' }} />
      {children}
    </span>
  )
}

type Face = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  content_id?: number | null
  is_online?: boolean
  in_space_id?: string | null
  activity?: string | null
  last_seen_at?: string | null
}

function Faces({ people }: { people: Face[] }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 kob-scroll">
      {people.map((person) => (
        <Link
          key={person.id}
          to={profileLink(person)}
          className="w-24 shrink-0 rounded-xl p-2 text-center transition-colors hover:bg-ink-hover"
        >
          <PersonAvatar person={person} size="lg" square />
          <p className="mt-1.5 truncate text-xs font-bold">{person.display_name}</p>
          <p className="truncate text-[11px] text-muted">@{person.username}</p>
        </Link>
      ))}
    </div>
  )
}

export default function Profile() {
  const { username = '', id } = useParams()
  const { profile: me, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { openConversation } = useChatDock()

  const [following, setFollowingState] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [about, setAbout] = useState(false)
  const [tab, setTab] = useState<'About' | 'Creations'>('About')
  const [bio, setBio] = useState('')
  const [writingBio, setWritingBio] = useState(false)
  const [savingBio, setSavingBio] = useState(false)
  const [picking, setPicking] = useState(false)
  const [uploading, setUploading] = useState(false)
  const picker = useRef<HTMLInputElement>(null)

  const person = useAsync(
    async () => {
      const name = id ? await usernameById(Number(id)) : username
      return name ? getProfileByUsername(name) : null
    },
    [username, id],
  )
  const user = person.data
  const isMe = me?.id === user?.id
  const [colour, setColour] = useState<string | null>(null)
  const accent = accentOf(colour ?? user?.accent_color)

  const overview = useAsync(async () => (user ? getProfileOverview(user.id) : null), [user?.id])
  const spaces = useAsync(
    async () => (user ? listWorldsByOwner(user.id, Boolean(isMe)) : []),
    [user?.id, isMe],
  )
  const made = useAsync(async () => (user ? listAssetsByCreator(user.id) : []), [user?.id])
  const badges = useAsync(async () => (user ? listEarnedBadges(user.id) : []), [user?.id])
  // Their handle, if they have said you may have it. The database decides.
  const handle = useAsync(
    async () => (user?.discord_display ? discordHandleOf(user.id) : null),
    [user?.id, user?.discord_display],
  )
  const communities = useAsync(async () => (user ? listMemberCommunities(user.id) : []), [user?.id])
  const names = useAsync(async () => (user ? usernameHistory(user.id) : []), [user?.id])

  const friends = useAsync(
    async () => (user ? peopleList(user.id, 'friends') : []),
    [user?.id],
  )

  /*
   * Where the two of you stand, in one answer: friends, a request either
   * way, following, blocked, ignored. A profile used to work this out by
   * reading every friendship you have and looking for their name in it.
   */
  const relationship = useAsync(
    async () => (me && user && !isMe ? standingWith(user.id) : null),
    [me?.id, user?.id, isMe],
  )

  /*
   * Blocking and ignoring, with the same warnings they carry everywhere
   * else. It sits up here with the rest of the hooks: below the early
   * returns it would only run on some renders, which is not something React
   * allows and which took the whole page down with it.
   */
  const people = usePersonActions(() => {
    relationship.reload()
    friends.reload()
  })

  useTitle(user ? `${user.display_name} (@${user.username})` : 'Profile')
  useSocialCard({
    title: user ? `${user.display_name} (@${user.username}) - Kobblon` : null,
    description: user?.bio ?? (user ? `${user.display_name} on Kobblon.` : null),
    image: user?.avatar_url ?? null,
  })

  useEffect(() => {
    if (!me || !user || isMe) return
    isFollowing(me.id, user.id).then(setFollowingState)
  }, [me, user, isMe])

  useEffect(() => {
    setBio(user?.bio ?? '')
    setColour(null)
  }, [user?.id, user?.bio])

  /** Somebody writing about themselves, from their own page. */
  const saveBio = async () => {
    if (!user) return
    setSavingBio(true)
    try {
      await updateProfile(user.id, { bio: bio.trim() || null })
      toast('Saved.', 'success')
      setWritingBio(false)
      person.reload()
      refreshProfile()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    } finally {
      setSavingBio(false)
    }
  }

  /** A new picture, chosen and kept from the page it belongs to. */
  const changeAvatar = async (file: File) => {
    if (!user) return
    setUploading(true)
    try {
      const url = await uploadAvatar(user.id, file)
      await updateProfile(user.id, { avatar_url: url })
      toast('That is you now.', 'success')
      person.reload()
      refreshProfile()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That picture did not go up.', 'error')
    } finally {
      setUploading(false)
    }
  }

  /** And picking their colour, on the page the colour is for. */
  const saveColour = async (next: string) => {
    if (!user) return
    setColour(next)
    try {
      await updateProfile(user.id, { accent_color: next })
      refreshProfile()
    } catch {
      toast('That colour did not save.', 'error')
    }
  }

  // Arriving by name sends you on to the address with the number in it.
  useEffect(() => {
    if (!id && user?.content_id) navigate(profileLink(user), { replace: true })
  }, [id, user?.content_id, navigate])

  // Somebody who changed their name carries the new one in the address.
  useCanonicalPath(id && user?.content_id === Number(id) ? profileLink(user) : null)

  // A name somebody used to have still lands on them.
  useEffect(() => {
    if (id || person.loading || user || !username) return
    let live = true
    void addressNow('person', username).then((now) => {
      if (live && now && now.toLowerCase() !== username.toLowerCase()) {
        navigate(`/u/${encodeURIComponent(now)}`, { replace: true })
      }
    })
    return () => { live = false }
  }, [id, person.loading, user, username, navigate])

  const toggleFollow = async () => {
    if (!me || !user) return
    const next = !following
    setFollowingState(next)
    try {
      await setFollowing(me.id, user.id, next)
      overview.reload()
    } catch {
      setFollowingState(!next)
      toast('That did not save.', 'error')
    }
  }

  const addFriend = async () => {
    if (!me || !user) return
    try {
      await sendFriendRequest(me.id, user.id)
      toast('Friend request sent.', 'success')
      relationship.reload()
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

  const message = async () => {
    if (!user) return
    try {
      openConversation(await startConversation(user.id))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'You can only message friends.', 'error')
    }
  }

  if (person.loading) {
    return (
      <Page className="space-y-4">
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-8 w-48" />
      </Page>
    )
  }

  if (person.error) return <Page><ErrorState message={person.error} onRetry={person.reload} /></Page>

  if (!user) {
    return (
      <Page>
        <Card>
          <EmptyState
            mood="noResults"
            title="Nobody here"
            body={`There is no @${username} on Kobblon.`}
            action={<Button to="/discover">Discover Worlds</Button>}
          />
        </Card>
      </Page>
    )
  }

  const standing = relationship.data
  const stats = overview.data
  const visits = (spaces.data ?? []).reduce((sum, world) => sum + (world.visit_count ?? 0), 0)

  return (
    <Page
      className="space-y-6 pt-6"
      /* Every accent on the page comes from here, so somebody's colour runs
         through their whole page rather than being dabbed on in places. */
      style={{ '--me': accent } as React.CSSProperties}
    >
      {/* ------------------------------------------------------- the person */}
      <section className="relative overflow-hidden rounded-3xl border border-ink-line">
        {/* Their own face, out of focus, is the backdrop: no stock banner,
            nothing everybody shares. */}
        <div className="absolute inset-0" aria-hidden="true">
          {!!avatarOf(user) && (
            <img
              src={avatarOf(user) ?? undefined}
              alt=""
              className="h-full w-full scale-125 object-cover opacity-25 blur-3xl"
            />
          )}
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${accent}2e, transparent 55%)` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/40" />
        </div>

        <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:p-7">
          {/* The picture, with the dot on its edge, and a way to change it
              when it is yours: your profile is where you edit your profile. */}
          <div className="shrink-0">
            <PersonAvatar
              person={user}
              size="3xl"
              className="h-28 w-28 sm:h-32 sm:w-32"
              frame={`0 0 0 3px ${accent}`}
              overlay={isMe ? (
                <>
                  <button
                    onClick={() => picker.current?.click()}
                    aria-label="Change your picture"
                    className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-lg text-[#fff] opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                  >
                    <PenIcon className={uploading ? 'animate-pulse' : undefined} />
                  </button>
                  <input
                    ref={picker}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (file) void changeAvatar(file)
                    }}
                  />
                </>
              ) : undefined}
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl font-extrabold sm:text-4xl">
              {user.display_name}
              {user.is_admin && <Verified className="text-xl" />}
              {user.is_guest && <Badge tone="neutral">Guest</Badge>}
            </h1>

            <p className="mt-1.5 text-sm text-muted">@{user.username}</p>

            {/* The three lists are links, because they are a page of their
                own rather than something to unfold here. */}
            <div className="mt-4 flex flex-wrap gap-2">
              {([
                ['Friends', 'friends', friends.data?.length ?? stats?.friend_count ?? 0],
                ['Followers', 'followers', stats?.follower_count ?? 0],
                ['Following', 'following', stats?.following_count ?? 0],
              ] as const).map(([label, list, count]) => (
                <Link
                  key={label}
                  to={`${profileLink(user)}/friends?list=${list}`}
                  className="rounded-full border border-ink-line bg-ink-card/80 px-4 py-1.5 text-sm font-bold transition-colors hover:bg-ink-hover"
                >
                  <span className="tabular-nums">{formatCount(count)}</span>
                  <span className="ml-1.5 text-white/60">{label}</span>
                </Link>
              ))}
            </div>

            {/* Somebody's Discord, when they have said which one is theirs
                and Discord has agreed. */}
            {user.discord_display && (
              <Tooltip
                label={
                  handle.data
                    ? `@${handle.data} on Discord`
                    : isMe
                      ? 'Only you can see your handle. Change that in Settings.'
                      : 'Their Discord handle is not shown to you.'
                }
                side="top"
              >
                <p className="mt-3 inline-flex cursor-default items-center gap-2 rounded-lg border border-ink-line bg-ink-raised px-2.5 py-1.5 text-xs font-bold">
                  <FontAwesomeIcon icon={faDiscord} className="text-[#5865F2]" />
                  {user.discord_display}
                </p>
              </Tooltip>
            )}

            {/* A line or two of the bio, with the rest behind About, the way
                somebody reads a page rather than a form. */}
            <div className="mt-4 max-w-2xl">
              {user.bio ? (
                <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                  {user.bio}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  {isMe ? 'Say something about yourself.' : 'Nothing written yet.'}
                </p>
              )}
              <button
                onClick={() => { setAbout(true); if (isMe && !user.bio) setWritingBio(true) }}
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-link hover:underline"
              >
                {isMe && !user.bio
                  ? <><PenIcon className="text-xs" />Write your bio</>
                  : <><FontAwesomeIcon icon={faCircleInfo} className="text-xs" />More</>}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            {isMe ? (
              <>
                {/* Your colour, changed where you can see what it does. */}
                <button
                  onClick={() => setPicking(true)}
                  aria-label="Your colour"
                  title="Your colour"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-ink-line text-white/80 transition-colors hover:bg-ink-hover"
                  style={{ background: `${accent}33` }}
                >
                  <FontAwesomeIcon icon={faPalette} />
                </button>
              </>
            ) : (
              <>
                {/* Somebody you have blocked is somebody you have no
                    business doing anything with until you unblock them. */}
                {standing?.i_blocked ? (
                  <Button
                    variant="danger"
                    icon={faBan}
                    onClick={() => people.askFor({ kind: 'unblock', person: user })}
                  >
                    Blocked
                  </Button>
                ) : standing?.they_blocked ? (
                  /* The other way round, said plainly but without pointing
                     the finger: the buttons would only fail if they worked. */
                  <Button variant="subtle" icon={faBan} disabled>Unavailable</Button>
                ) : (
                  <>
                    {standing?.are_friends ? (
                      <Button icon={faComment} onClick={message}>Chat</Button>
                    ) : standing?.request_sent ? (
                      <Button variant="subtle" icon={faClock} disabled>Request pending</Button>
                    ) : standing?.request_received ? (
                      <Button icon={faUserPlus} to="/friends?list=requests">Answer their request</Button>
                    ) : (
                      <GuestGate action="add friends">
                        <Button icon={faUserPlus} onClick={addFriend} disabled={!me}>Add Friend</Button>
                      </GuestGate>
                    )}
                    <Button
                      variant={following ? 'primary' : 'subtle'}
                      icon={faUserCheck}
                      onClick={toggleFollow}
                      disabled={!me}
                    >
                      {following ? 'Following' : 'Follow'}
                    </Button>
                  </>
                )}
              </>
            )}

            <Menu
              label={`More about ${user.display_name}`}
              align="right"
              trigger={
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-ink-line bg-ink-card text-white/70 transition-colors hover:bg-ink-hover hover:text-white">
                  <FontAwesomeIcon icon={faEllipsis} />
                </span>
              }
              items={[
                {
                  label: 'Copy link',
                  icon: faLink,
                  onSelect: () => {
                    void navigator.clipboard?.writeText(window.location.href)
                    toast('Link copied.', 'success')
                  },
                },
                ...(me && !isMe
                  ? [
                      {
                        label: 'Report',
                        icon: faFlag,
                        danger: true,
                        onSelect: () => setReporting(true),
                      },
                      ...people.itemsFor(user, {
                        are_friends: standing?.are_friends,
                        i_blocked: standing?.i_blocked,
                        i_ignore: standing?.i_ignore,
                      }),
                    ]
                  : []),
              ]}
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- the two */}
      <Tabs
        look="line"
        accent={accent}
        label="About them, or what they made"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'About', label: 'About' },
          { value: 'Creations', label: 'Creations' },
        ]}
      />

      {tab === 'Creations' ? (
        <div className="space-y-10">
          <section>
            <Heading
              icon={worldIcon}
              aside={undefined}
            >
              Worlds
            </Heading>

            {spaces.loading && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {[0, 1, 2].map((i) => <SpaceCardSkeleton key={i} />)}
              </div>
            )}

            {!spaces.loading && !spaces.data?.length && (
              <Card>
                <EmptyState
                  mood="emptyBox"
                  title={isMe ? 'Nothing made yet' : 'No Worlds yet'}
                  body={
                    isMe
                      ? 'Build one in Kobblon Workspace and publish it, and it shows up here.'
                      : `${user.display_name} has not published anything yet.`
                  }
                  action={undefined}
                />
              </Card>
            )}

            {!!spaces.data?.length && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {spaces.data.map((world) => <WorldCard key={world.id} world={world} />)}
              </div>
            )}
          </section>

          <section>
            <Heading
              icon={faShapes}
              aside={
                <Button size="sm" variant="subtle" to={`/create/creator/${user.username}`}>
                  Their creator page
                </Button>
              }
            >
              In the Marketplace
            </Heading>

            {!made.data?.length ? (
              <p className="text-sm text-muted">
                {isMe
                  ? 'Upload a decal, a sound or a font in Create and it turns up here.'
                  : `${user.display_name} has not put anything in the Marketplace yet.`}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {made.data.slice(0, 18).map((item) => <AssetTile key={item.id} item={item} />)}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <Heading icon={faUsers} aside={
              <Link
                to={`${profileLink(user)}/friends`}
                className="text-xs font-bold text-link hover:underline"
              >
                See all
              </Link>
            }>
              Friends
            </Heading>

            {friends.loading && (
              <div className="flex gap-3">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-24 rounded-xl" />)}
              </div>
            )}

            {!friends.loading && !friends.data?.length && (
              <p className="text-sm text-muted">
                {isMe ? 'Nobody yet. Add somebody from their profile.' : 'No friends yet.'}
              </p>
            )}

            {!!friends.data?.length && <Faces people={friends.data.slice(0, 12)} />}
          </section>

          {!!communities.data?.length && (
            <section>
              <Heading icon={faUsers}>Communities</Heading>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 kob-scroll">
                {communities.data.map((community) => (
                  <Link
                    key={community.id}
                    to={communityLink(community)}
                    className="w-40 shrink-0 rounded-2xl border border-ink-line bg-ink-card p-3 text-center transition-colors hover:border-brand/60"
                  >
                    <Emblem
                      src={community.icon_url}
                      name={community.name}
                      rounded="rounded-xl"
                      className="mx-auto h-14 w-14 text-lg"
                    />
                    <p className="mt-2 truncate text-sm font-bold">{community.name}</p>
                    <p className="text-xs text-muted">
                      {formatCount(community.member_count)} members
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!!badges.data?.length && (
            <section>
              <Heading icon={faAward}>Badges</Heading>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {badges.data.map((badge) => (
                  <Link key={badge.id} to={`/u/${badge.space_owner}/${badge.space_slug}`}>
                    <BadgeTile
                      badge={{ ...badge, awarded_count: 0 }}
                      earned
                      className="h-full transition-colors hover:border-brand/60"
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ about */}
      <Dialog
        open={about}
        onClose={() => { setAbout(false); setWritingBio(false) }}
        title={`About @${user.username}`}
        size="md"
      >
        <div className="space-y-6">
          <section>
            {writingBio ? (
              <div className="space-y-2">
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={300}
                  placeholder="Say something about yourself."
                  hint={`${bio.length}/300`}
                  className="min-h-[7rem]"
                />
                <div className="flex gap-2">
                  <Button size="sm" loading={savingBio} onClick={saveBio}>Save</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setBio(user.bio ?? ''); setWritingBio(false) }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                  {user.bio || (isMe ? 'Nothing written yet.' : 'Nothing written yet.')}
                </p>
                {isMe && (
                  <button
                    onClick={() => setWritingBio(true)}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-link hover:underline"
                  >
                    <FontAwesomeIcon icon={faPen} className="text-[10px]" />
                    Edit bio
                  </button>
                )}
              </>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-display text-base font-extrabold">Previous names</h3>
            {names.data?.length ? (
              <div className="flex flex-wrap gap-2">
                {names.data.map((row) => (
                  <span
                    key={row.username}
                    className="rounded-full border border-ink-line bg-ink-raised px-3 py-1 text-xs font-bold text-white/70"
                  >
                    @{row.username}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No previous names.</p>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-display text-base font-extrabold">Numbers</h3>
            <div className="space-y-1.5">
              <Fact icon={faClock}>
                Here since {new Date(user.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Fact>
              <br />
              <Fact icon={faCubes}>
                {formatCount(spaces.data?.length ?? 0)}{' '}
                {spaces.data?.length === 1 ? 'World' : 'Worlds'}
              </Fact>
              <br />
              <Fact icon={faEye}>{formatCount(visits)} visits to them</Fact>
            </div>
          </section>
        </div>
      </Dialog>

      {/* Making your page yours, on your page. */}
      <Dialog
        open={picking}
        onClose={() => setPicking(false)}
        title="Your colour"
        description="It runs through your whole page: the ring round your face, the rule under every heading, the tab you are on."
        size="sm"
        footer={<Button onClick={() => setPicking(false)}>Done</Button>}
      >
        <ColourPicker value={accent} onChange={saveColour} />
      </Dialog>

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="profile"
        targetId={user.id}
        targetName={user.display_name}
      />

      {people.dialog}
    </Page>
  )
}
