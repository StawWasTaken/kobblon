import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowLeft, faCalendarDay, faLock } from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { ReportDialog } from '@/components/social/ReportDialog'
import { CommunityHeader } from '@/components/community/CommunityHeader'
import { CommunityWall } from '@/components/community/CommunityWall'
import { CommunityMembers } from '@/components/community/CommunityMembers'
import { AffiliateGrid } from '@/components/community/AffiliateGrid'
import { EventCard } from '@/components/community/EventCard'
import { Announcements } from '@/components/community/Announcements'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useCanonicalPath } from '@/hooks/useCanonicalPath'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import {
  addressNow, cancelJoinRequest, communitySlugById, getCommunity, getCommunityOverview,
  joinCommunity, leaveCommunity,
  listCommunityAssets, listCommunityEvents, listCommunityRoster, listRelations,
  setEventAttendance,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { communityLink } from '@/lib/links'
import type { CommunityEvent } from '@/types/db'
import { AdBanner } from '@/components/ads/AdBanner'
import { LiveEventBar } from '@/components/community/LiveEventBar'
import { Shop } from '@/components/catalog/Shop'
import { CommunitySide } from '@/components/community/CommunitySide'

/*
 * A Community, shaped like a place rather than a filing cabinet.
 *
 * It was five tabs across the top - About, Shop, Events, Members,
 * Affiliates - with everything that is actually alive in the Community
 * hidden inside the first of them. That is the Roblox group page, nearly
 * tab for tab, and it has the same two problems it has there: the page
 * opens on a tab rather than on the Community, and four fifths of what the
 * Community is are behind a press nobody makes.
 *
 * So there are no tabs. The page is the place: what was said, what is on,
 * and what people are posting, straight down the middle. Everything that is
 * a standing fact about the Community rather than news - who is in it, what
 * is next, what it sells, who it stands with - is a panel down the side,
 * each one showing enough to be worth reading and each one a door to all of
 * it. The four full lists are still there, every one of them, at their own
 * address, so a link to the member list is still a link to the member list.
 */
const views = {
  members: 'Members',
  events: 'Events',
  shop: 'Shop',
  allies: 'Affiliates',
} as const

type View = keyof typeof views

export default function CommunityPage() {
  const { slug: slugParam = '', id } = useParams()
  const navigate = useNavigate()

  const byId = useAsync(async () => (id ? communitySlugById(Number(id)) : null), [id])
  const slug = id ? byId.data ?? '' : slugParam
  const { profile } = useAuth()
  const toast = useToast()
  const [pending, setPending] = useState(false)
  const [reporting, setReporting] = useState(false)

  /*
   * Which full list is open, in the address rather than in a state nobody
   * can link to. The Community itself is what no parameter means, so the
   * page opens on the Community and a pressed door is a real address: a
   * link to the member list is a link to the member list, and Back goes
   * back to the Community rather than out of it.
   */
  const [search, setSearch] = useSearchParams()
  const asked = (search.get('view') ?? '').toLowerCase()
  const view = (asked in views ? asked : null) as View | null
  const show = (next: View | null) => {
    const params = new URLSearchParams(search)
    if (next) params.set('view', next)
    else params.delete('view')
    setSearch(params)
  }

  const community = useAsync(async () => (slug ? getCommunity(slug) : null), [slug])
  const group = community.data

  // The address says what the Community is called now, not what it was
  // called when somebody sent the link.
  useCanonicalPath(id && group?.content_id === Number(id) ? communityLink(group) : null)

  useEffect(() => {
    if (id || community.loading || group || !slug) return
    let live = true
    void addressNow('community', slug).then((now) => {
      if (live && now && now !== slug) navigate(`/c/${now}`, { replace: true })
    })
    return () => { live = false }
  }, [id, community.loading, group, slug, navigate])

  const rights = useAsync(
    async () => (group ? getCommunityOverview(group.id) : null),
    [group?.id, profile?.id],
  )
  const owner = useAsync(
    async () => {
      if (!group) return null
      const { data } = await supabase.from('profiles').select('username')
        .eq('id', group.owner_id).maybeSingle()
      return (data as { username: string } | null)?.username ?? null
    },
    [group?.owner_id],
  )
  /*
   * Three lists out of the one call, and the split is the database's.
   *
   * `is_over` is "its last moment has passed" and `just_over` is "and that
   * was within the day", both decided where the clock is. A cancelled event
   * is in none of them: it did not happen and is not going to.
   */
  const events = useAsync(
    async () => (group ? listCommunityEvents(group.id) : []),
    [group?.id],
  )

  const live = (events.data ?? []).filter((one) => !one.is_cancelled)
  /** Still to happen. */
  const coming = live.filter((one) => !one.is_over)
  /** Still on the front of the page: coming up, or finished within the day. */
  const onNow = live.filter((one) => !one.is_over || one.just_over)
  /** Been and gone, newest first. */
  const gone = live
    .filter((one) => one.is_over)
    .slice()
    .reverse()
  const store = useAsync(
    async () => (group ? listCommunityAssets(group.id) : []),
    [group?.id],
  )
  const roster = useAsync(
    async () => (group ? listCommunityRoster(group.id) : []),
    [group?.id],
  )
  const allies = useAsync(async () => (group ? listRelations(group.id, 'ally') : []), [group?.id])
  const enemies = useAsync(async () => (group ? listRelations(group.id, 'enemy') : []), [group?.id])

  useTitle(group ? (view ? `${views[view]} - ${group.name}` : group.name) : 'Community')
  useSocialCard({
    title: group ? `${group.name} - Kobblon` : null,
    description: group?.description
      ?? (group ? `A Community on Kobblon with ${group.member_count} members.` : null),
    image: group?.icon_url ?? group?.banner_url ?? null,
  })

  // A name-only community link answers, then swaps itself for the numbered one.
  useEffect(() => {
    if (!id && group?.content_id) navigate(communityLink(group), { replace: true })
  }, [id, group?.content_id, navigate])

  const join = async () => {
    if (!group) return
    setPending(true)
    try {
      const result = await joinCommunity(group.id)
      toast(result === 'joined' ? 'You are in.' : 'Asked to join. They will let you know.', 'success')
      community.reload()
      rights.reload()
      roster.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setPending(false)
    }
  }

  /** Taking back a request nobody has answered yet. */
  const unask = async () => {
    if (!group) return
    setPending(true)
    try {
      await cancelJoinRequest(group.id)
      toast('Taken back.', 'success')
      rights.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setPending(false)
    }
  }

  const leave = async () => {
    if (!group || !profile) return
    try {
      await leaveCommunity(group.id, profile.id)
      toast('You left the Community.', 'info')
      community.reload()
      rights.reload()
      roster.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  const going = async (event: CommunityEvent, yes: boolean) => {
    try {
      await setEventAttendance(event.id, yes)
      events.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  if (community.loading) {
    return <Page className="space-y-4"><Skeleton className="h-56 w-full" /></Page>
  }

  if (community.error) {
    return <Page><ErrorState message={community.error} onRetry={community.reload} /></Page>
  }

  if (!group) {
    return (
      <Page>
        <Card>
          <EmptyState
            mood="noResults"
            title="No community here"
            body={`There is no community at "${slug}".`}
            action={<Button to="/communities">All communities</Button>}
          />
        </Card>
      </Page>
    )
  }

  /*
   * Closed by staff, and serving the two months before the data goes. The
   * row is readable for exactly this - one sentence, and nothing else on
   * the page, because everything else on it belongs to a Community that is
   * running and this one is not.
   */
  if (group.closed_at) {
    return (
      <Page width="narrow" className="py-10">
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-ink-line bg-ink-raised text-xl text-muted">
            <Glyph icon={faLock} />
          </span>
          <h1 className="font-display text-2xl font-extrabold">
            This community has been locked
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            A moderator closed it. Nothing in it can be read or posted to while
            that stands, and the owner was told why.
          </p>
          <Button to="/communities" variant="subtle">All communities</Button>
        </Card>
      </Page>
    )
  }

  const canManage = !!rights.data?.can_manage_community

  /** The whole of one thing, at its own address, with the way back to the place. */
  const full = (title: string, body: React.ReactNode) => (
    <div className="mt-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => show(null)}
          className="flex items-center gap-2 text-sm font-bold text-muted transition-colors hover:text-white"
        >
          <Glyph icon={faArrowLeft} className="text-xs" />
          {group.name}
        </button>
      </div>
      <h1 className="font-display text-2xl font-extrabold">{title}</h1>
      {body}
    </div>
  )

  return (
    <>
      {/* Under the bar, on this page only, while something is on. */}
      <LiveEventBar communityId={group.id} />

      <CommunityHeader
        group={group}
        rights={rights.data}
        ownerName={owner.data ?? undefined}
        pending={pending}
        onJoin={join}
        onUnask={unask}
        onLeave={leave}
        onReport={() => setReporting(true)}
      />

      <Page width="narrow" className="pt-6">
        {!view && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
            <div className="min-w-0 space-y-8">
              <Announcements communityId={group.id} rights={rights.data} />

              {/*
                * What is on, at the top of the page because it is the thing
                * with a time on it.
                *
                * Staw: "when events are finished they still display in the
                * about part of the community but then disappears after a
                * day and gets stored into the past events in the events
                * tab". So this is the upcoming ones plus whatever ended
                * within the day - an event people turned up to yesterday
                * evening is still the thing the Community is talking about
                * this morning, and a page that drops it the second it ends
                * reads as though nothing ever happened there.
                *
                * `is_over` and `just_over` are the database's answers, not
                * this page's. A clock comparison written here is a clock
                * comparison against the reader's machine, which is a
                * different clock from the one the event was set by.
                */}
              {!!onNow.length && (
                <section>
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
                      <Glyph icon={faCalendarDay} className="text-base" />
                      On now
                    </h2>
                    <button
                      onClick={() => show('events')}
                      className="ml-auto text-xs font-bold text-link hover:underline"
                    >
                      All events
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {onNow.slice(0, 2).map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onJoin={(yes) => void going(event, yes)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* The living part of the Community, and the spine of the
                  page rather than the last thing under four other things. */}
              <CommunityWall communityId={group.id} rights={rights.data} />
            </div>

            <CommunitySide
              group={group}
              roster={roster.data}
              rosterLoading={roster.loading}
              coming={coming}
              store={store.data}
              allies={allies.data}
              enemies={enemies.data}
              foot={<AdBanner size="tall" quiet className="hidden lg:block" />}
              /* On a phone it goes above the wall, not under it: the wall
                 has no bottom, so anything after it is never reached. */
              className="max-lg:order-first lg:sticky lg:top-[4.5rem]"
            />
          </div>
        )}

        {view === 'events' && full('Events', (
          <div className="space-y-6">
            {events.loading && <Skeleton className="h-40" />}

            {!events.loading && !events.data?.length && (
              <Card>
                <EmptyState
                  mood="noResults"
                  title="Nothing on yet"
                  body={
                    canManage
                      ? 'Put something in the calendar and members will see it here.'
                      : `${group.name} has not announced anything.`
                  }
                  action={
                    canManage
                      ? <Button to={`/c/${group.slug}/configure?section=Events`}>Make an event</Button>
                      : undefined
                  }
                />
              </Card>
            )}

            {!!coming.length && (
              <section className="space-y-3">
                <h2 className="font-display text-xl font-extrabold">Coming up</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {coming.map((event) => (
                    <EventCard key={event.id} event={event} onJoin={(yes) => void going(event, yes)} />
                  ))}
                </div>
              </section>
            )}

            {/* Everything that has been and gone, kept rather than
                dropped: a Community with nothing behind it looks like one
                nothing has ever happened in. Newest first, which is the
                opposite order from what is coming. */}
            {!!gone.length && (
              <section className="space-y-3">
                <h2 className="font-display text-xl font-extrabold">Past events</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {gone.map((event) => <EventCard key={event.id} event={event} past />)}
                </div>
              </section>
            )}
          </div>
        ))}

        {view === 'members' && full('Members', (
          <CommunityMembers
            communityId={group.id}
            ownerId={group.owner_id}
            rights={rights.data}
            onChanged={() => { community.reload(); rights.reload(); roster.reload() }}
          />
        ))}

        {view === 'shop' && full(`Made by ${group.name}`, (
          <Shop
            owner={{ community: group.id }}
            who={group.name}
            handle={group.slug}
            isMine={canManage}
          />
        ))}

        {view === 'allies' && full('Affiliates', (
          <div className="space-y-8">
            <AffiliateGrid
              title="Allies"
              relations={allies.data}
              loading={allies.loading}
              empty="No allies yet."
            />
            <AffiliateGrid
              title="Enemies"
              relations={enemies.data}
              loading={enemies.loading}
              empty="Nobody has been declared an enemy."
            />
          </div>
        ))}
      </Page>

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="profile"
        targetId={group.owner_id}
        targetName={group.name}
      />
    </>
  )
}
