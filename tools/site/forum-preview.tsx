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
import { Byline } from '@/components/forum/Pieces'
import { PostMenu } from '@/components/forum/PostMenu'
import { ReadingRail, SignedOutNote, RelatedTopics, OpTag } from '@/components/forum/Reading'
import { BoardMark } from '@/components/forum/Shell'
import type { ForumAuthor, ForumRelated } from '@/types/db'
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

      <Row title="The three dots, open">
        <div className="flex gap-6">
          <PostMenu
            link="https://kobblon.com/forum/t/42"
            canEdit canRemove canReport
            onEdit={() => {}} onRemove={() => {}} onReport={() => {}}
          />
          <PostMenu
            link="https://kobblon.com/forum/t/42"
            canEdit={false} canRemove={false} canReport
            onEdit={() => {}} onRemove={() => {}} onReport={() => {}}
          />
        </div>
      </Row>

      <Row title="Signed out, in the middle of a thread">
        <SignedOutNote back="/forum/t/42" />
      </Row>

      <Row title="Related topics">
        <RelatedTopics topics={related} loading={false} />
        <RelatedTopics topics={[]} loading />
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
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <MemoryRouter>
      <Page />
    </MemoryRouter>
  </ToastProvider>,
)
