import React, { useState } from 'react'
import { useRail } from '@/hooks/useRail'
import { Weather } from '@/components/brand/Weather'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faCompass, faChevronLeft, faChevronRight, faEye,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { TopicCard, useTopTopics } from '@/components/forum/TopicCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { FriendsRail } from '@/components/social/FriendsRail'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { WorldTile } from '@/components/worlds/Shelf'
import { greeting } from '@/lib/greeting'
import { AccountStatusCard } from '@/components/social/AccountStatusCard'
import { useToast } from '@/components/ui/Toast'
import { worldIcon } from '@/lib/naming'
import { AdBanner } from '@/components/ads/AdBanner'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  accountStanding, acknowledgeStanding,
  listFavouriteWorlds, listMemberCommunities, listRecentlyPlayedWorlds, listWorlds, myWorlds,
} from '@/lib/api'
import { formatCount } from '@/lib/format'
import { communityLink, worldLink } from '@/lib/links'
import { cn } from '@/lib/cn'
import { Emblem } from '@/components/community/Emblem'
import type { World } from '@/types/db'

/** A row that slides, with the arrows only where there is a mouse to use them. */
function Row({ title, children, more, empty }: {
  title: string
  children: React.ReactNode
  more?: { to: string; label: string }
  /**
   * What stands in for the shelf when it has nothing on it.
   *
   * Without this the page drew the heading, then an empty scroller, then a
   * card underneath repeating the same thing - a title, eighty pixels of
   * nothing, and the answer. The comment on "Recently played" above already
   * says an empty row headed with a title "says nothing except that the page
   * has a hole in it"; this is that rule finally applied to the shelf it was
   * written about.
   */
  empty?: React.ReactNode
}) {
  const { track, can, nudge, measure, scrollable } = useRail(children)

  const bare = !React.Children.toArray(children).length

  return (
    <section className="mb-10 sm:mb-12">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">{title}</h2>
        {more && (
          <Link to={more.to} className="text-xs font-bold text-link hover:underline">
            {more.label}
          </Link>
        )}
        {scrollable && !bare && (
          <div className="ml-auto hidden gap-1 sm:flex">
            {([-1, 1] as const).map((way) => (
              <button
                key={way}
                onClick={() => nudge(way)}
                disabled={way === -1 ? !can.left : !can.right}
                aria-label={way === -1 ? `Scroll ${title} left` : `Scroll ${title} right`}
                className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line bg-ink-card text-white/60 transition-colors hover:bg-ink-hover hover:text-white disabled:pointer-events-none disabled:opacity-35"
              >
                <Glyph icon={way === -1 ? faChevronLeft : faChevronRight} className="text-xs" />
              </button>
            ))}
          </div>
        )}
      </div>

      {bare && empty ? empty : (
        <div
          ref={track}
          onScroll={measure}
          className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 kob-scroll"
        >
          {children}
        </div>
      )}
    </section>
  )
}

/**
 * A World being suggested: its emblem, its name, and how many have been.
 *
 * The emblem is what a World chose to be known by, so it is what a rail of
 * them shows. Nothing here is a judgement about the World; it is a shelf.
 */
function Suggestion({ world }: { world: World }) {
  return (
    /* `w-44` on a phone and not `w-64`: at two hundred and fifty-six pixels
       one card filled the screen and the shelf read as a single World with
       an edge beside it, which is the opposite of what a shelf is for. At
       this width two fit with a third showing, and it matches the two-up
       grid the rest of the phone now uses. */
    <article className="w-44 shrink-0 sm:w-72">
      <Link
        to={worldLink(world)}
        className="block aspect-[16/9] overflow-hidden rounded-xl border border-ink-line bg-media"
      >
        {world.cover_url ? (
          <img
            src={world.cover_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
          />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <Glyph icon={worldIcon} className="text-2xl text-white/20" />
          </span>
        )}
      </Link>
      <p className="mt-1.5 truncate text-sm font-bold">{world.name}</p>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Glyph icon={faEye} />
        {formatCount(world.visit_count ?? 0)}
      </p>
    </article>
  )
}

export default function Home() {
  useTitle('Home')
  const { profile } = useAuth()
  /* The forum, drawn as a shelf below and not at all when it is quiet. */
  const talk = useTopTopics(8)

  const mine = useAsync(async () => (profile ? myWorlds() : []), [profile?.id])
  /*
   * What is being played, until there is something worth calling a
   * recommendation. A shelf that says "trending" and means it beats a
   * personalised one that has nothing to personalise from.
   */
  const suggested = useAsync(() => listWorlds({ sort: 'trending', limit: 24 }), [profile?.id])
  /*
   * Where you have already been, which is the first thing anybody opening
   * Home is actually after. It needs an account, so signed out it asks for
   * nothing at all rather than asking and being told no.
   */
  const played = useAsync(
    async () => (profile ? listRecentlyPlayedWorlds(14) : []),
    [profile?.id],
  )
  const saved = useAsync(
    async () => (profile ? listFavouriteWorlds(profile.id) : []),
    [profile?.id],
  )
  const communities = useAsync(
    async () => (profile ? listMemberCommunities(profile.id) : []),
    [profile?.id],
  )

  /*
   * Whatever has been decided about this account, at the top of the page
   * somebody lands on. A warning does not shut anything, so without this it
   * had nowhere at all to appear and sat unread on the standing page; a
   * suspension and a closure get the whole screen instead, so here this is
   * the one that is doing the work.
   */
  const say = useToast()
  const standing = useAsync(async () => (profile ? accountStanding() : null), [profile?.id])
  const [answering, setAnswering] = useState(false)

  const answer = async () => {
    setAnswering(true)
    try {
      const what = await acknowledgeStanding()
      say(
        what === 'back' ? 'Welcome back. Keep it clean.' : 'Noted. Your account is clear.',
        'success',
      )
      standing.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not go through.', 'error')
    }
    setAnswering(false)
  }

  const decided = standing.data && standing.data.level !== 'clear' ? standing.data : null

  /*
   * Worked out once a render from the clock. Not state and not an effect:
   * there is nothing to keep in sync, and a greeting that arrives a frame
   * after the page did is a greeting that flickers.
   */
  const hello = greeting(profile?.display_name || profile?.username || 'there')

  const shown = suggested.data ?? []
  const first = shown.slice(0, 8)
  const rest = shown.slice(8, 24)

  return (
    <Page width="wide">
      {/* "sometimes theres effects around the website ... not that much
          either, just sometime and somewhere". Home is the somewhere: it is
          the page somebody lands on, it has room above the fold, and it is
          not a page anybody is trying to read carefully. It draws nothing
          at all unless a seasonal appearance is being worn. */}
      <Weather className="pointer-events-none fixed inset-0 z-0 overflow-hidden" />
      {/* Not the word "Home". Somebody who has just signed in knows where
          they are; what they do not get anywhere else on the site is being
          greeted by name, with their own avatar beside it - the same thing
          the Workspace opens with, from the same two lines of copy. */}
      <header className="relative z-10 mb-8 flex items-center gap-4 pt-1 sm:mb-10 sm:gap-5 sm:pt-2">
        {/* Bigger than anything else on the page, the way the Workspace opens.
            The responsive pair wins over the size prop's own classes because
            Tailwind writes its breakpoints after its base utilities. */}
        {profile && <PersonAvatar person={profile} size="2xl" className="sm:h-28 sm:w-28" />}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-4xl">
            {hello.hello}
          </h1>
          <p className="mt-1 text-sm text-muted sm:text-base">{hello.aside}</p>
        </div>
      </header>

      {decided && (
        <AccountStatusCard
          standing={decided}
          busy={answering}
          onAcknowledge={decided.can_acknowledge ? () => void answer() : undefined}
          className="relative z-10 mb-8"
        />
      )}

      <FriendsRail />

      {/*
        * Where you were last, before anything anybody else is doing. The
        * marks rather than the covers: a World's emblem is what it chose to
        * be known by, and a shelf of squares is for recognising something
        * you have already played rather than being sold it.
        *
        * It only appears once there is a history to show. Signed out, and
        * on a first visit, the trending shelf below takes the top of the
        * page instead - an empty row headed "Recently played" says nothing
        * except that the page has a hole in it.
        */}
      {!!played.data?.length && (
        <Row title="Recently played" more={{ to: '/library', label: 'Your library' }}>
          {played.data.map((world) => <WorldTile key={world.id} world={world} />)}
        </Row>
      )}

      <Row
        title="Being played right now"
        more={{ to: '/discover', label: 'Discover more' }}
        empty={
          <Card>
            <EmptyState
              mood="construction"
              title="Nothing to suggest yet"
              body="When people publish Worlds, the ones worth a look land here."
              action={<Button to="/discover" icon={faCompass}>See what there is</Button>}
            />
          </Card>
        }
      >
        {suggested.loading
          ? [0, 1, 2, 3].map((i) => (
            <div key={i} className="w-64 shrink-0 sm:w-72">
              <Skeleton className="aspect-[16/9] rounded-xl" />
            </div>
          ))
          : first.map((world) => <Suggestion key={world.id} world={world} />)}
      </Row>

      {/* The marks again, for the same reason Recently played has them:
          these are Worlds you already know, so the shelf is for finding one
          rather than for being sold one. The covers stay on the shelves of
          Worlds you have not seen before. */}
      {!!mine.data?.length && (
        <Row title="Your Worlds" more={{ to: '/create/worlds', label: 'All of them' }}>
          {mine.data.map((world) => <WorldTile key={world.id} world={world} />)}
        </Row>
      )}

      <AdBanner className="mb-10 sm:mb-12" quiet />

      {rest.length > 0 && (
        <>
          <Row title="More to look at">
            {rest.slice(0, 8).map((world) => <Suggestion key={world.id} world={world} />)}
          </Row>

          {rest.length > 8 && (
            <Row title="Still more">
              {rest.slice(8).map((world) => <Suggestion key={world.id} world={world} />)}
            </Row>
          )}
        </>
      )}

      {!!saved.data?.length && (
        <Row title="Saved" more={{ to: '/library', label: 'Your library' }}>
          {saved.data.map((world) => <WorldTile key={world.id} world={world} />)}
        </Row>
      )}

      {!!communities.data?.length && (
        <Row title="Your Communities" more={{ to: '/communities', label: 'See all' }}>
          {communities.data.map((community) => (
            <Link
              key={community.id}
              to={communityLink(community)}
              className={cn(
                'flex w-44 shrink-0 items-center gap-3 rounded-xl border border-ink-line bg-ink-card p-3',
                'transition-colors hover:border-brand/60',
              )}
            >
              <Emblem src={community.icon_url} name={community.name} className="h-10 w-10 text-xs" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{community.name}</span>
                <span className="block text-xs text-muted">
                  {formatCount(community.member_count)} members
                </span>
              </span>
            </Link>
          ))}
        </Row>
      )}

      {/*
        * The forum, on the page somebody lands on. A platform this size has
        * one conversation going at a time and the front door should say
        * what it is.
        *
        * A shelf, like everything else on this page. It was a bordered list
        * of five rows and Staw is right that it did not belong: "the 'From
        * the forum' stuff in the logged in homepage doesnt match at all the
        * design of the homepage". This page is shelves that slide, so this
        * is one.
        */}
      {!!talk.length && (
        <Row title="From the forum" more={{ to: '/forum', label: 'All topics' }}>
          {talk.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </Row>
      )}
    </Page>
  )
}
