/*
 * The band on Home, and the board list with a category inside a category.
 *
 * It was the Halloween contest's rooms until Staw cancelled the contest; the
 * tree 0313 built is still there, so the three rooms here are a made-up
 * family that no database has - which also puts the fallback through its
 * paces, since none of these slugs has a drawing or a colour of its own.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { EventBanner } from '@/components/home/EventBanner'
import { BoardTable } from '@/pages/Forum'
import { ForumShell } from '@/components/forum/Shell'
import { TitleTips } from '@/components/ui/TitleTips'
import type { ForumBoard } from '@/types/db'
import '@/index.css'

const board = (
  slug: string, name: string, blurb: string,
  depth: number, parent: string | null, topics: number, staff = false,
  holds = false,
): ForumBoard => ({
  slug, name, blurb, kind: 'plain', staff_only: staff, parent, depth,
  holds_only_categories: holds,
  topic_count: topics, post_count: topics * 4,
  last_post_at: topics ? new Date(Date.now() - 900_000).toISOString() : null,
  last_title: topics ? 'What I made' : null,
  last_topic_id: topics ? 12 : null,
  last_author: topics ? 'staw' : null,
  last_author_avatar: null, last_author_username: 'staw',
  last_author_id: topics ? 'a' : null,
})

/* The order 0313's `forum_boards` hands over: a child always follows its parent. */
const boards: ForumBoard[] = [
  board('announcements', 'Announcements', 'What Kobblon is doing, said by the people doing it.', 0, null, 4, true),
  board('community-creations', 'Community creations', 'Worlds, items, art and whatever else you made.', 0, null, 31),
  board('contests', 'Contests', 'Enter, win Brix. Every contest Kobblon has run, by year.', 0, null, 7, false, true),
  board('contests-2026', '2026', 'The contests we ran in 2026.', 1, 'contests', 7, false, true),
  board('contest-example', 'A contest', 'What one of them looks like once it is open.', 2, 'contests-2026', 7),
  board('feedback-and-suggestions', 'Feedback and suggestions', 'Ideas for Kobblon, and the things that are wrong with it.', 0, null, 58),
  board('off-topic', 'Off topic', 'Everything else, within the Guidelines.', 0, null, 112),
]

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <TitleTips />
    <div className="min-h-dvh bg-ink p-8">
      <div className="mx-auto max-w-5xl space-y-10">
        <EventBanner />
        <BoardTable boards={boards.filter((one) => one.depth === 0)} loading={false} />
      </div>
      {/* The rail as the forum draws it: the top of the tree only. */}
      <div className="mx-auto mt-10 max-w-5xl">
        <ForumShell boards={boards} loading={false}>
          <BoardTable boards={boards.filter((one) => one.depth === 0)} loading={false} />
        </ForumShell>
      </div>
    </div>
  </MemoryRouter>,
)
