import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagnifyingGlass, faXmark, faUserPlus, faCheck, faEllipsis, faUser, faBolt, faSeedling, faArrowDownAZ,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { NameMarks } from '@/components/brand/Verified'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { listPeople, sendFriendRequest } from '@/lib/api'
import { Menu } from '@/components/ui/Menu'
import { Choices } from '@/components/ui/Choices'
import { usePersonActions } from '@/components/social/personActions'
import type { PeopleSort } from '@/lib/api'
import { profileLink } from '@/lib/links'
import { formatCount } from '@/lib/format'
import type { Profile } from '@/types/db'
import { AdBanner } from '@/components/ads/AdBanner'
import { PersonAvatar } from '@/components/ui/PersonAvatar'

const sorts: { value: PeopleSort; label: string; icon: IconDefinition }[] = [
  { value: 'active', label: 'Around now', icon: faBolt },
  { value: 'new', label: 'Newest', icon: faSeedling },
  { value: 'name', label: 'A to Z', icon: faArrowDownAZ },
]

/**
 * One person, wide enough to say something about them: the picture you
 * recognise, whether they are about, and the start of their bio.
 */
function PersonCard({
  person, isYou, sent, onAdd, menu,
}: {
  person: Profile
  isYou: boolean
  sent: boolean
  onAdd: () => void
  menu?: React.ReactNode
}) {

  return (
    <article className="flex gap-3.5 rounded-2xl border border-ink-line bg-ink-card p-3.5 transition-colors hover:border-brand/60">
      <Link to={profileLink(person)} className="shrink-0">
        <PersonAvatar person={person} size="lg" square ring="ring-ink-card" />
      </Link>

      <div className="min-w-0 flex-1">
        <Link to={profileLink(person)} className="flex items-center gap-1.5 hover:text-link">
          <span className="truncate font-bold">{person.display_name}</span>
          <NameMarks person={person} className="text-[11px]" />
          {isYou && (
            <span className="shrink-0 rounded-md bg-ink-raised px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
              You
            </span>
          )}
        </Link>
        <p className="truncate text-xs text-muted">@{person.username}</p>

        {person.bio && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/55">{person.bio}</p>
        )}

        {!isYou && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <Button
              size="sm"
              variant={sent ? 'subtle' : 'primary'}
              icon={sent ? faCheck : faUserPlus}
              disabled={sent}
              onClick={onAdd}
            >
              {sent ? 'Sent' : 'Add'}
            </Button>
            {/* Writing to somebody is something friends do, so this is a
                request first. What is here instead is the quiet half:
                ignoring and blocking, which need no introduction. */}
            {menu}
          </div>
        )}
      </div>
    </article>
  )
}

export default function People() {
  useTitle('People')
  const { profile } = useAuth()
  const toast = useToast()

  const [params, setParams] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(term)
  const [sort, setSort] = useState<PeopleSort>('active')
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

  const people = useAsync(
    () => listPeople({ search: debounced, sort, limit: 48 }),
    [debounced, sort],
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

  const menuFor = (person: Profile) => (
    <Menu
      label={`Options for ${person.display_name}`}
      trigger={
        <span className="grid h-8 w-8 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white">
          <FontAwesomeIcon icon={faEllipsis} />
        </span>
      }
      items={[
        { label: 'Open profile', icon: faUser, to: profileLink(person) },
        ...actions.itemsFor(person, {}),
      ]}
    />
  )

  const found = people.data ?? []

  return (
    <div className="mx-auto w-full max-w-[86rem] px-4 py-6 sm:px-6">
      {/* The search leads, the way it does in Create and in Communities. */}
      <section className="relative overflow-hidden rounded-3xl border border-ink-line bg-ink-card px-5 py-7 sm:px-8 sm:py-9">

        <div className="relative">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">People</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            Everybody on Kobblon, yourself included. Search a name, a username or the words
            somebody wrote about themselves.
          </p>

          <div className="relative mt-5">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/35"
            />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search everybody"
              aria-label="Search people"
              className="h-14 w-full rounded-2xl border border-ink-line bg-ink-raised pl-12 pr-12 text-base font-semibold shadow-card transition-colors placeholder:font-normal placeholder:text-white/30 focus:border-brand-bright focus:outline-none"
            />
            {term && (
              <button
                onClick={() => setTerm('')}
                aria-label="Clear the search"
                className="absolute right-4 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Choices
              label="How to sort"
              value={sort}
              options={sorts}
              onChange={(next) => setSort(next)}
            />
          </div>
        </div>
      </section>

      {people.loading && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      )}

      {people.error && (
        <div className="mt-6"><ErrorState message={people.error} onRetry={people.reload} /></div>
      )}

      {!people.loading && !people.error && !found.length && (
        <Card className="mt-6">
          <EmptyState
            mood="noResults"
            title="Kobby could not find anybody"
            body={debounced ? `Nothing matches "${debounced}".` : 'Nobody to show yet.'}
            action={
              debounced
                ? <Button variant="subtle" onClick={() => setTerm('')}>Clear the search</Button>
                : undefined
            }
          />
        </Card>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_160px] xl:items-start">
        <div className="min-w-0">
      {!!found.length && (
        <section className="mt-6">
          <p className="mb-3 text-sm text-muted">
            {formatCount(found.length)} {found.length === 1 ? 'person' : 'people'}
            {debounced ? ` for "${debounced}"` : ''}
          </p>
          {/* A long list gets one partway down, where somebody reading
              their way through it actually is. */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {found.slice(0, 9).map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                isYou={person.id === profile?.id}
                sent={sent.includes(person.id)}
                onAdd={() => add(person)}
                menu={menuFor(person)}
              />
            ))}
          </div>

          {found.length > 9 && (
            <>
              <AdBanner className="my-6" quiet />

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                {found.slice(9).map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    isYou={person.id === profile?.id}
                    sent={sent.includes(person.id)}
                    onAdd={() => add(person)}
                    menu={menuFor(person)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}
        </div>

        <AdBanner size="tall" quiet className="hidden xl:sticky xl:top-[4.5rem] xl:block" />
      </div>

      {actions.dialog}
    </div>
  )
}
