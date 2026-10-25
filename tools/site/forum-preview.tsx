/*
 * The forum's new pieces, mounted on nothing.
 *
 * This exists for the reason `tools/site/` exists: the Workspace mounts
 * our components outside the website, and a piece that needs a provider it
 * cannot supply takes a panel down over there rather than failing here.
 * It is also the only way to look at these at all from a container with no
 * route to the database - the forum pages themselves are entirely data.
 *
 * `NameMarks` is deliberately left to ask and fail: unanswered, it falls
 * back to whatever the row said, which is the path every one of these
 * bylines takes on a cold load, so it is the path worth looking at.
 */
import { useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthContext, type AuthValue } from '@/hooks/useAuth'
import { Byline } from '@/components/forum/Pieces'
import { PostMenu } from '@/components/forum/PostMenu'
import { ReadingRail, SignedOutNote, RelatedTopics, OpTag } from '@/components/forum/Reading'
import { BoardMark, ForumSearchBox } from '@/components/forum/Shell'
import { Composer } from '@/components/forum/Composer'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { STATUS_WORDS } from '@/components/forum/Pieces'
import { Lightbox } from '@/components/forum/Lightbox'
import { Marked, snippetOf } from '@/components/forum/Marked'
import { Answered, Later, ReplyingTo } from '@/components/forum/Thread'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { Glyph } from '@/components/brand/Glyph'
import { faCheck, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'
import { useState } from 'react'
import { TopicCard } from '@/components/forum/TopicCard'
import type { ForumAuthor, ForumRelated, ForumReply, ForumTopic } from '@/types/db'
import '@/index.css'

const op: ForumAuthor = {
  author_id: 'a', author_username: 'pixelhead', author_name: 'Pixelhead',
  author_avatar: null, author_is_verified: true,
  author_is_admin: false, author_is_moderator: false,
}

const staff: ForumAuthor = {
  author_id: 'b', author_username: 'staw', author_name: 'Staw',
  author_avatar: null, author_is_verified: true,
  author_is_admin: true, author_is_moderator: false,
}

const nameless: ForumAuthor = {
  author_id: 'c', author_username: 'quietone', author_name: '',
  author_avatar: null, author_is_verified: false,
  author_is_admin: false, author_is_moderator: false,
}

const when = new Date(Date.now() - 3 * 3600_000).toISOString()

const related: ForumRelated[] = [
  {
    id: 11, category: 'help-and-support', category_name: 'Help and support',
    title: 'Touch handler does not fire on a welded part',
    reply_count: 14, view_count: 2109, like_count: 6, last_post_at: when, shared: 3,
  },
  {
    id: 12, category: 'building-and-scripting', category_name: 'Building and scripting',
    title: 'How do I open a door on touch?',
    reply_count: 2, view_count: 184, like_count: 0, last_post_at: when, shared: 2,
  },
]

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-ink-card/50 p-6">
      <p className="mb-5 font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/35">
        {title}
      </p>
      {children}
    </section>
  )
}

function Page() {
  const thread = useRef<HTMLElement | null>(null)

  return (
    <div className="min-h-screen space-y-6 bg-ink p-8 text-white">
      <Row title="Bylines: op, staff, and a name that is only a username">
        <div className="space-y-5">
          <Byline person={op} when={when} large op />
          <Byline person={op} when={when} edited={when} large op />
          <Byline person={staff} when={when} />
          <Byline person={nameless} when={when} edited={when} />
        </div>
      </Row>

      <Row title="The OP tag on its own, and the six board marks">
        <div className="flex flex-wrap items-center gap-4">
          <OpTag />
          {['announcements', 'community-creations', 'feedback-and-suggestions',
            'help-and-support', 'building-and-scripting', 'off-topic'].map((slug) => (
            <BoardMark key={slug} slug={slug} />
          ))}
        </div>
      </Row>

      <Row title="The three dots, open, with Quote in it">
        <div className="flex gap-6">
          <PostMenu
            link="https://kobblon.com/forum/t/42"
            canEdit canRemove canReport canQuote
            onEdit={() => {}} onRemove={() => {}} onReport={() => {}} onQuote={() => {}}
          />
          <PostMenu
            link="https://kobblon.com/forum/t/42"
            canEdit={false} canRemove={false} canReport canQuote
            onEdit={() => {}} onRemove={() => {}} onReport={() => {}} onQuote={() => {}}
          />
        </div>
      </Row>

      <Row title="The search box, empty and typed in">
        <div className="max-w-xs space-y-4">
          <ForumSearchBox />
          <ForumSearchBox className="max-w-xs" />
        </div>
      </Row>

      <Row title="Older and newer, on the first page and in the middle">
        <div className="space-y-5">
          <Pager2 page={0} more />
          <Pager2 page={3} more />
          <Pager2 page={4} more={false} />
        </div>
      </Row>

      <Row title="A result with the searched words picked out">
        <div className="max-w-3xl space-y-3">
          <p className="font-display text-base font-extrabold text-white">
            <Marked text="How do I open a door on touch?" terms="door open" />
          </p>
          <p className="text-[13px] leading-relaxed text-white/45">
            <Marked
              text={snippetOf(
                'I have been trying all evening. The door opens once and then never '
                + 'again, and the output window says nothing at all about it. Opening '
                + 'it by hand works.',
                'door open',
              ) ?? ''}
              terms="door open"
            />
          </p>
          <p className="text-[13px] text-white/30">
            Nothing to mark, which is what a title-only match looks like:{' '}
            <Marked text="A thread about something else entirely" terms="door open" />
          </p>
        </div>
      </Row>

      <Row title="Who looks after this board">
        <Minders />
      </Row>

      <Row title="A quote landing in the reply box">
        <Quoting />
      </Row>

      <Row title="Signed out, in the middle of a thread">
        <SignedOutNote back="/forum/t/42" />
      </Row>

      <Row title="Related topics">
        <RelatedTopics topics={related} loading={false} />
        <RelatedTopics topics={[]} loading />
      </Row>

      <Row title="The two status pairs, as the staff bar draws them">
        {/*
         * Copied from the topic page's own markup rather than imported,
         * because it is written inline there against the live topic. If
         * the two ever drift, this is the one that is wrong.
         */}
        <StatusPairs />
      </Row>

      <Row title="A clip and a picture, and the viewer they open into">
        <Attachments2 />
      </Row>

      <Row title="A topic as a card: with a picture, with a clip, and with neither">
        {/*
         * The announcement cards on the forum's front and on What is
         * Kobblon. Staw: "for the thumbnails it'll just be the media
         * attached (if theres any)" - so the three cases that matter are
         * these three, and the one to actually look at is the third, where
         * the card has to close up rather than leave a gap where a picture
         * would have been.
         */}
        <div className="space-y-8">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {cards.map((topic) => (
              <TopicCard key={topic.id} topic={topic} urlOf={(p) => p} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {cards.map((topic) => (
              <TopicCard key={topic.id} topic={topic} look="glass" className="h-full" urlOf={(p) => p} />
            ))}
          </div>
        </div>
      </Row>

      <Row title="The foot of the page, and the Social column in it">
        <SiteFooter />
      </Row>

      <Row title="The rail, against a thread long enough to have one">
        {/*
         * The rail is a flex sibling of the thread, which is how the topic
         * page mounts it - `flex gap-8`, the thread `flex-1`, the rail a
         * fixed column that sticks. Mounted outside a flex row it falls
         * underneath, which is what this preview did at first and is worth
         * saying: the component was right and the page around it was not.
         */}
        <div className="flex gap-8">
        <article ref={thread} className="min-w-0 flex-1 space-y-4">
          {Array.from({ length: 14 }, (_, i) => (
            <p key={i} className="max-w-2xl text-sm leading-relaxed text-white/60">
              A paragraph of somebody's reply, long enough that the rail on the right has
              something to measure itself against. {i + 1} of fourteen.
            </p>
          ))}
        </article>
        <ReadingRail of={thread} started={when} last={when} count={14} />
        </div>
      </Row>

      <Row title="A reply in a conversation: the chip, the quoted parent, and who answered it">
        <ul className="max-w-2xl space-y-3">
          <li id="post-1" className="rounded-2xl border border-white/10 bg-ink-card/40 p-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1"><Byline person={op} when={when} /></div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              Could you add Intel Mac support at some point?
            </p>
            <Answered kids={[kid]} />
          </li>

          <Later from={new Date(Date.now() - 11 * 86_400_000).toISOString()} to={when} />

          <li id="post-2" className="rounded-2xl border border-white/10 bg-ink-card/40 p-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1"><Byline person={staff} when={when} /></div>
            </div>
            <div className="mt-3"><ReplyingTo parent={parent} name={parent.author_name} /></div>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              Working on the Linux port first, then I will have a look.
            </p>
          </li>

          <li className="rounded-2xl border border-white/10 bg-ink-card/40 p-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1"><Byline person={nameless} when={when} /></div>
            </div>
            <div className="mt-3"><ReplyingTo parent={null} name="Somebody" /></div>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              The post this answers was taken down, so the chip is only a name.
            </p>
          </li>
        </ul>
      </Row>

      <Row title="The foot of a signed-in page">
        <SiteFooter compact />
      </Row>
    </div>
  )
}

/* Three announcements: a picture, a clip, and nothing attached. */
const cards: ForumTopic[] = [
  {
    ...staff, id: 101, category: 'announcements', category_name: 'Announcements',
    title: 'The Workspace is out, and here is what it does',
    body: 'Build a World from your own machine, with the same parts the website has. '
      + 'It signs in with your Kobblon account and saves straight to your Library.',
    images: ['/brand/landing-towers.webp'], status: 'open', is_pinned: true, is_locked: false,
    is_removed: false, view_count: 8402, reply_count: 61, like_count: 214, answer_id: null,
    last_post_at: when, created_at: when, liked: false,
  },
  {
    ...staff, id: 102, category: 'announcements', category_name: 'Announcements',
    title: 'Kobblon is free, and it is staying free',
    body: 'A short clip about where the money comes from instead.',
    images: ['/brand/kobblon-its-free.mp4'], status: 'open', is_pinned: false, is_locked: false,
    is_removed: false, view_count: 3310, reply_count: 18, like_count: 97, answer_id: null,
    last_post_at: when, created_at: when, liked: false,
  },
  {
    ...staff, id: 103, category: 'announcements', category_name: 'Announcements',
    title: 'Leaderboards are live',
    body: 'Every World can keep its own board now, and the top of each one shows on the '
      + 'World page. Nothing to turn on; it is there if your World writes to it.',
    images: [], status: 'open', is_pinned: false, is_locked: false,
    is_removed: false, view_count: 1204, reply_count: 7, like_count: 44, answer_id: null,
    last_post_at: when, created_at: when, liked: false,
  },
]

const kid: ForumReply = {
  ...staff, id: 2, topic_id: 1, body: 'Working on the Linux port first, then I will have a look.',
  images: [], reply_to: 1, reply_to_name: 'Pixelhead', is_removed: false,
  like_count: 1, created_at: when, edited_at: null, is_answer: false, liked: false,
}

const parent: ForumReply = {
  ...op, id: 1, topic_id: 1, body: 'Could you add Intel Mac support at some point? It would save a lot of people a lot of time, and the thread above suggests the build is most of the way there already.',
  images: [], reply_to: null, reply_to_name: null, is_removed: false,
  like_count: 3, created_at: when, edited_at: null, is_answer: false, liked: false,
}

/*
 * The pager, copied from the page for the same reason StatusPairs is: it
 * is written inline against the live board there.
 */
function Pager2({ page, more }: { page: number; more: boolean }) {
  return (
    <nav className="flex max-w-xl items-center justify-between gap-3">
      <Button size="sm" variant="subtle" icon={faChevronLeft} disabled={page === 0}>
        Newer
      </Button>
      <span className="text-xs font-extrabold tabular-nums text-white/35">Page {page + 1}</span>
      <Button size="sm" variant="subtle" disabled={!more}>
        Older
        <Glyph icon={faChevronRight} className="ml-1.5 text-xs" />
      </Button>
    </nav>
  )
}

/* The strip on a board header saying who minds it. */
function Minders() {
  const who = [
    { user_id: '1', username: 'pixelhead', display_name: 'Pixelhead', avatar_url: null },
    { user_id: '2', username: 'quietone', display_name: 'Quietone', avatar_url: null },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/35">
        Looked after by
      </span>
      {who.map((one) => (
        <span
          key={one.user_id}
          className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-ink-card/60 py-1 pl-1 pr-2.5"
        >
          <Avatar src={one.avatar_url} name={one.display_name} size="sm" />
          <span className="text-xs font-extrabold text-white/70">{one.display_name}</span>
        </span>
      ))}
    </div>
  )
}

/*
 * A session handed straight to the context, which is what `AuthContext` is
 * exported for.
 *
 * `Composer` asks `useAuth`, and `useAuth` throws without its provider -
 * which is the thing this folder exists to find, and it found it: mounted
 * bare, the composer takes the page down rather than rendering. That is
 * worth the other session knowing, because the Workspace mounts this one.
 * It is not a bug in the composer; the fix is a provider, and here it is
 * the smallest one that is honest about what it supplies - a profile and
 * nothing else that is called.
 */
const signedIn = {
  profile: {
    id: 'a', username: 'pixelhead', display_name: 'Pixelhead', avatar_url: null,
  },
} as unknown as AuthValue

/*
 * Quoting, which is the one new piece that is a behaviour rather than a
 * shape: pressing it twice must put two quotes in the box and must not
 * take out what was typed between them. The composer wants an account, and
 * there is none here, so what this shows is the signed-out card - the
 * quote itself is proved by the counter going up, which is printed.
 */
function Quoting() {
  const [quoted, setQuoted] = useState<{ text: string; at: number } | null>(null)
  return (
    <AuthContext.Provider value={signedIn}>
    <div className="max-w-2xl space-y-3">
      <Button
        size="sm"
        variant="subtle"
        onClick={() => setQuoted((had) => ({
          text: '**Pixelhead** said:\n> It does not open.\n',
          at: (had?.at ?? 0) + 1,
        }))}
      >
        Quote Pixelhead
      </Button>
      <p className="text-xs font-bold text-white/35">
        Quoted {quoted?.at ?? 0} time{quoted?.at === 1 ? '' : 's'}
      </p>
      <Composer
        placeholder="Say something useful."
        action="Reply"
        insert={quoted}
        onSend={async () => {}}
      />
    </div>
    </AuthContext.Provider>
  )
}

/* The staff bar's two pairs. */
function StatusPairs() {
  const [status, setStatus] = useState<string>('looked-at')
  const pairs = [['solved', 'looked-at'], ['approved', 'declined']] as const

  return (
    <span className="flex flex-wrap items-center gap-2">
      {pairs.map((pair) => (
        <span
          key={pair.join('-')}
          className="inline-flex overflow-hidden rounded-xl border border-white/10 divide-x divide-white/10"
        >
          {pair.map((word) => {
            const on = status === word
            return (
              <button
                key={word}
                type="button"
                onClick={() => setStatus(on ? 'open' : word)}
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
  )
}

/*
 * The attachment grid and its viewer, with real files served from this
 * page rather than from the bucket - `Attachments` asks `forumImageUrl`,
 * which asks a database this container cannot reach, so the shapes would
 * be right and every box would be empty. This is the same markup against
 * two files that load.
 */
function Attachments2() {
  const [open, setOpen] = useState<number | null>(null)
  const files = ['/brand/landing-towers.webp', '/brand/kobblon-its-free.mp4']
  const clip = (p: string) => p.endsWith('.mp4')

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {files.map((path, i) => (
          <button
            key={path}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-media"
          >
            {clip(path) ? (
              <>
                <video src={path} preload="metadata" muted playsInline
                  className="pointer-events-none max-h-[18rem] w-full object-contain" />
                <span className="absolute inset-0 grid place-items-center bg-ink/25">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-ink/70 text-white">
                    <Glyph icon={faCheck} className="ml-0.5 text-lg" />
                  </span>
                </span>
              </>
            ) : (
              <img src={path} alt="" className="max-h-[18rem] w-full object-contain" />
            )}
          </button>
        ))}
      </div>
      <Lightbox
        paths={files}
        at={open}
        onMove={setOpen}
        onClose={() => setOpen(null)}
        urlOf={(p) => p}
      />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <MemoryRouter>
      <Page />
    </MemoryRouter>
  </ToastProvider>,
)
