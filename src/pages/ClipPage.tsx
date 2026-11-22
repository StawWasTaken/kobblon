import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  faEllipsis, faEye, faGlobe, faLink, faTrash, faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { MediaPlayer } from '@/components/ui/MediaPlayer'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { Reactions } from '@/components/social/Reactions'
import { ClipShelf } from '@/components/clips/ClipCard'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import {
  clipByNumber, clipPoster, clipUrl, clipsInWorld, clipsOf, reactionsOn,
  removeClip, setClipPrivacy, watchedClip,
} from '@/lib/api'
import { formatCount, timeAgo } from '@/lib/format'
import { profileLink, worldLink } from '@/lib/links'

/*
 * One clip, on a page of its own.
 *
 * This is the address that travels: a link somebody drops in a chat has to
 * land somewhere that plays without signing in, says what World it came
 * from, and offers the way into it. The World link under the player is the
 * whole point of the feature - a clip is an advert for a World that nobody
 * had to pay for.
 */
export default function ClipPage() {
  const { id } = useParams()
  const number = Number(id)
  const { profile } = useAuth()
  const say = useToast()
  const [gone, setGone] = useState(false)

  const clip = useAsync(
    async () => (Number.isFinite(number) ? clipByNumber(number) : null),
    [number],
  )
  const one = clip.data ?? null

  const faces = useAsync(async () => (one ? reactionsOn('clip', one.id) : []), [one?.id])

  /* More from the same World, then more from the same person. A clip that
     ends on nothing is a dead end. */
  const more = useAsync(async () => {
    if (!one) return []
    const rows = one.world_id ? await clipsInWorld(one.world_id, 9) : await clipsOf(one.owner_id, 9)
    return rows.filter((row) => row.id !== one.id).slice(0, 8)
  }, [one?.id, one?.world_id])

  /* Counted once, when it arrives. */
  useEffect(() => {
    if (one) void watchedClip(one.id)
  }, [one?.id])

  useTitle(one ? (one.title || `Clip by @${one.owner_username}`) : 'Clip')
  useSocialCard({
    title: one?.title ?? undefined,
    description: one?.world_name ? `In ${one.world_name}` : undefined,
    image: one ? clipPoster(one) : undefined,
  })

  if (clip.loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <Skeleton className="mt-4 h-8 w-2/3 rounded-xl" />
      </div>
    )
  }

  if (!one || gone) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16">
        <EmptyState
          mood="noResults"
          title={gone ? 'Taken down' : 'No clip here'}
          body={gone ? 'That one is gone.' : 'It was taken down, or it was never for you.'}
        />
      </div>
    )
  }

  const mine = profile?.id === one.owner_id

  const takeDown = async () => {
    try {
      await removeClip(one.id)
      setGone(true)
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    }
  }

  const change = async (who: 'everyone' | 'friends') => {
    try {
      await setClipPrivacy(one.id, who)
      await clip.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <MediaPlayer
        src={clipUrl(one.path)}
        kind="video"
        poster={clipPoster(one)}
        className="overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line"
      />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold leading-tight">
            {one.title || 'Clip'}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <span className="flex items-center gap-1">
              <Glyph icon={faEye} className="text-tiny" />
              {formatCount(one.view_count)}
            </span>
            <span aria-hidden="true">·</span>
            {timeAgo(one.created_at)}
            {one.privacy === 'friends' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  <Glyph icon={faUserGroup} className="text-tiny" />
                  Friends only
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="subtle"
            icon={faLink}
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href)
              say('Link copied.', 'success')
            }}
          >
            Copy link
          </Button>

          {mine && (
            <Menu
              label="More"
              align="right"
              trigger={
                <span className="grid h-9 w-9 place-items-center rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised text-white/70 transition-colors hover:text-white">
                  <Glyph icon={faEllipsis} />
                </span>
              }
              items={[
                one.privacy === 'everyone'
                  ? { label: 'Friends only', icon: faUserGroup, onSelect: () => void change('friends') }
                  : { label: 'Everyone', icon: faGlobe, onSelect: () => void change('everyone') },
                { label: 'Take it down', icon: faTrash, danger: true, onSelect: () => void takeDown() },
              ]}
            />
          )}
        </div>
      </div>

      {/* Who, and where from. The World is a button, not a word. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink-line bg-ink-card p-3">
        <Link to={profileLink({ username: one.owner_username })} className="flex min-w-0 items-center gap-2.5">
          <Avatar
            src={one.owner_avatar_url ?? undefined}
            personId={one.owner_id}
            name={one.owner_display_name ?? one.owner_username}
            size="sm"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">
              {one.owner_display_name || one.owner_username}
            </span>
            <span className="block truncate text-xs text-muted">@{one.owner_username}</span>
          </span>
        </Link>

        {one.world_name && one.world_content_id && (
          <Button
            size="sm"
            variant="brand"
            className="ml-auto"
            to={worldLink({
              content_id: one.world_content_id,
              slug: one.world_slug,
              name: one.world_name,
            })}
          >
            Open {one.world_name}
          </Button>
        )}
      </div>

      <Reactions
        what="clip"
        which={one.id}
        counts={faces.data ?? []}
        canReact={!!profile && !profile.is_guest}
        whyNot="Sign in to react."
        onChanged={faces.reload}
        className="mt-4"
      />

      {!!more.data?.length && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-extrabold">
            {one.world_name ? `More from ${one.world_name}` : 'More from them'}
          </h2>
          <ClipShelf clips={more.data} posterOf={clipPoster} />
        </section>
      )}
    </div>
  )
}
