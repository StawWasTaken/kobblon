import { Weather } from '@/components/brand/Weather'
import { Page } from '@/components/layout/AppShell'
import { TopicCard, useTopTopics } from '@/components/forum/TopicCard'
import { FriendsRail } from '@/components/social/FriendsRail'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { Shelf, WorldTile, WorldFeature } from '@/components/worlds/Shelf'
import { TopNow } from '@/components/home/TopNow'
import { greeting } from '@/lib/greeting'
import { AdBanner } from '@/components/ads/AdBanner'
import { EventBanner } from '@/components/home/EventBanner'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  listFavouriteWorlds, listMemberCommunities, listRecentlyPlayedWorlds, listWorlds, myWorlds,
} from '@/lib/api'
import { CommunityCard } from '@/components/community/CommunityCard'

export default function Home() {
  useTitle('Home')
  const { profile } = useAuth()
  /* The forum, drawn as a shelf below and not at all when it is quiet. */
  const talk = useTopTopics(8)

  const mine = useAsync(async () => (profile ? myWorlds() : []), [profile?.id])
  /*
   * Three different questions, not one list cut into three.
   *
   * "Being played right now" is the busiest, and it is a board at the top
   * of the page rather than a rail. Under it, what is new and what people
   * liked - which are shelves because they are for scanning, and which are
   * honest headings because the database really sorts by those two things.
   * The old page asked `trending` once for twenty-four and then had to
   * invent the names "More to look at" and "Still more" for slices nine to
   * sixteen and seventeen to twenty-four.
   */
  const busiest = useAsync(() => listWorlds({ sort: 'trending', limit: 5 }), [])
  const fresh = useAsync(() => listWorlds({ sort: 'new', limit: 12 }), [])
  const liked = useAsync(() => listWorlds({ sort: 'popular', limit: 12 }), [])
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
   * No standing card here any more.
   *
   * Every decision - a warning, a feature block, a suspension, a closure -
   * is `StandingGate`'s, in front of whatever page somebody is on. This
   * page had its own copy of the card and its own copy of the answering,
   * so a warning could be read in two places that did not agree with each
   * other, and Staw was still being shown the old one.
   */

  /*
   * Worked out once a render from the clock. Not state and not an effect:
   * there is nothing to keep in sync, and a greeting that arrives a frame
   * after the page did is a greeting that flickers.
   */
  const hello = greeting(profile?.display_name || profile?.username || 'there')

  /*
   * The board takes the top five, so a shelf under it has nothing to say
   * about a World the board is already showing. On a platform with six
   * published Worlds that is most of them, which is exactly when a page
   * repeating itself is most obvious.
   */
  const top = busiest.data ?? []
  const already = new Set(top.map((world) => world.id))
  const newer = (fresh.data ?? []).filter((world) => !already.has(world.id))
  const best = (liked.data ?? []).filter((world) => !already.has(world.id))

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


      {/*
        * Who is about, first. Staw: "the friends list should be above the
        * event thing header". It is the one row on this page that is about
        * people rather than about things, and it is the reason somebody
        * opens Home twice in an evening - a contest is read once.
        */}
      <FriendsRail />

      {/*
        * What Kobblon is running, over everything the page is made of and
        * under the things that are about you: the greeting, a notice about
        * your own account, and who is about. A contest banner sitting over
        * a suspension would be the page talking past somebody.
        */}
      <EventBanner className="relative z-10 mb-8" />

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
      {/*
        * Where you were last, before anything anybody else is doing. The
        * marks rather than the covers: a World's emblem is what it chose to
        * be known by, and a shelf of squares is for recognising something
        * you have already played rather than being sold it.
        *
        * It only appears once there is a history to show. Signed out, and
        * on a first visit, the board below takes the top of the page
        * instead - an empty row headed "Recently played" says nothing
        * except that the page has a hole in it.
        */}
      {!!played.data?.length && (
        <Shelf title="Recently played" more={{ to: '/library', label: 'Your library' }}>
          {played.data.map((world) => <WorldTile key={world.id} world={world} />)}
        </Shelf>
      )}

      <TopNow worlds={top} loading={busiest.loading} className="relative z-10" />

      {/* Covers here and not marks: these are Worlds somebody has not
          played, so the shelf is for being shown one rather than for
          finding one again. */}
      {newer.length > 0 && (
        <Shelf title="New on Kobblon" more={{ to: '/discover', label: 'Discover' }}>
          {newer.map((world) => <WorldFeature key={world.id} world={world} />)}
        </Shelf>
      )}

      {/* The marks again, for the same reason Recently played has them:
          these are Worlds you already know, so the shelf is for finding one
          rather than for being sold one. */}
      {!!mine.data?.length && (
        <Shelf title="Your Worlds" more={{ to: '/create/worlds', label: 'All of them' }}>
          {mine.data.map((world) => <WorldTile key={world.id} world={world} />)}
        </Shelf>
      )}

      <AdBanner className="mb-8" quiet />

      {best.length > 0 && (
        <Shelf title="What people liked" more={{ to: '/discover', label: 'Discover' }}>
          {best.map((world) => <WorldFeature key={world.id} world={world} />)}
        </Shelf>
      )}

      {!!saved.data?.length && (
        <Shelf title="Saved" more={{ to: '/library', label: 'Your library' }}>
          {saved.data.map((world) => <WorldTile key={world.id} world={world} />)}
        </Shelf>
      )}

      {!!communities.data?.length && (
        <Shelf title="Your Communities" more={{ to: '/communities', label: 'See all' }}>
          {/*
            * The same card the Communities page draws, in a fixed width so
            * it sits on a shelf. Home had its own copy of it, three lines
            * shorter and missing the tick - so a verified Community looked
            * unverified here and verified one page over, which is the kind
            * of thing a second implementation of a card is always for.
            */}
          {communities.data.map((community) => (
            <div key={community.id} className="w-56 shrink-0">
              <CommunityCard community={community} />
            </div>
          ))}
        </Shelf>
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
        <Shelf title="From the forum" more={{ to: '/forum', label: 'All topics' }}>
          {talk.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </Shelf>
      )}
    </Page>
  )
}
