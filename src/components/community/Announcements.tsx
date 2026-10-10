import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBullhorn, faPen, faTrash, faEllipsis, faPlus, faImage, faVideo, faXmark,
  faThumbsUp, faThumbsDown,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Menu } from '@/components/ui/Menu'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { MediaPlayer } from '@/components/create/MediaPlayer'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import {
  listCommunityPosts, removeCommunityPost, saveAnnouncement, uploadCommunityImage, votePost,
} from '@/lib/api'
import { avatarOf } from '@/lib/avatars'
import { formatCount, timeAgo } from '@/lib/format'
import { profileLink } from '@/lib/links'
import type { CommunityOverview, CommunityPost } from '@/types/db'
import { Verified } from '@/components/brand/Verified'
import { overlayButton } from '@/lib/overlay'
import { cn } from '@/lib/cn'
import { Emoji } from '@/components/ui/Emoji'

const MAX_BYTES = 12 * 1024 * 1024

/**
 * What a Community is saying right now. There is one announcement at a time:
 * making a new one retires the one before it, so the Community always has a
 * single clear thing to say. It carries a heading, a picture or a clip, can
 * be fixed after it goes out, and never appears on the wall, which is for
 * conversation.
 */
export function Announcements({
  communityId, rights,
}: {
  communityId: string
  rights?: CommunityOverview | null
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const posts = useAsync(() => listCommunityPosts(communityId, true), [communityId])

  /** Yes, no, or taking it back by pressing the one you already pressed. */
  const vote = async (post: CommunityPost, up: boolean) => {
    const already = up ? post.i_like : post.i_dislike
    try {
      await votePost(post.id, already ? null : up)
      posts.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not go through.', 'error')
    }
  }

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CommunityPost | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<{ url: string; kind: 'image' | 'video' } | null>(null)
  const [pending, setPending] = useState(false)

  const canManage = !!rights?.can_manage_community
  const current = (posts.data ?? [])[0] ?? null

  const begin = (post: CommunityPost | null) => {
    setEditing(post)
    setTitle(post?.title ?? '')
    setBody(post?.body ?? '')
    setMedia(post?.media_url && post.media_kind
      ? { url: post.media_url, kind: post.media_kind }
      : null)
    setOpen(true)
  }

  const attach = async (file: File | undefined) => {
    if (!file || !profile) return
    const kind = file.type.startsWith('video/') ? 'video' as const : 'image' as const
    if (file.size > MAX_BYTES) { toast('12 MB at most.', 'error'); return }
    setPending(true)
    try {
      const url = await uploadCommunityImage(profile.id, file, 'cover')
      setMedia({ url, kind })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not upload.', 'error')
    } finally {
      setPending(false)
    }
  }

  const save = async () => {
    if (!profile) return
    if (body.trim().length < 1) { toast('Say something.', 'error'); return }
    setPending(true)
    try {
      await saveAnnouncement({
        id: editing?.id,
        communityId,
        authorId: profile.id,
        title: title.trim() || null,
        body: body.trim(),
        mediaUrl: media?.url ?? null,
        mediaKind: media?.kind ?? null,
      })
      toast(editing ? 'Updated.' : 'Announced.', 'success')
      setOpen(false)
      posts.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not post.', 'error')
    } finally {
      setPending(false)
    }
  }

  if (!canManage && !posts.loading && !posts.data?.length) return null

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
          <FontAwesomeIcon icon={faBullhorn} className="text-sm" />
          Announcement
        </h2>

        <div className="ml-auto flex items-center gap-2">
          {canManage && (
            <Button size="sm" variant="subtle" icon={faPlus} onClick={() => begin(null)}>
              {current ? 'Replace it' : 'Announce'}
            </Button>
          )}
        </div>
      </div>

      {posts.loading && <Skeleton className="h-24" />}

      {!posts.loading && !current && (
        <p className="text-sm text-muted">Nothing announced yet.</p>
      )}

      <div>
        {[current].filter((post): post is CommunityPost => !!post).map((post) => (
          <article
            key={post.id}
            className="relative overflow-hidden rounded-2xl border border-brand/30 bg-brand/[0.07]"
          >

            <div className="relative p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Link to={profileLink({
                  username: post.author_username, content_id: post.author_content_id,
                })} className="shrink-0">
                  <Avatar
                    src={avatarOf({ avatar_url: post.author_avatar_url })}
                    personId={post.author_id}
                    name={post.author_display_name}
                    size="md"
                    className="rounded-xl"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  {post.title && (
                    <h3 className="font-display text-lg font-extrabold leading-tight">
                      {post.title}
                    </h3>
                  )}
                  <p className="text-xs text-muted">
                    <Link
                      to={profileLink({
                        username: post.author_username, content_id: post.author_content_id,
                      })}
                      className="inline-flex items-center gap-1 font-bold text-white/80 hover:underline"
                    >
                      {post.author_display_name}
                      {post.author_is_verified && <Verified className="text-[11px]" />}
                    </Link>
                    {post.author_rank && <span> · {post.author_rank}</span>}
                    <span> · {timeAgo(post.created_at)}</span>
                    {post.edited_at && <span> · edited</span>}
                  </p>
                </div>

                {post.i_can_remove && (
                  <Menu
                    label="Announcement options"
                    align="right"
                    trigger={
                      <span className="grid h-8 w-8 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white">
                        <FontAwesomeIcon icon={faEllipsis} />
                      </span>
                    }
                    items={[
                      { label: 'Edit', icon: faPen, onSelect: () => begin(post) },
                      {
                        label: 'Delete',
                        icon: faTrash,
                        danger: true,
                        onSelect: async () => {
                          await removeCommunityPost(post.id)
                          posts.reload()
                        },
                      },
                    ]}
                  />
                )}
              </div>

              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
                <Emoji>{post.body}</Emoji>
              </p>

              {post.media_url && post.media_kind === 'image' && (
                <img
                  src={post.media_url}
                  alt=""
                  loading="lazy"
                  className="mt-3 max-h-96 w-full rounded-xl object-cover"
                />
              )}

              {post.media_url && post.media_kind === 'video' && (
                <MediaPlayer src={post.media_url} kind="video" className="mt-3" />
              )}

              {/* An announcement is a Community talking to its members, and
                  they should be able to answer with more than silence. */}
              <div className="mt-4 flex items-center gap-2">
                {([
                  { up: true, icon: faThumbsUp, count: post.like_count, mine: post.i_like },
                  { up: false, icon: faThumbsDown, count: post.dislike_count, mine: post.i_dislike },
                ] as const).map((side) => (
                  <button
                    key={String(side.up)}
                    onClick={() => vote(post, side.up)}
                    aria-pressed={side.mine}
                    aria-label={side.up ? 'Yes' : 'No'}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors',
                      side.mine
                        ? 'border-brand-bright bg-brand/20 text-white'
                        : 'border-ink-line bg-ink-raised text-white/60 hover:bg-ink-hover hover:text-white',
                    )}
                  >
                    <FontAwesomeIcon icon={side.icon} />
                    {formatCount(side.count ?? 0)}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit this announcement' : current ? 'Replace the announcement' : 'New announcement'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={pending} onClick={save}>{editing ? 'Save' : 'Announce it'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {!editing && current && (
            <p className="rounded-xl border border-ink-line bg-ink-raised p-3 text-xs leading-relaxed text-muted">
              A Community says one thing at a time. Posting this retires the announcement that
              is up now.
            </p>
          )}

          <Input
            label="Heading"
            labelNote="optional"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="We are live"
          />

          <Textarea
            label="What is happening"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            className="min-h-[9rem]"
            hint={`${body.length}/4000`}
          />

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              Picture or clip <span className="font-semibold normal-case text-white/35">optional</span>
            </p>

            {media ? (
              <div className="relative overflow-hidden rounded-xl border border-ink-line">
                {media.kind === 'image'
                  ? <img src={media.url} alt="" className="max-h-56 w-full object-cover" />
                  : <MediaPlayer src={media.url} kind="video" />}
                <button
                  type="button"
                  onClick={() => setMedia(null)}
                  aria-label="Remove"
                  className={cn('absolute right-2 top-2 h-8 w-8', overlayButton)}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-ink-hover px-3 py-2 text-xs font-bold transition-colors hover:bg-ink-line">
                <FontAwesomeIcon icon={faImage} />
                <FontAwesomeIcon icon={faVideo} />
                {pending ? 'Uploading...' : 'Add a picture or a clip'}
                <input
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
                  onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = '' }}
                />
              </label>
            )}
          </div>
        </div>
      </Dialog>
    </section>
  )
}
