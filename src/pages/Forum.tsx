import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Glyph } from '@/components/brand/Glyph'
import {
  faComment, faEye, faLock, faPlus, faThumbsUp, faThumbtack,
  faCheck, faClockRotateLeft, faLayerGroup, faChevronLeft, faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { ReportDialog } from '@/components/social/ReportDialog'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import {
  ForumShell, BoardMark, BoardStrip, ForumSearchBox, BOARD_COLOUR,
} from '@/components/forum/Shell'
import { TopicRow } from '@/components/forum/TopicRow'
import { Composer } from '@/components/forum/Composer'
import { PostMenu } from '@/components/forum/PostMenu'
import { ReadingRail, RelatedTopics, SignedOutNote } from '@/components/forum/Reading'
import {
  Attachments, Byline, Flags, Helpful, PostBody, StatusPill, STATUS_WORDS,
} from '@/components/forum/Pieces'
import {
  forumBoards, forumCreateTopic, forumEdit, forumLike, forumMarkAnswer, forumRelated,
  forumBoardStaff, forumBoardsIMind, forumRemove, forumSearchCount, forumTopicsCount, forumReplies, forumReply, forumSearch, forumSeen,
  forumSetFlags, forumSetStatus, forumTopic as getTopic, forumTopics,
} from '@/lib/api'
import { formatCount, forumViews, timeAgo } from '@/lib/format'
import { useAtTitle, useExactTitle } from '@/hooks/useTitle'
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

/*
 * Staw: "I want it to be 'Community Forum | At Kobblon' then 'Post Name |
 * Kobblon Forum'". So the front of the forum names the family it belongs
 * to, and everything inside it names the forum - a thread is a page of the
 * forum, not a page about Kobblon, and "Kobblon Forum" is what somebody
 * reading a pasted tab title needs to see.
 */
const FORUM = 'Kobblon Forum'

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

  useAtTitle('Community Forum')

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
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Community Forum
        </h1>
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
              note={(t) => `${forumViews(t.view_count)} views`}
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
function TopicTable({ topics, loading, showCategory, empty, found }: {
  topics: ForumTopic[]
  loading: boolean
  showCategory?: boolean
  empty?: { title: string; body: string; action?: React.ReactNode }
  /** What was searched for, when this is a page of results. */
  found?: string
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
          <TopicRow key={topic.id} topic={topic} showCategory={showCategory} found={found} />
        ))}
      </ul>
    </div>
  )
}

/* --------------------------------------------------------------- paging */

/** How many topics a page of a board or a search is. */
const PER_PAGE = 25

/**
 * Older, newer, and which page of how many.
 *
 * It asks for one row more than it shows, and that row's existence is what
 * "there is more" means - the count is a separate question and a separate
 * round trip, so the buttons are right even on a page that has not been
 * counted yet rather than waiting for it.
 *
 * The count itself is 0290's `forum_topics_count` and `forum_search_count`.
 * It is still not a row of numbered page buttons: twenty-six pages of
 * buttons is a worse thing to put under a board than two words, and
 * nobody has ever wanted page nineteen of a forum specifically.
 */
function Pager({ page, more, howMany, onGo }: {
  page: number
  /** Whether a further page exists, which is one row past the end. */
  more: boolean
  /**
   * How many there are in all, when something counted them. 0290 added the
   * two functions that do; until they are applied this is undefined and
   * the pager says "Page 3" rather than "Page 3 of 9", which is what it
   * said before and is still true.
   */
  howMany?: number
  onGo: (page: number) => void
}) {
  if (page === 0 && !more) return null

  const pages = typeof howMany === 'number' && howMany > 0
    ? Math.ceil(howMany / PER_PAGE)
    : null

  return (
    <nav className="mt-5 flex items-center justify-between gap-3">
      <Button
        size="sm"
        variant="subtle"
        icon={faChevronLeft}
        disabled={page === 0}
        onClick={() => onGo(page - 1)}
      >
        Newer
      </Button>
      <span className="text-xs font-extrabold tabular-nums text-white/35">
        Page {page + 1}{pages ? ` of ${pages}` : ''}
      </span>
      <Button
        size="sm"
        variant="subtle"
        disabled={!more}
        onClick={() => onGo(page + 1)}
      >
        Older
        <Glyph icon={faChevronRight} className="ml-1.5 text-xs" />
      </Button>
    </nav>
  )
}

/** The page number in the address, counted from one and never below it. */
function pageOf(params: URLSearchParams): number {
  const asked = Number(params.get('page') ?? '1')
  return Number.isFinite(asked) && asked > 1 ? Math.floor(asked) - 1 : 0
}

/* -------------------------------------------------------------- a search */

/**
 * What a search found.
 *
 * The same `TopicTable` a board is, with the category shown: a result is
 * read for where it is as much as for what it says.
 */
export function ForumSearch() {
  const [params, setParams] = useSearchParams()
  const terms = params.get('q') ?? ''
  const inBoard = params.get('in')
  const page = pageOf(params)

  const boards = useAsync(forumBoards, [])
  const howMany = useAsync(
    () => forumSearchCount(terms, inBoard),
    [terms, inBoard],
  )
  const found = useAsync(
    () => forumSearch({
      terms,
      category: inBoard,
      limit: PER_PAGE + 1,
      offset: page * PER_PAGE,
    }),
    [terms, inBoard, page],
  )

  useExactTitle(terms ? `${terms} | ${FORUM}` : FORUM)

  const rows = found.data ?? []
  const shown = rows.slice(0, PER_PAGE)
  const board = (boards.data ?? []).find((one) => one.slug === inBoard)

  const where = (slug: string | null) => {
    if (slug) params.set('in', slug)
    else params.delete('in')
    params.delete('page')
    setParams(params, { replace: true })
  }

  return (
    <ForumShell boards={boards.data ?? []} loading={boards.loading}>
      <header className="border-b border-white/[0.07] pb-5">
        <nav className="flex items-center gap-2 text-xs font-bold text-white/35">
          <Link to="/forum" className="transition-colors hover:text-brand-bright">Forum</Link>
          <span aria-hidden="true">/</span>
          <span className="text-white/60">Search</span>
        </nav>
        <h1 className="mt-3 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
          {terms ? <>Topics matching “{terms}”</> : 'Search the forum'}
        </h1>
        <ForumSearchBox className="mt-4 max-w-xl lg:hidden" />
        {!!terms && (
          <p className="mt-2 text-sm text-white/45">
            {found.loading
              ? 'Looking.'
              : `${formatCount(howMany.data ?? shown.length)} ${
                (howMany.data ?? shown.length) === 1 ? 'topic' : 'topics'
              }${board ? ` in ${board.name}` : ''}.`}
          </p>
        )}
      </header>

      {/*
       * Narrowing to a board, rather than a second search field for it.
       * Everywhere is first and is the one somebody arrives on.
       */}
      <div className="flex flex-wrap items-center gap-1 py-5">
        <Switch on={!inBoard} onPress={() => where(null)}>Everywhere</Switch>
        {(boards.data ?? []).map((one) => (
          <Switch key={one.slug} on={inBoard === one.slug} onPress={() => where(one.slug)}>
            {one.name}
          </Switch>
        ))}
      </div>

      {terms ? (
        <>
          <TopicTable
            topics={shown}
            loading={found.loading}
            showCategory={!inBoard}
            found={terms}
            empty={{
              title: 'Nothing matched that.',
              body: 'Search matches whole words rather than parts of them, so a shorter word often finds more. Try one of the words you would expect in the title.',
              action: <Button to="/forum" variant="subtle">Back to the forum</Button>,
            }}
          />
          <Pager
            page={page}
            more={rows.length > PER_PAGE}
            howMany={howMany.data ?? undefined}
            onGo={(next) => {
              if (next === 0) params.delete('page')
              else params.set('page', String(next + 1))
              setParams(params)
              window.scrollTo({ top: 0 })
            }}
          />
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 py-14">
          <EmptyState
            title="What are you looking for?"
            body="Type it into the box. It reads titles and the first post of every topic, and the title counts for more."
          />
        </div>
      )}
    </ForumShell>
  )
}

/* -------------------------------------------------- the boards you mind */

/**
 * What a board's own staff are responsible for.
 *
 * 0289 hands somebody a board and the powers on it. Until this page, the
 * only way to see what you had been given was to open a topic there and
 * notice the buttons - so this says it plainly, and says just as plainly
 * what it is not, because "staff on the forum" is a thing somebody could
 * reasonably believe it made them.
 *
 * Signed out, or in charge of nothing, it says so rather than showing an
 * empty frame.
 */
export function ForumMine() {
  const { profile } = useAuth()
  const boards = useAsync(forumBoards, [])
  const mine = useAsync(
    () => (profile ? forumBoardsIMind() : Promise.resolve([])),
    [profile?.id],
  )

  useAtTitle('Boards you mind')

  const rows = mine.data ?? []
  const full = (slug: string) => (boards.data ?? []).find((one) => one.slug === slug)

  return (
    <ForumShell boards={boards.data ?? []} loading={boards.loading}>
      <header className="border-b border-white/[0.07] pb-5">
        <nav className="flex items-center gap-2 text-xs font-bold text-white/35">
          <Link to="/forum" className="transition-colors hover:text-brand-bright">Forum</Link>
          <span aria-hidden="true">/</span>
          <span className="text-white/60">Boards you mind</span>
        </nav>
        <h1 className="mt-3 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
          Boards you mind
        </h1>
        <p className="mt-1 text-sm text-white/45">
          A board of your own to look after, handed to you by a Kobblon admin.
        </p>
      </header>

      {mine.loading ? (
        <div className="space-y-px pt-5">
          {[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : !rows.length ? (
        <div className="mt-5 rounded-2xl border border-white/10 py-14">
          <EmptyState
            title={profile ? 'You do not look after a board.' : 'Log in to see this.'}
            body={profile
              ? 'A Kobblon admin puts somebody in charge of a board. There is no way to ask for one here, and nothing you can do on the forum earns it.'
              : 'This page lists the boards you look after, if you look after any.'}
            action={profile
              ? <Button to="/forum" variant="subtle">Back to the forum</Button>
              : <Button to="/login" variant="yes">Log in</Button>}
          />
        </div>
      ) : (
        <div className="pt-5">
          <ul className="space-y-3">
            {rows.map((one) => {
              const board = full(one.category)
              return (
                <li key={one.category}>
                  <Link
                    to={`/forum/c/${one.category}`}
                    className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-ink-card/40 p-4 transition-colors hover:border-white/20"
                  >
                    <span className={cn(
                      'h-12 w-1.5 shrink-0 rounded-full',
                      BOARD_COLOUR[one.category] ?? 'bg-white/30',
                    )} />
                    <BoardMark slug={one.category} className="h-10 w-10 text-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-extrabold text-white transition-colors group-hover:text-brand-bright">
                        {one.name}
                      </span>
                      <span className="mt-0.5 block text-sm text-white/45">
                        {board?.blurb ?? 'A board you look after.'}
                      </span>
                    </span>
                    {!!board && (
                      <span className="hidden shrink-0 text-xs font-extrabold tabular-nums text-white/35 sm:block">
                        {formatCount(board.topic_count)} topics
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/*
           * What it is, and what it is not, in the same card. The second
           * half is the important half: somebody who thinks a board key is
           * a staff rank will try to use it as one and be refused, and
           * being refused by a site is how people learn to distrust it.
           */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-space/30 bg-space/[0.06] p-5">
              <h2 className="flex items-center gap-2 font-display text-sm font-extrabold text-space-bright">
                <Glyph icon={faCheck} />
                On {rows.length === 1 ? 'that board' : 'those boards'} you can
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm text-white/60">
                <li>Pin a topic, and close one to replies.</li>
                <li>Mark one solved, looked at, approved or declined.</li>
                <li>Mark the reply that answered it.</li>
                <li>Take down a topic or a reply that should not be there.</li>
                <li>Reply in a topic you have closed.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-white/10 bg-ink-card/40 p-5">
              <h2 className="flex items-center gap-2 font-display text-sm font-extrabold text-white/70">
                <Glyph icon={faLock} />
                What this is not
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm text-white/45">
                <li>It is not Kobblon staff. It is one board, and nothing outside it.</li>
                <li>
                  It gives you nothing over anybody&apos;s account: no warnings, no
                  suspensions, nothing on their standing.
                </li>
                <li>You cannot edit what somebody wrote. Nobody can; only they can.</li>
                <li>You cannot put anybody else in charge of a board.</li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </ForumShell>
  )
}

/* ------------------------------------------------------------- a board */

export function ForumCategory() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const sort = (params.get('sort') as ForumSort) || 'active'
  const unanswered = params.get('unanswered') === '1'
  const page = pageOf(params)

  const boards = useAsync(forumBoards, [])
  /*
   * One row past the page, which is how "Older" knows it has somewhere to
   * go. `forum_topics_list` caps a request at fifty, so a page of
   * twenty-five and its sentinel is comfortably inside that.
   */
  const rows = useAsync(
    () => forumTopics({
      category: slug, sort, unanswered,
      limit: PER_PAGE + 1,
      offset: page * PER_PAGE,
    }),
    [slug, sort, unanswered, page],
  )
  const topics = { data: (rows.data ?? []).slice(0, PER_PAGE), loading: rows.loading }
  const more = (rows.data ?? []).length > PER_PAGE
  const howMany = useAsync(
    () => forumTopicsCount({ category: slug, unanswered }),
    [slug, unanswered],
  )
  /* Who looks after this board, which 0289 makes a public fact. */
  const minders = useAsync(() => forumBoardStaff(slug), [slug])
  const board = (boards.data ?? []).find((one) => one.slug === slug)
  useExactTitle(board ? `${board.name} | ${FORUM}` : FORUM)

  return (
    <ForumShell boards={boards.data ?? []} loading={boards.loading}>
      <header className="border-b border-white/[0.07] pb-5">
        <nav className="flex items-center gap-2 text-xs font-bold text-white/35">
          <Link to="/forum" className="transition-colors hover:text-brand-bright">Forum</Link>
          <span aria-hidden="true">/</span>
          <span className="text-white/60">{board?.name ?? '…'}</span>
        </nav>

        {/*
         * Staw, with a photograph of it: on a phone the name wrapped into
         * three words a column wide with the green button sitting on top of
         * them.
         *
         * `flex-wrap` was there and did nothing, because the text column
         * carried `flex-1 min-w-0` - which says "give up all your width
         * before anything else moves", so the button never had to wrap and
         * the title was squeezed into a strip narrower than the word
         * "suggestions" is. It then overflowed that strip sideways, under
         * the button, which is what was covering it.
         *
         * So the stripe, the mark and the name are one piece that takes the
         * whole row on a phone, and the button goes underneath until there
         * is room beside it.
         */}
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex min-w-0 basis-full items-center gap-4 sm:flex-1 sm:basis-auto">
            <span className={cn('h-10 w-1.5 shrink-0 rounded-full', BOARD_COLOUR[slug] ?? 'bg-white/30')} />
            <BoardMark slug={slug} className="h-10 w-10 text-lg" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-extrabold tracking-tight sm:text-3xl">
                {board?.name ?? 'Loading'}
              </h1>
              {board && <p className="mt-1 text-sm text-white/45">{board.blurb}</p>}
            </div>
          </div>
          <Button
            to={`/forum/new?category=${slug}`}
            variant="yes"
            icon={faPlus}
            className="w-full sm:w-auto"
          >
            Start a topic
          </Button>
        </div>

        {/*
         * Who looks after this board, when somebody does.
         *
         * 0289 gives a board its own staff, and the people posting here
         * ought to know who is answerable for a topic being closed. It is
         * not drawn when the list is empty rather than saying "nobody
         * looks after this board", which reads as a warning about the
         * board and is not what an empty list means.
         */}
        {!!(minders.data ?? []).length && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/35">
              Looked after by
            </span>
            {(minders.data ?? []).map((one) => (
              <Link
                key={one.user_id}
                to={`/forum/u/${one.username}`}
                className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-ink-card/60 py-1 pl-1 pr-2.5 transition-colors hover:border-white/20"
              >
                <Avatar src={one.avatar_url} name={one.display_name} size="sm" />
                <span className="text-xs font-extrabold text-white/70 transition-colors group-hover:text-white">
                  {one.display_name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3 py-5">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-ink-card/60 p-1">
          {SORTS.map((one) => (
            <Switch
              key={one.id}
              on={sort === one.id}
              onPress={() => {
                params.set('sort', one.id)
                /* A page number from the old sort means nothing under the new one. */
                params.delete('page')
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
            params.delete('page')
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
        topics={topics.data}
        loading={topics.loading}
        empty={{
          title: page > 0
            ? 'That is the end of this board.'
            : unanswered ? 'Everything here has an answer.' : 'Nothing here yet.',
          body: page > 0
            ? 'There is nothing further back than this.'
            : unanswered
              ? 'Which is either very good news or a very quiet board.'
              : 'Be the first to put something in this category.',
          action: (
            <Button to={`/forum/new?category=${slug}`} variant="yes" icon={faPlus}>
              Start a topic
            </Button>
          ),
        }}
      />

      <Pager
        page={page}
        more={more}
        howMany={howMany.data ?? undefined}
        onGo={(next) => {
          if (next === 0) params.delete('page')
          else params.set('page', String(next + 1))
          setParams(params)
          window.scrollTo({ top: 0 })
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
  /*
   * What is being reported, or null. One piece of state for the whole page
   * rather than one dialog per reply: twenty replies is twenty mounted
   * dialogs, nineteen of which exist to be closed.
   */
  const [flagging, setFlagging] = useState<
    { type: 'forum_topic' | 'forum_post'; id: number; name: string } | null
  >(null)
  /*
   * What is open in the editor, or null. The whole page again rather than
   * per post, for the same reason: one thing is edited at a time, and a
   * composer mounted under every reply is twenty composers.
   */
  const [editing, setEditing] = useState<{ what: 'topic' | 'post'; id: number } | null>(null)
  const [saving, setSaving] = useState(false)
  /* What the rail measures. The posts, and not the page they are on. */
  const thread = useRef<HTMLDivElement>(null)
  /*
   * A quote on its way into the reply box, and a counter saying it is a
   * new one. The counter is the whole point: quoting the same post twice
   * is the same string, and an effect watching the string would fire once
   * and never again.
   */
  const [quoted, setQuoted] = useState<{ text: string; at: number } | null>(null)

  /*
   * Which boards this account looks after, if any. 0289: a board can have
   * its own staff, who are staff on that board and nowhere else.
   *
   * Asked here and compared against *this* topic's category at the moment
   * of use, rather than reduced to one `canModerate` boolean when the page
   * mounts - the topic is not loaded yet when it mounts, so a boolean
   * worked out then would be worked out against nothing, which is the trap
   * this project keeps falling into, and it would read as "the buttons are
   * missing" rather than as an error.
   */
  const minded = useAsync(
    () => (profile ? forumBoardsIMind() : Promise.resolve([])),
    [profile?.id],
  )

  /*
   * What the page draws. It decides nothing: `forum_can_moderate` in the
   * database decides what actually happens, and this only decides whether
   * a control is offered - the two agree deliberately, so that nobody is
   * shown a button that will be refused.
   */
  const platform = !!(profile?.is_admin || profile?.is_moderator)
  const staff = platform || (
    !!topic && (minded.data ?? []).some((one) => one.category === topic.category)
  )
  const mine = topic?.author_id === profile?.id
  useExactTitle(topic ? `${topic.title} | ${FORUM}` : FORUM)

  const load = useMemo(() => async () => {
    const [one, said] = await Promise.all([getTopic(number), forumReplies(number)])
    setTopic(one)
    setReplies(said)
    setLoading(false)
  }, [number])

  const related = useAsync(
    () => (Number.isFinite(number) ? forumRelated(number) : Promise.resolve([])),
    [number],
  )

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
      /* Thrown on so the composer keeps what was written. */
      throw wrong
    } finally {
      setSending(false)
    }
  }

  /*
   * Saving an edit. The whole thread is read back rather than the one row
   * being patched in place: the censor runs on the way in, so what is
   * stored is not always what was typed, and showing the typed version
   * would be the page disagreeing with the database until the next load.
   */
  const save = async (body: string) => {
    if (!editing) return
    setSaving(true)
    try {
      await forumEdit(editing.what, editing.id, body)
      setEditing(null)
      await load()
    } catch (wrong) {
      toast(wrong instanceof Error ? wrong.message : 'That edit did not save.', 'error')
      throw wrong
    } finally {
      setSaving(false)
    }
  }

  const take = async (what: 'topic' | 'post', which: number) => {
    try {
      await forumRemove(what, which)
      if (what === 'topic') navigate(`/forum/c/${topic?.category ?? ''}`)
      else await load()
    } catch (wrong) {
      toast(wrong instanceof Error ? wrong.message : 'That did not come down.', 'error')
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

  /*
   * Quoting somebody.
   *
   * `>` is what `Markup` already renders as a blockquote and what the
   * composer's own Quote mark already writes, so this is the same thing a
   * person would have typed - not a second mechanism that needs its own
   * renderer. Four lines at most and then an ellipsis: a quote of a
   * fourteen-paragraph post is the post again, twice on one page.
   *
   * The attribution is a plain line rather than a link, because a link to
   * the post inside a quote of the post is a loop a reader can follow by
   * accident. The post itself is right there above it.
   */
  const quote = (who: string, body: string, within: string) => {
    /*
     * What they have highlighted inside that post, if anything. Quoting
     * one sentence out of a long answer is most of what quoting is for,
     * and a Quote button that always takes the whole post makes somebody
     * paste it and delete the rest by hand.
     *
     * Asked at the moment of pressing rather than watched: a selection is
     * gone the instant something else is clicked, and the menu this is
     * pressed in does not take it - the menu's own button is not a text
     * node, so the highlight survives opening it.
     */
    const picked = selectionIn(within)
    const most = picked ? 12 : 4
    const lines = (picked ?? body).trim().split('\n')
    const kept = lines.slice(0, most)
    if (lines.length > most) kept.push('…')
    const said = kept.map((line) => `> ${line}`.trimEnd()).join('\n')
    setQuoted((had) => ({
      text: `**${who}** said:\n${said}\n`,
      at: (had?.at ?? 0) + 1,
    }))
    /* The box is at the bottom of a long thread; take them to it. */
    if (typeof document !== 'undefined') {
      document.getElementById('reply')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

  /*
   * Which marks staff may put on this one, in the two pairs they are.
   *
   * Staw: "the tags be either solved/been looked at, either
   * declined/approved". They were four loose buttons in a row, which said
   * nothing about the fact that there are only ever two answers here: what
   * happened to the thing reported, and what was decided about the thing
   * suggested. Each pair is drawn as one joined control, so the either/or
   * is visible without a word of explanation.
   *
   * A pair whose other half the board does not allow is still drawn as a
   * pair of one rather than folded back into the row - a suggestions board
   * can acknowledge and cannot solve, and "Been looked at" sitting on its
   * own in the first group is a truer picture of that than it would be
   * standing beside Declined.
   *
   * The server refuses anything this offers wrongly, which is the part that
   * matters: this list decides what is drawn, 0285 decides what is allowed.
   */
  type Mark = Exclude<ForumStatus, 'open'>
  const kind = topic.category_kind
  const allowed = (word: Mark) =>
    word === 'solved'
      ? kind === 'bugs' || kind === 'both'
      : word === 'looked-at'
        ? kind === 'bugs' || kind === 'suggestions' || kind === 'both'
        : kind === 'suggestions' || kind === 'both'

  const pairs: Mark[][] = [
    (['solved', 'looked-at'] as Mark[]).filter(allowed),
    (['approved', 'declined'] as Mark[]).filter(allowed),
  ].filter((pair) => pair.length > 0)

  return (
    <ForumShell boards={boards.data ?? []} loading={boards.loading}>
      {/*
       * Capped, unlike a board. A board is a list to scan and wants every
       * pixel; a thread is prose, and a line of text a thousand pixels wide
       * is one the eye loses its place in on the way back.
       */}
      <div className="flex gap-8">
      <div className="min-w-0 max-w-4xl flex-1">
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
          <Byline person={topic} when={topic.created_at} edited={topic.edited_at} large op />
          <span className="flex items-center gap-4 text-xs font-bold tabular-nums text-white/35">
            <span>{forumViews(topic.view_count)} views</span>
            <span>{formatCount(topic.reply_count)} replies</span>
          </span>
          <span className="ml-auto">
            <PostMenu
              link={postLink(topic.id)}
              canEdit={mine}
              canRemove={mine || staff}
              canReport={!!profile && !mine}
              canQuote={!!profile && (!topic.is_locked || staff)}
              onQuote={() => quote(topic.author_name, topic.body, 'post-topic')}
              onEdit={() => setEditing({ what: 'topic', id: topic.id })}
              onRemove={() => void take('topic', topic.id)}
              onReport={() => setFlagging({
                type: 'forum_topic', id: topic.id, name: topic.title,
              })}
            />
          </span>
        </div>
      </header>

      <div ref={thread}>
      <article id="post-topic" className="border-b border-white/[0.07] py-6">
        {editing?.what === 'topic' ? (
          <Composer
            key={`edit-topic-${topic.id}`}
            placeholder="Say it again, better."
            action="Save"
            busy={saving}
            initial={topic.body}
            keepOnSend
            autoFocus
            onSend={(body) => save(body)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            <PostBody body={topic.body} />
            <Attachments images={topic.images} />
          </>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Helpful
            on={topic.liked}
            count={topic.like_count}
            disabled={!profile}
            onPress={() => press('topic', topic.id)}
          />
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
              {pairs.map((pair) => (
                <span
                  key={pair.join('-')}
                  className="inline-flex overflow-hidden rounded-xl border border-white/10 divide-x divide-white/10"
                >
                  {pair.map((word) => {
                    const on = topic.status === word
                    return (
                      <button
                        key={word}
                        type="button"
                        aria-pressed={on}
                        title={on ? 'Take this mark off' : undefined}
                        onClick={() => mark(on ? 'open' : word)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold transition-colors',
                          on
                            ? 'bg-brand text-white'
                            : 'bg-white/[0.04] text-white/55 hover:bg-white/[0.09] hover:text-white',
                        )}
                      >
                        {on && <Glyph icon={faCheck} className="text-[10px]" />}
                        {STATUS_WORDS[word]}
                      </button>
                    )
                  })}
                </span>
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
                op={reply.author_id === topic.author_id}
                staff={staff}
                signedIn={!!profile}
                link={postLink(topic.id, reply.id)}
                editing={editing?.what === 'post' && editing.id === reply.id}
                saving={saving}
                onLike={() => press('post', reply.id)}
                onAnswer={() => forumMarkAnswer(reply.id).then(load)}
                onRemove={() => void take('post', reply.id)}
                onReply={() => setAnswering(reply)}
                onQuote={() => quote(reply.author_name, reply.body, `post-${reply.id}`)}
                onEdit={() => setEditing({ what: 'post', id: reply.id })}
                onSave={save}
                onStopEditing={() => setEditing(null)}
                onFlag={() => setFlagging({
                  type: 'forum_post', id: reply.id, name: `${reply.author_name}'s reply`,
                })}
              />
            </li>
          ))}
        </ul>

      </section>
      </div>

      <section>
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
                insert={quoted}
                onSend={send}
              />
            </>
          )}
        </div>
      </section>

      {!profile && <SignedOutNote back={`/forum/t/${topic.id}`} />}

      <RelatedTopics topics={related.data ?? []} loading={related.loading} />

      <ReportDialog
        open={!!flagging}
        onClose={() => setFlagging(null)}
        targetType={flagging?.type ?? 'forum_topic'}
        targetId={String(flagging?.id ?? '')}
        targetName={flagging?.name ?? ''}
      />
      </div>

      <ReadingRail
        of={thread}
        started={topic.created_at}
        last={topic.last_post_at}
        count={replies.length + 1}
      />
      </div>
    </ForumShell>
  )
}

/**
 * What is highlighted inside one post, or null.
 *
 * Both ends of the selection have to be inside it. A selection that starts
 * in one reply and ends in another is not a quote of either, and taking
 * `toString()` of it would quote across a name, a date and a button.
 */
function selectionIn(id: string): string | null {
  if (typeof window === 'undefined') return null
  const picked = window.getSelection()
  if (!picked || picked.isCollapsed) return null

  const said = picked.toString().trim()
  if (!said) return null

  const post = document.getElementById(id)
  if (!post) return null
  if (!post.contains(picked.anchorNode) || !post.contains(picked.focusNode)) return null

  return said
}

/**
 * The address of a post, absolute, for the clipboard and for a card.
 *
 * Absolute because this is the thing somebody pastes into Discord, and a
 * path on its own pasted anywhere is not a link. Built from
 * `window.location.origin` rather than a constant, so it is right on the
 * site, on a preview build and on somebody's own machine - three places a
 * hard-coded domain is wrong in two of them.
 */
function postLink(topic: number, post?: number) {
  const where = `/forum/t/${topic}${post ? `#post-${post}` : ''}`
  if (typeof window === 'undefined') return where
  return `${window.location.origin}${where}`
}

function Reply({
  reply, canMark, canUnmark, mine, op, staff, signedIn, link, editing, saving,
  onLike, onAnswer, onRemove, onReply, onQuote, onEdit, onSave, onStopEditing, onFlag,
}: {
  reply: ForumReply
  canMark: boolean
  canUnmark: boolean
  mine: boolean
  /** Whether this is the person who opened the thread. */
  op: boolean
  staff: boolean
  signedIn: boolean
  link: string
  editing: boolean
  saving: boolean
  onLike: () => void
  onAnswer: () => void
  onRemove: () => void
  onReply: () => void
  onQuote: () => void
  onEdit: () => void
  onSave: (body: string) => Promise<void>
  onStopEditing: () => void
  onFlag: () => void
}) {
  if (reply.is_removed) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-5 py-4 text-sm text-white/30">
        This reply was taken down.
      </div>
    )
  }

  return (
    <div
      id={`post-${reply.id}`}
      className={cn(
        'scroll-mt-24 rounded-2xl border p-5',
        reply.is_answer ? 'border-space/50 bg-space/[0.07]' : 'border-white/10 bg-ink-card/40',
      )}
    >
      {reply.is_answer && (
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-space-bright">
          <Glyph icon={faCheck} />
          The answer
        </p>
      )}

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Byline person={reply} when={reply.created_at} edited={reply.edited_at} op={op} />
        </div>
        <PostMenu
          link={link}
          canEdit={mine}
          canRemove={mine || staff}
          canReport={signedIn && !mine}
          canQuote={signedIn}
          onQuote={onQuote}
          onEdit={onEdit}
          onRemove={onRemove}
          onReport={onFlag}
        />
      </div>

      {reply.reply_to_name && (
        <p className="mt-3 text-xs font-bold text-white/30">Replying to {reply.reply_to_name}</p>
      )}

      <div className="mt-3">
        {editing ? (
          <Composer
            key={`edit-post-${reply.id}`}
            placeholder="Say it again, better."
            action="Save"
            busy={saving}
            initial={reply.body}
            keepOnSend
            autoFocus
            compact
            onSend={(body) => onSave(body)}
            onCancel={onStopEditing}
          />
        ) : (
          <>
            <PostBody body={reply.body} />
            <Attachments images={reply.images} />
          </>
        )}
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
  useExactTitle(`Start a topic | ${FORUM}`)
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
