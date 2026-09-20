import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarDay } from '@fortawesome/free-solid-svg-icons'
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
import { AssetTile } from '@/components/create/AssetTile'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useCanonicalPath } from '@/hooks/useCanonicalPath'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import {
  addressNow, communitySlugById, getCommunity, getCommunityOverview, joinCommunity, leaveCommunity,
  listCommunityAssets, listCommunityEvents, listRelations,
  setEventAttendance,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { communityLink } from '@/lib/links'
import { AdBanner } from '@/components/ads/AdBanner'
import { LiveEventBar } from '@/components/community/LiveEventBar'
import { Tabs } from '@/components/ui/Tabs'

const tabs = ['About', 'Events', 'Members', 'Affiliates'] as const
type Tab = (typeof tabs)[number]

export default function CommunityPage() {
  const { slug: slugParam = '', id } = useParams()
  const navigate = useNavigate()

  const byId = useAsync(async () => (id ? communitySlugById(Number(id)) : null), [id])
  const slug = id ? byId.data ?? '' : slugParam
  const { profile } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('About')
  const [pending, setPending] = useState(false)
  const [reporting, setReporting] = useState(false)

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
  const events = useAsync(
    async () => (group ? listCommunityEvents(group.id) : []),
    [group?.id],
  )
  const store = useAsync(
    async () => (group ? listCommunityAssets(group.id) : []),
    [group?.id],
  )
  const allies = useAsync(async () => (group ? listRelations(group.id, 'ally') : []), [group?.id])
  const enemies = useAsync(async () => (group ? listRelations(group.id, 'enemy') : []), [group?.id])

  useTitle(group?.name ?? 'Community')
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
        onLeave={leave}
        onReport={() => setReporting(true)}
      />

      <Page width="narrow" className="pt-6">
        <Tabs
          look="line"
          label="Which part of this Community"
          value={tab}
          onChange={setTab}
          options={tabs.map((name) => ({ value: name, label: name }))}
        />

        {tab === 'About' && (
          <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_160px] xl:items-start">
            <div className="min-w-0 space-y-8">
            <Announcements communityId={group.id} rights={rights.data} />

            {/* What is on, kept short here with the rest under its own tab. */}
            {!!events.data?.filter((e) => !e.is_cancelled).length && (
              <section>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
                    <FontAwesomeIcon icon={faCalendarDay} className="text-base" />
                    Events
                  </h2>
                  <button
                    onClick={() => setTab('Events')}
                    className="ml-auto text-xs font-bold text-link hover:underline"
                  >
                    See all
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {events.data.filter((e) => !e.is_cancelled).slice(0, 3).map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onJoin={async (going) => {
                        try {
                          await setEventAttendance(event.id, going)
                          events.reload()
                        } catch (err) {
                          toast(err instanceof Error ? err.message : 'That did not work.', 'error')
                        }
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {!!store.data?.length && (
              <section>
                <h2 className="mb-3 font-display text-xl font-extrabold">
                  Made by {group.name}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {store.data.map((item) => <AssetTile key={item.id} item={item} />)}
                </div>
              </section>
            )}

            <CommunityWall communityId={group.id} rights={rights.data} />
            </div>

            <AdBanner size="tall" quiet className="hidden xl:sticky xl:top-[4.5rem] xl:block" />
          </div>
        )}

        {tab === 'Events' && (
          <div className="mt-6 space-y-6">
            {events.loading && <Skeleton className="h-40" />}

            {!events.loading && !events.data?.length && (
              <Card>
                <EmptyState
                  mood="emptyBox"
                  title="Nothing on yet"
                  body={
                    rights.data?.can_manage_community
                      ? 'Put something in the calendar and members will see it here.'
                      : `${group.name} has not announced anything.`
                  }
                  action={
                    rights.data?.can_manage_community
                      ? <Button to={`/c/${group.slug}/configure?section=Events`}>Make an event</Button>
                      : undefined
                  }
                />
              </Card>
            )}

            {!!events.data?.length && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {events.data.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onJoin={async (going) => {
                      try {
                        await setEventAttendance(event.id, going)
                        events.reload()
                      } catch (err) {
                        toast(err instanceof Error ? err.message : 'That did not work.', 'error')
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Members' && (
          <div className="mt-6">
            <CommunityMembers
              communityId={group.id}
              ownerId={group.owner_id}
              rights={rights.data}
              onChanged={() => { community.reload(); rights.reload() }}
            />
          </div>
        )}

        {tab === 'Affiliates' && (
          <div className="mt-6 space-y-8">
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
        )}
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
