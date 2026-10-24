import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Glyph } from '@/components/brand/Glyph'
import {
  faComment, faEye, faLock, faPlus, faThumbsUp, faThumbtack,
  faCheck, faXmark, faClockRotateLeft, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { ForumShell, BoardMark, BoardStrip, BOARD_COLOUR } from '@/components/forum/Shell'
import { TopicRow } from '@/components/forum/TopicRow'
import { Composer } from '@/components/forum/Composer'
import {
  Attachments, Byline, Flags, Helpful, PostBody, StatusPill,
} from '@/components/forum/Pieces'
import {
  forumBoards, forumCreateTopic, forumLike, forumMarkAnswer, forumRemove,
  forumReplies, forumReply, forumSeen, forumSetFlags, forumSetStatus,
  forumTopic as getTopic, forumTopics,
} from '@/lib/api'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ForumBoard, ForumReply, ForumSort, ForumStatus, ForumTopic } from '@/types/db'

/**
 * The forum.
 *
 * Staw, and this is the line the whole page is built on: "i dont want a
 * sort of introduction to the community forum i want that when u arrive u
 * directly see the multiple categories etc". So `/forum` is the board
 * index. No hero, no headline about what a forum is, nothing to scroll
 * past - the categories are the first thing under the bar.
 *
 * The shape is the one every forum worth using has, Discourse and the two
 * Staw pointed at: a stripe of colour per category, the name and what it is
 * for, the two numbers that say whether it is alive, and the last thing
 * somebody said. What is ours is everything else - the ink, the brand blue,
 * the display type, our own icons where one of them means the right thing.
 *
 * Four pages in one file because they are one thing and share all their
 * furniture: the index, a category, a topic, and the form for starting one.
 *
 * Readable by anybody, writable by anybody signed in - and that is enforced
 * in the database rather than here. Every function refuses a guest, a
 * suspended account and a stranger on its own, so a page that forgot to
 * hide a button is a page with a button that says no.
 */

const SORTS: { id: ForumSort; label: string }[] = [
  { id: 'active', label: 'Latest' },
  { id: 'new', label: 'New' },
  { id: 'helpful', label: 'Helpful' },
  { id: 'viewed', label: 'Most read' },
]

/* ------------------------------------------------------------- the index */

export default function Forum() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'latest' ? 'latest' : 'categories'

  const boards = useAsync(forumBoards, [])
  const latest = useAsync(() => forumTopics({ sort: 'active', limit: 30 }), [])
  const recent = useAsync(() => forumTopics({ sort: 'active', limit: 8 }), [])
  const helpful = useAsync(() => forumTopics({ sort: 'helpful', limit: 5 }), [])
  const read = useAsync(() => forumTopics({ sort: 'viewed', limit: 5 }), [])
  const fresh = useAsync(() => forumTopics({ sort: 'new', limit: 5 }), [])

  const go = (next: 'categories' | 'latest') => {
    if (next === 'categories') params.delete('view')
    else params.set('view', next)
    setParams(params, { replace: true })
  }

  return (
    <ForumShell boards={boards.data ?? []} loading={boards.loading}>
      <header className="flex flex-wrap items-center gap-4 border-b border-white/[0.07] pb-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Forum</h1>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-ink-card/60 p-1">
          <Switch on={view === 'categories'} onPress={() => go('categories')}>Categories</Switch>
          <Switch on={view === 'latest'} onPress={() => go('latest')}>Latest</Switch>
        </div>
        <span className="ml-auto lg:hidden">
          <Button to="/forum/new" size="sm" variant="yes" icon={faPlus}>Start a topic</Button>
        </span>
      </header>

      <div className="pt-5">
        <BoardStrip boards={boards.data ?? []} />

        {/*
         * The boards and what is going on, side by side. The activity rail
         * is the second column rather than a band underneath because a
         * forum is read by looking for the room *and* for the last thing
         * said, and one under the other means scrolling past six
         * categories to find out whether anybody is here.
         */}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            {view === 'categories' ? (
              <BoardTable boards={boards.data ?? []} loading={boards.loading} />
            ) : (
              <TopicTable topics={latest.data ?? []} loading={latest.loading} showCategory />
            )}
          </div>

          <Activity topics={recent.data ?? []} loading={recent.loading} />
        </div>

        {/*
         * The feed Staw asked for, under the boards rather than over them:
         * what people found helpful, what everybody has read, and what has
         * only just gone up. Three short lists across the whole width, not
         * a wall, and not stuffed into the column the boards are in - that
         * leaves the page empty beside them.
         */}
        {view === 'categories' && (
          <section className="mt-10 grid gap-8 border-t border-white/[0.07] pt-8 sm:grid-cols-2 xl:grid-cols-3">
            <Shelf
              title="Found helpful"
              icon={faThumbsUp}
              topics={helpful.data ?? []}
              loading={helpful.loading}
              note={(t) => `${formatCount(t.like_count)} found it helpful`}
            />
            <Shelf
              title="Most read"
              icon={faEye}
              topics={read.data ?? []}
              loading={read.loading}
              note={(t) => `${formatCount(t.view_count)} views`}
            />
            <Shelf
              title="Just posted"
              icon={faComment}
              topics={fresh.data ?? []}
              loading={fresh.loading}
              note={(t) => `${t.author_name} in ${t.category_name}`}
            />
          </section>
        )}
      </div>
    </ForumShell>
  )
}

function Switch({ on, onPress, children }: {
  on: boolean
  onPress: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm font-extrabold transition-colors',
        on ? 'bg-brand text-white' : 'text-white/50 hover:bg-white/5 hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

/**
 * The boards, as a table.
 *
 * Three columns, each answering a different question: what the room is,
 * whether it is alive, and what was last said in it. The stripe of colour
 * down the left is the one thing worth copying outright from every forum
 * that has one - the eye finds the room before it reads a word.
 */
function BoardTable({ boards, loading }: { boards: ForumBoard[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-px">
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[4.5rem] rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="hidden grid-cols-[1fr_4.5rem_4.5rem_13rem] items-center gap-4 border-b border-white/10 bg-ink-raised/60 py-2.5 pl-5 pr-5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/35 lg:grid">
        <span>Category</span>
        <span className="text-right">Topics</span>
        <span className="text-right">Posts</span>
        <span className="pl-6">Latest</span>
      </div>

      <ul>
        {boards.map((board) => (
          <li key={board.slug} className="border-b border-white/[0.07] last:border-b-0">
            <div className="relative grid items-center gap-4 py-4 pl-5 pr-5 transition-colors hover:bg-white/[0.02] lg:grid-cols-[1fr_4.5rem_4.5rem_13rem]">
              {/* The stripe, full height and hard against the edge. */}
              <span className={cn(
                'absolute inset-y-0 left-0 w-1',
                BOARD_COLOUR[board.slug] ?? 'bg-white/30',
              )} />

              <div className="flex min-w-0 items-start gap-3">
                <BoardMark slug={board.slug} className="mt-0.5 h-9 w-9 text-base" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/forum/c/${board.slug}`}
                    className="inline-flex items-center gap-2 font-display text-base font-extrabold text-white transition-colors hover:text-brand-bright"
                  >
                    {board.name}
                    {board.staff_only && (
                      <Glyph icon={faLock} className="text-[11px] text-white/30" title="Staff post here" />
                    )}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/45">{board.blurb}</p>
                </div>
              </div>

              <span className="flex items-center gap-4 text-xs font-bold tabular-nums text-white/50 lg:block lg:text-right lg:text-sm">
                <span className="lg:hidden">{formatCount(board.topic_count)} topics</span>
                <span className="hidden lg:inline">{formatCount(board.topic_count)}</span>
                <span className="lg:hidden">{formatCount(board.post_count)} posts</span>
              </span>

              <span className="hidden text-right text-sm font-bold tabular-nums text-white/50 lg:block">
                {formatCount(board.post_count)}
              </span>

              {board.last_topic_id ? (
                <Link
                  to={`/forum/t/${board.last_topic_id}`}
                  className="group hidden min-w-0 items-center gap-3 pl-6 lg:flex"
                >
                  <Avatar
                    src={board.last_author_avatar}
                    name={board.last_author ?? 'Somebody'}
                    size="sm"
                    className="shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-white/70 transition-colors group-hover:text-brand-bright">
                      {board.last_title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-white/35">
                      {board.last_author} · {board.last_post_at ? timeAgo(board.last_post_at) : ''}
                    </span>
                  </span>
                </Link>
              ) : (
                <p className="hidden pl-6 text-sm text-white/25 lg:block">Nothing posted yet</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** What has just been said, anywhere. The rail beside the boards. */
function Activity({ topics, loading }: { topics: ForumTopic[]; loading: boolean }) {
  return (
    <aside className="min-w-0">
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
        <Glyph icon={faClockRotateLeft} className="text-brand-bright" />
        Recent activity
      </p>

      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-ink-card/40">
        {loading ? (
          <div className="space-y-px p-2">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : topics.length ? (
          <ul>
            {topics.map((topic) => (
              <li key={topic.id} className="border-b border-white/[0.06] last:border-b-0">
                <Link
                  to={`/forum/t/${topic.id}`}
                  className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                >
                  <Avatar
                    src={topic.author_avatar}
                    name={topic.author_name}
                    personId={topic.author_id}
                    size="xs"
                    className="shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-white/80 transition-colors group-hover:text-brand-bright">
                      {topic.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/35">
                      <span className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-sm',
                        BOARD_COLOUR[topic.category] ?? 'bg-white/30',
                      )} />
                      <span className="truncate">{topic.category_name}</span>
                      <span aria-hidden="true" className="shrink-0">·</span>
                      <span className="shrink-0 whitespace-nowrap">{timeAgo(topic.last_post_at)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-white/30">
                    {formatCount(topic.reply_count)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-white/25">Nobody has posted yet.</p>
        )}
      </div>
    </aside>
  )
}

function Shelf({ title, icon, topics, loading, note }: {
  title: string
  icon: typeof faThumbsUp
  topics: ForumTopic[]
  loading: boolean
  note: (topic: ForumTopic) => string
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/40">
        <Glyph icon={icon} className="text-brand-bright" />
        {title}
      </p>
      <ul className="mt-3">
        {loading
          ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="mb-1 h-11 rounded-lg" />)
          : topics.length
            ? topics.map((topic) => (
              <li key={topic.id}>
                <Link
                  to={`/forum/t/${topic.id}`}
                  className="group block rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="block truncate text-sm font-bold text-white/80 transition-colors group-hover:text-brand-bright">
                    {topic.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-white/35">{note(topic)}</span>
                </Link>
              </li>
            ))
            : <li className="px-2.5 text-sm text-white/25">Nothing yet.</li>}
      </ul>
    </div>
  )
}

/** The list of topics, with the column heads a board wants over it. */
function TopicTable({ topics, loading, showCategory, empty }: {
  topics: ForumTopic[]
  loading: boolean
  showCategory?: boolean
  empty?: { title: string; body: string; action?: React.ReactNode }
}) {
  if (loading) {
    return (
      <div className="space-y-px">
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    )
  }

  if (!topics.length) {
    return (
      <div className="rounded-2xl border border-white/10 py-14">
        <EmptyState
          title={empty?.title ?? 'Nothing here yet.'}
          body={empty?.body ?? 'Somebody has to be first, and it may as well be you.'}
          action={empty?.action}
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="hidden grid-cols-[auto_1fr_auto] items-center gap-5 border-b border-white/10 bg-ink-raised/60 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/35 sm:grid">
        <span className="w-10" />
        <span>Topic</span>
        <span className="flex gap-4">
          <span className="w-14 text-center">Replies</span>
          <span className="w-14 text-center">Views</span>
          <span className="w-14 text-center">Helpful</span>
        </span>
      </div>
      <ul>
        {topics.map((topic) => (
          <TopicRow key={topic.id} topic={topic} showCategory={showCategory} />
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------- a board */

export function ForumCategory() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const sort = (params.get('sort') as ForumSort) || 'active'
  const unanswered = params.get('unanswered') === '1'

  const boards = useAsync(forumBoards, [])
  const topics = useAsync(
    () => forumTopics({ category: slug, sort, limit: 50, unanswered }),
    [slug, sort, unanswered],
  )
  const board = (boards.data ?? []).find((one) => one.slug === slug)

  return (
    <ForumShell boards={boards.data ?? []} loading={boards.loading}>
      <header className="border-b border-white/[0.07] pb-5">
        <nav className="flex items-center gap-2 text-xs font-bold text-white/35">
          <Link to="/forum" className="transition-colors hover:text-brand-bright">Forum</Link>
          <span aria-hidden="true">/</span>
          <span className="text-white/60">{board?.name ?? '…'}</span>
        </nav>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <span className={cn('h-10 w-1.5 shrink-0 rounded-full', BOARD_COLOUR[slug] ?? 'bg-white/30')} />
          <BoardMark slug={slug} className="h-10 w-10 text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              {board?.name ?? 'Loading'}
            </h1>
            {board && <p className="mt-1 text-sm text-white/45">{board.blurb}</p>}
          </div>
          <Button to={`/forum/new?category=${slug}`} variant="yes" icon={faPlus}>
            Start a topic
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 py-5">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-ink-card/60 p-1">
          {SORTS.map((one) => (
            <Switch
              key={one.id}
              on={sort === one.id}
              onPress={() => {
                params.set('sort', one.id)
                setParams(params, { replace: true })
              }}
            >
              {one.label}
            </Switch>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (unanswered) params.delete('unanswered')
            else params.set('unanswered', '1')
            setParams(params, { replace: true })
          }}
          className={cn(
            'rounded-xl border px-3 py-2 text-sm font-extrabold transition-colors',
            unanswered
              ? 'border-brand-bright/50 bg-brand/15 text-brand-bright'
              : 'border-white/10 text-white/50 hover:text-white',
          )}
        >
          Unanswered
        </button>
      </div>

      <TopicTable
        topics={topics.data ?? []}
        loading={topics.loading}
        empty={{
          title: unanswered ? 'Everything here has an answer.' : 'Nothing here yet.',
          body: unanswered
            ? 'Which is either very good news or a very quiet board.'
            : 'Be the first to put something in this category.',
          action: (
            <Button to={`/forum/new?category=${slug}`} variant="yes" icon={faPlus}>
              Start a topic
            </Button>
          ),
        }}
      />
    </ForumShell>
  )
}

/* ------------------------------------------------------------- a topic */

export function ForumTopicPage() {
  const { id = '' } = useParams()
  const number = Number(id)
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const boards = useAsync(forumBoards, [])

  const [topic, setTopic] = useState<ForumTopic | null>(null)
  const [replies, setReplies] = useState<ForumReply[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [answering, setAnswering] = useState<ForumReply | null>(null)

  const staff = !!(profile?.is_admin || profile?.is_moderator)
  const mine = topic?.author_id === profile?.id

  const load = useMemo(() => async () => {
    const [one, said] = await Promise.all([getTopic(number), forumReplies(number)])
    setTopic(one)
    setReplies(said)
    setLoading(false)
  }, [number])

  useEffect(() => {
    if (!Number.isFinite(number)) return
    setLoading(true)
    load()
    /*
     * Counted after the page has asked for the thread rather than before:
     * a view is "somebody read this", and a count that moves on a request
     * that then finds nothing is a number counting nothing.
     */
    forumSeen(number).catch(() => null)
  }, [number, load])

  const send = async (body: string, images: string[]) => {
    setSending(true)
    try {
      await forumReply({ topic: number, body, images, replyTo: answering?.id ?? null })
      setAnswering(null)
      await load()
    } catch (wrong) {
      toast(wrong instanceof Error ? wrong.message : 'That did not post.', 'error')
    } finally {
      setSending(false)
    }
  }

  const press = async (what: 'topic' | 'post', which: number) => {
    try {
      const on = await forumLike(what, which)
      if (what === 'topic') {
        setTopic((had) => had && { ...had, liked: on, like_count: had.like_count + (on ? 1 : -1) })
      } else {
        setReplies((had) => had.map((one) => one.id === which
          ? { ...one, liked: on, like_count: one.like_count + (on ? 1 : -1) }
          : one))
      }
    } catch (wrong) {
      toast(wrong instanceof Error ? wrong.message : 'That did not go through.', 'error')
    }
  }

  const mark = async (status: ForumStatus) => {
    try {
      await forumSetStatus(number, status)
      await load()
    } catch (wrong) {
      toast(wrong instanceof Error ? wrong.message : 'That mark did not stick.', 'error')
    }
  }

  if (loading) {
    return (
      <ForumShell boards={boards.data ?? []} loading={boards.loading}>
        <Skeleton className="h-9 w-2/3 rounded-xl" />
        <Skeleton className="mt-6 h-44 rounded-2xl" />
      </ForumShell>
    )
  }

  if (!topic) {
    return (
      <ForumShell boards={boards.data ?? []} loading={boards.loading}>
        <div className="rounded-2xl border border-white/10 py-16">
          <EmptyState
            title="That topic is not here."
            body="It may have been taken down, or it may never have existed."
            action={<Button to="/forum" variant="subtle">Back to the forum</Button>}
          />
        </div>
      </ForumShell>
    )
  }

  /* Which marks staff may put on this one. The server refuses the rest. */
  const ladder: ForumStatus[] = topic.category_kind === 'bugs'
    ? ['solved']
    : topic.category_kind === 'suggestions'
      ? ['approved', 'declined', 'looked-at']
      : topic.category_kind === 'both'
        ? ['solved', 'approved', 'declined', 'looked-at']
        : []

  return (
    <ForumShell boards={boards.data ?? []} loading={boards.loading}>
      {/*
       * Capped, unlike a board. A board is a list to scan and wants every
       * pixel; a thread is prose, and a line of text a thousand pixels wide
       * is one the eye loses its place in on the way back.
       */}
      <div className="max-w-4xl">
      <header className="border-b border-white/[0.07] pb-5">
        <nav className="flex items-center gap-2 text-xs font-bold text-white/35">
          <Link to="/forum" className="transition-colors hover:text-brand-bright">Forum</Link>
          <span aria-hidden="true">/</span>
          <Link
            to={`/forum/c/${topic.category}`}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-brand-bright"
          >
            <span className={cn('h-2 w-2 rounded-sm', BOARD_COLOUR[topic.category] ?? 'bg-white/30')} />
            {topic.category_name}
          </Link>
        </nav>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[clamp(1.4rem,2.6vw,2rem)] font-extrabold leading-tight tracking-tight">
            {topic.title}
          </h1>
          <Flags pinned={topic.is_pinned} locked={topic.is_locked} />
          <StatusPill status={topic.status} by={topic.status_by_name} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Byline person={topic} when={topic.created_at} edited={topic.edited_at} large />
          <span className="flex items-center gap-4 text-xs font-bold tabular-nums text-white/35">
            <span>{formatCount(topic.view_count)} views</span>
            <span>{formatCount(topic.reply_count)} replies</span>
          </span>
        </div>
      </header>

      <article className="border-b border-white/[0.07] py-6">
        <PostBody body={topic.body} />
        <Attachments images={topic.images} />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Helpful
            on={topic.liked}
            count={topic.like_count}
            disabled={!profile}
            onPress={() => press('topic', topic.id)}
          />
          {(mine || staff) && (
            <Button
              size="sm"
              variant="ghost"
              icon={faXmark}
              onClick={async () => {
                await forumRemove('topic', topic.id)
                navigate(`/forum/c/${topic.category}`)
              }}
            >
              Take it down
            </Button>
          )}
          {staff && (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={faThumbtack}
                onClick={() => forumSetFlags(topic.id, { pinned: !topic.is_pinned }).then(load)}
              >
                {topic.is_pinned ? 'Unpin' : 'Pin'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={faLock}
                onClick={() => forumSetFlags(topic.id, { locked: !topic.is_locked }).then(load)}
              >
                {topic.is_locked ? 'Open it' : 'Close it'}
              </Button>
              {ladder.map((word) => (
                <Button
                  key={word}
                  size="sm"
                  variant={topic.status === word ? 'primary' : 'subtle'}
                  icon={topic.status === word ? faCheck : undefined}
                  onClick={() => mark(topic.status === word ? 'open' : word)}
                >
                  {word === 'looked-at' ? 'Been looked at' : word[0].toUpperCase() + word.slice(1)}
                </Button>
              ))}
            </span>
          )}
        </div>
      </article>

      <section className="py-6">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
          {replies.length ? `${formatCount(replies.length)} replies` : 'No replies yet'}
        </p>

        <ul className="mt-5 space-y-3">
          {replies.map((reply) => (
            <li key={reply.id}>
              <Reply
                reply={reply}
                canMark={(mine || staff) && !reply.is_answer}
                canUnmark={(mine || staff) && reply.is_answer}
                mine={reply.author_id === profile?.id}
                staff={staff}
                signedIn={!!profile}
                onLike={() => press('post', reply.id)}
                onAnswer={() => forumMarkAnswer(reply.id).then(load)}
                onRemove={() => forumRemove('post', reply.id).then(load)}
                onReply={() => setAnswering(reply)}
              />
            </li>
          ))}
        </ul>

        <div className="mt-6" id="reply">
          {topic.is_locked && !staff ? (
            <p className="rounded-2xl border border-white/10 bg-ink-card/60 p-5 text-center text-sm text-white/50">
              This topic is closed to replies.
            </p>
          ) : (
            <>
              {answering && (
                <p className="mb-2 flex items-center gap-2 text-sm text-white/50">
                  Replying to {answering.author_name}
                  <button
                    type="button"
                    onClick={() => setAnswering(null)}
                    className="font-bold text-brand-bright hover:text-white"
                  >
                    cancel
                  </button>
                </p>
              )}
              <Composer
                placeholder="Say something useful."
                action="Reply"
                busy={sending}
                onSend={send}
              />
            </>
          )}
        </div>
      </section>
      </div>
    </ForumShell>
  )
}

function Reply({
  reply, canMark, canUnmark, mine, staff, signedIn, onLike, onAnswer, onRemove, onReply,
}: {
  reply: ForumReply
  canMark: boolean
  canUnmark: boolean
  mine: boolean
  staff: boolean
  signedIn: boolean
  onLike: () => void
  onAnswer: () => void
  onRemove: () => void
  onReply: () => void
}) {
  if (reply.is_removed) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-5 py-4 text-sm text-white/30">
        This reply was taken down.
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-2xl border p-5',
      reply.is_answer ? 'border-space/50 bg-space/[0.07]' : 'border-white/10 bg-ink-card/40',
    )}>
      {reply.is_answer && (
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-space-bright">
          <Glyph icon={faCheck} />
          The answer
        </p>
      )}

      <Byline person={reply} when={reply.created_at} edited={reply.edited_at} />

      {reply.reply_to_name && (
        <p className="mt-3 text-xs font-bold text-white/30">Replying to {reply.reply_to_name}</p>
      )}

      <div className="mt-3">
        <PostBody body={reply.body} />
        <Attachments images={reply.images} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3">
        <Helpful on={reply.liked} count={reply.like_count} disabled={!signedIn} onPress={onLike} />
        {signedIn && (
          <Button size="sm" variant="ghost" icon={faComment} onClick={onReply}>Reply</Button>
        )}
        {(canMark || canUnmark) && (
          <Button
            size="sm"
            variant={canUnmark ? 'subtle' : 'ghost'}
            icon={faCheck}
            onClick={onAnswer}
          >
            {canUnmark ? 'Not the answer' : 'This is the answer'}
          </Button>
        )}
        {(mine || staff) && (
          <Button size="sm" variant="ghost" icon={faXmark} onClick={onRemove}>Take it down</Button>
        )}
      </div>
    </div>
  )
}

/* --------------------------------------------------------- a new topic */

export function ForumNew() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useAuth()
  const boards = useAsync(forumBoards, [])
  const [category, setCategory] = useState(params.get('category') ?? '')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const staff = !!(profile?.is_admin || profile?.is_moderator)
  const open = (boards.data ?? []).filter((one) => !one.staff_only || staff)

  useEffect(() => {
    if (!category && open.length) setCategory(open[0].slug)
  }, [category, open])

  const post = async (body: string, images: string[]) => {
    setBusy(true)
    try {
      const made = await forumCreateTopic({ category, title: title.trim(), body, images })
      navigate(`/forum/t/${made}`)
    } catch (wrong) {
      toast(wrong instanceof Error ? wrong.message : 'That did not post.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ForumShell boards={boards.data ?? []} loading={boards.loading}>
      <header className="border-b border-white/[0.07] pb-5">
        <nav className="flex items-center gap-2 text-xs font-bold text-white/35">
          <Link to="/forum" className="transition-colors hover:text-brand-bright">Forum</Link>
          <span aria-hidden="true">/</span>
          <span className="text-white/60">New topic</span>
        </nav>
        <h1 className="mt-3 flex items-center gap-3 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          <Glyph icon={faLayerGroup} className="text-xl text-brand-bright" />
          Start a topic
        </h1>
      </header>

      <div className="max-w-3xl py-6">
        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
          Category
        </p>
        <div className="flex flex-wrap gap-2">
          {open.map((board) => (
            <button
              key={board.slug}
              type="button"
              onClick={() => setCategory(board.slug)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-extrabold transition-colors',
                category === board.slug
                  ? 'border-brand-bright bg-brand/15 text-white'
                  : 'border-white/10 text-white/50 hover:text-white',
              )}
            >
              <span className={cn('h-2 w-2 rounded-sm', BOARD_COLOUR[board.slug] ?? 'bg-white/30')} />
              {board.name}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <Composer
            placeholder="Everything you know about it. Screenshots help."
            action="Post it"
            withTitle={{ value: title, onChange: setTitle }}
            busy={busy}
            autoFocus
            onSend={post}
            onCancel={() => navigate('/forum')}
          />
        </div>

        <p className="mt-5 text-xs leading-relaxed text-white/30">
          Everything posted here is screened, and the Community Guidelines apply
          to it exactly as they do everywhere else on Kobblon.
        </p>
      </div>
    </ForumShell>
  )
}
