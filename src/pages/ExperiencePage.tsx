import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlay, faDesktop, faUser, faEye, faCube, faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useAsync } from '@/hooks/useAsync'
import { useCanonicalPath } from '@/hooks/useCanonicalPath'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import { getExperience } from '@/lib/api'
import { play } from '@/lib/app'
import { experienceLink } from '@/lib/links'
import { formatCount } from '@/lib/format'

/*
 * An experience, on the website.
 *
 * The website is where you find a thing and read about it. Pressing Play
 * hands its id to the Launcher, which is what actually runs it. Nothing on
 * this page pretends the browser can.
 */
export default function ExperiencePage() {
  const { id = '' } = useParams()
  const number = Number(id)

  const experience = useAsync(async () => (number ? getExperience(number) : null), [number])
  const thing = experience.data
  const [missing, setMissing] = useState(false)

  useCanonicalPath(thing?.content_id === number ? experienceLink(thing) : null)
  useTitle(thing?.name ?? 'Experience')
  useSocialCard({
    title: thing ? `${thing.name} - Kobblon` : null,
    description: thing?.description
      ?? (thing ? `An experience on Kobblon by ${thing.creator_name ?? 'somebody'}.` : null),
    image: thing?.cover_url ?? null,
  })

  if (experience.loading) {
    return <Page width="narrow"><Skeleton className="h-80 rounded-2xl" /></Page>
  }

  if (experience.error) {
    return (
      <Page width="narrow">
        <ErrorState message={experience.error} onRetry={experience.reload} />
      </Page>
    )
  }

  if (!thing) {
    return (
      <Page width="narrow">
        <Card>
          <EmptyState
            mood="noResults"
            title="No experience here"
            body="There is nothing at that address. It may have been taken down."
            action={<Button to="/discover">See what else there is</Button>}
          />
        </Card>
      </Page>
    )
  }

  return (
    <Page width="narrow" className="space-y-6">
      {/* The thing itself, big, because that is what somebody came for. */}
      <Card className="overflow-hidden p-0">
        <div className="relative aspect-[16/7] bg-media">
          {thing.cover_url && (
            <img
              src={thing.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-card via-ink-card/40 to-transparent" />
        </div>

        <div className="flex flex-wrap items-end gap-5 p-6">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              {thing.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <FontAwesomeIcon icon={faUser} />
                {thing.creator_name ?? 'Kobblon'}
              </span>
              <span className="flex items-center gap-1.5">
                <FontAwesomeIcon icon={faEye} />
                {formatCount(thing.visit_count)} {thing.visit_count === 1 ? 'visit' : 'visits'}
              </span>
            </p>
          </div>

          <Button size="lg" icon={faPlay} onClick={() => play(thing.id, () => setMissing(true))}>
            Play
          </Button>
        </div>
      </Card>

      {thing.description && (
        <Card className="p-6">
          <h2 className="font-display text-xl font-extrabold">About</h2>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-white/75">
            {thing.description}
          </p>
        </Card>
      )}

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <FontAwesomeIcon icon={faCube} className="text-lg text-brand-bright" />
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted">
          Experiences run in the Kobblon Launcher, not in a browser tab. Pressing Play opens it.
        </p>
        <Link
          to="/download"
          className="flex items-center gap-2 text-sm font-bold text-link hover:underline"
        >
          Get the Launcher
          <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
        </Link>
      </Card>

      {/* Nothing happened, so say so rather than leaving somebody pressing. */}
      <Dialog
        open={missing}
        onClose={() => setMissing(false)}
        title="You need the Kobblon Launcher"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            Experiences run in the Launcher rather than in a browser. If you have it already, it
            may just be slow to open: give it a moment and press Play again.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setMissing(false)}>Close</Button>
            <Button icon={faDesktop} to="/download">Get the Launcher</Button>
          </div>
        </div>
      </Dialog>
    </Page>
  )
}
