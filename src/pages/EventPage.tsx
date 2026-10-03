import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDay, faUserGroup, faLink, faBan, faGear, faArrowRightToBracket,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { useCanonicalPath } from '@/hooks/useCanonicalPath'
import { eventLink } from '@/lib/links'
import { useExactTitle, useSocialCard } from '@/hooks/useTitle'
import { getEvent, listEventAttendees, setEventAttendance } from '@/lib/api'
import { avatarOf } from '@/lib/avatars'
import { formatCount } from '@/lib/format'
import { communityLink, profileLink } from '@/lib/links'
import { BackLink } from '@/components/ui/BackLink'

const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
})

/** One event, by its number. */
export default function EventPage() {
  const { id = '' } = useParams()
  const toast = useToast()

  const number = useMemo(() => Number(id), [id])
  const event = useAsync(
    async () => (Number.isFinite(number) ? getEvent(number) : null),
    [number],
  )
  useCanonicalPath(event.data?.content_id === number ? eventLink(event.data) : null)

  const going = useAsync(
    async () => (event.data ? listEventAttendees(event.data.id) : []),
    [event.data?.id],
  )

  useExactTitle(event.data ? `${event.data.title} - Kobblon` : null)
  useSocialCard({
    title: event.data ? `${event.data.title} - Kobblon` : null,
    description: event.data?.subtitle ?? event.data?.description ?? null,
    image: event.data?.cover_url ?? null,
  })

  if (event.loading) return <Page><Skeleton className="h-96 w-full" /></Page>
  if (event.error) return <Page><ErrorState message={event.error} onRetry={event.reload} /></Page>

  if (!event.data) {
    return (
      <Page>
        <Card>
          <EmptyState
            mood="noResults"
            title="No event here"
            body={`Nothing carries the number ${id}.`}
            action={<Button to="/communities">All communities</Button>}
          />
        </Card>
      </Page>
    )
  }

  const it = event.data
  const over = new Date(it.ends_at ?? it.starts_at) < new Date()

  const answer = async (next: boolean) => {
    try {
      await setEventAttendance(it.id, next)
      event.reload()
      going.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  return (
    <Page width="narrow" className="space-y-6">
      <BackLink
        to={communityLink({ slug: it.community_slug, content_id: it.community_content_id })}
      >
        Back to {it.community_name}
      </BackLink>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
        <div className="space-y-4">
          <div className="aspect-[16/9] overflow-hidden rounded-2xl border border-ink-line bg-media">
            {it.cover_url ? (
              <img
                src={it.cover_url}
                alt=""
                draggable={false}
                className="h-full w-full select-none object-cover"
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-4xl text-white/20">
                <FontAwesomeIcon icon={faCalendarDay} />
              </span>
            )}
          </div>

          <Link
            to={communityLink({ slug: it.community_slug, content_id: it.community_content_id })}
            className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-card p-3 transition-colors hover:border-brand/60"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-deep text-xs font-extrabold">
              {it.community_icon
                ? <img src={it.community_icon} alt="" className="h-full w-full object-cover" />
                : it.community_name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted">Hosted by</span>
              <span className="block truncate text-sm font-bold">{it.community_name}</span>
            </span>
          </Link>
        </div>

        <div className="min-w-0 space-y-5">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              {it.is_cancelled && <Badge tone="warm" icon={faBan}>Cancelled</Badge>}
              {!it.is_cancelled && over && <Badge tone="neutral">Finished</Badge>}
              <span className="font-mono text-xs text-link">EVT-{it.content_id}</span>
            </div>

            <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              {it.title}
            </h1>
            {it.subtitle && <p className="mt-1 text-muted">{it.subtitle}</p>}

            <p className="mt-3 text-sm font-semibold">
              {stamp(it.starts_at)}
              {it.ends_at && <span className="text-muted"> to {stamp(it.ends_at)}</span>}
            </p>
          </header>

          <div className="flex flex-wrap items-center gap-2">
            {!it.is_cancelled && !over && (
              <Button
                size="lg"
                variant={it.i_am_going ? 'subtle' : 'primary'}
                icon={faArrowRightToBracket}
                onClick={() => answer(!it.i_am_going)}
              >
                {it.i_am_going ? 'You are going' : 'Join Event'}
              </Button>
            )}

            <Tooltip label="Copy a link to this event" side="top">
              <Button
                variant="ghost"
                icon={faLink}
                aria-label="Copy a link to this event"
                onClick={() => {
                  void navigator.clipboard?.writeText(window.location.href)
                  toast('Link copied.', 'success')
                }}
              />
            </Tooltip>

            {it.i_can_manage && (
              <Button variant="ghost" icon={faGear} to={`/c/${it.community_slug}/configure`}>
                Manage
              </Button>
            )}
          </div>

          <section>
            <h2 className="flex items-center gap-2 text-sm font-extrabold">
              <FontAwesomeIcon icon={faUserGroup} />
              {formatCount(it.attending_count)} going
            </h2>

            {going.loading && <Skeleton className="mt-3 h-12" />}

            {!going.loading && !going.data?.length && (
              <p className="mt-2 text-sm text-muted">Nobody yet. Be the first.</p>
            )}

            {!!going.data?.length && (
              <div className="mt-3 flex flex-wrap gap-2">
                {going.data.map((person) => (
                  <Tooltip key={person.user_id} label={person.display_name} side="top">
                    <Link to={profileLink(person)}>
                      <Avatar
                        src={avatarOf(person)}
                        personId={person.user_id}
                        name={person.display_name}
                        size="md"
                        className="rounded-xl"
                      />
                    </Link>
                  </Tooltip>
                ))}
              </div>
            )}
          </section>

          {it.description && (
            <section>
              <h2 className="mb-2 text-sm font-extrabold">Description</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                {it.description}
              </p>
            </section>
          )}
        </div>
      </div>
    </Page>
  )
}
