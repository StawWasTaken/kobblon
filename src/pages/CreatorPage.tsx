import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { faMagnifyingGlass, faUser } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Choices } from '@/components/ui/Choices'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { AssetTile, kindLabels } from '@/components/create/AssetTile'
import { useAsync } from '@/hooks/useAsync'
import { useExactTitle } from '@/hooks/useTitle'
import { getCreatorPage, listAssets } from '@/lib/api'
import { avatarOf } from '@/lib/avatars'
import { formatCount, timeAgo } from '@/lib/format'
import { profileLink } from '@/lib/links'
import type { AssetKind } from '@/types/db'
import { Verified } from '@/components/brand/Verified'
import { BackLink } from '@/components/ui/BackLink'

const kinds: (AssetKind | 'all')[] = ['all', 'image', 'audio', 'video', 'font', 'mesh', 'build']

/** Everything one person has published to the marketplace. */
export default function CreatorPage() {
  const { username = '' } = useParams()
  const [kind, setKind] = useState<AssetKind | 'all'>('all')
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 250)
    return () => window.clearTimeout(timer)
  }, [term])

  const creator = useAsync(() => getCreatorPage(username), [username])
  useExactTitle(
    creator.data
      ? `${creator.data.display_name} on Kobblon Create`
      : 'Kobblon Create',
  )
  const items = useAsync(
    () => listAssets({ creator: username, kind, search: debounced, limit: 60 }),
    [username, kind, debounced],
  )

  if (creator.loading) return <Skeleton className="h-64" />
  if (creator.error) return <ErrorState message={creator.error} onRetry={creator.reload} />

  if (!creator.data) {
    return (
      <Card>
        <EmptyState
          mood="noResults"
          title="Nobody here"
          body={`There is no @${username} on Kobblon.`}
          action={<Button to="/create/marketplace">Back to the marketplace</Button>}
        />
      </Card>
    )
  }

  const person = creator.data

  return (
    <div className="space-y-6">
      <BackLink to="/create/marketplace">Back to the marketplace</BackLink>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar
          src={avatarOf({ avatar_url: person.avatar_url })}
          name={person.display_name}
          size="xl"
          className="rounded-2xl"
        />

        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold sm:text-3xl">
            {person.display_name}
            {person.is_admin && (
              <Verified className="text-lg" />
            )}
          </h1>
          <p className="mt-1 text-sm text-muted">
            @{person.username} · {formatCount(person.items)} in the marketplace ·{' '}
            {formatCount(person.uses)} uses · here since {timeAgo(person.joined)}
          </p>
          {person.bio && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">{person.bio}</p>
          )}
        </div>

        <Button variant="subtle" icon={faUser} to={profileLink(person)}>
          Their profile
        </Button>
      </header>

      <div className="space-y-3">
        <Input
          icon={faMagnifyingGlass}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={`Search what ${person.display_name} has made`}
          aria-label={`Search work by ${person.display_name}`}
        />

        <Choices
          label="What kind of content"
          value={kind}
          options={kinds.map((k) => ({
            value: k,
            label: k === 'all' ? 'Everything' : kindLabels[k],
          }))}
          onChange={(next) => setKind(next)}
        />
      </div>

      {items.loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[4/5]" />)}
        </div>
      )}

      {!items.loading && !items.data?.length && (
        <Card>
          <EmptyState
            mood={debounced ? 'noResults' : 'emptyBox'}
            title={debounced ? 'Nothing matches' : 'Nothing published yet'}
            body={
              debounced
                ? `Nothing by ${person.display_name} matches "${debounced}".`
                : `${person.display_name} has not put anything in the marketplace.`
            }
          />
        </Card>
      )}

      {!!items.data?.length && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {items.data.map((item) => <AssetTile key={item.id} item={item} />)}
        </div>
      )}

    </div>
  )
}
