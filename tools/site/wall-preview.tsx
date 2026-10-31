/*
 * A community wall on its own, for the one thing that changed on it: a
 * sticker is a picture here too, and there is a button to send one.
 *
 * The posts and the sticker list are answered below rather than fetched,
 * because a bare page has no session - and the pictures are the real files
 * out of `public/`, so this is the actual wall drawing Staw's actual
 * drawings rather than a mock-up of one.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { CommunityWall } from '@/components/community/CommunityWall'
import { ToastProvider } from '@/components/ui/Toast'
import { TitleTips } from '@/components/ui/TitleTips'
import type { CommunityOverview } from '@/types/db'
import '@/index.css'

const post = (id: number, body: string, back: number) => ({
  id,
  community_id: 'c',
  author_id: `a${id}`,
  title: null,
  body,
  media_url: null,
  media_kind: null,
  is_announcement: false,
  is_pinned: false,
  like_count: 0,
  i_like: false,
  dislike_count: 0,
  i_dislike: false,
  created_at: new Date(Date.now() - back).toISOString(),
  edited_at: null,
  author_username: id % 2 ? 'staw' : 'kobby',
  author_display_name: id % 2 ? 'staw' : 'kobby',
  author_avatar_url: null,
  author_is_guest: false,
  author_is_verified: id % 2 === 1,
  author_rank: id % 2 ? 'Owner' : null,
})

const realFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  const where = typeof input === 'string' ? input : (input as Request).url ?? String(input)

  if (where.includes('/rest/v1/rpc/community_posts_list')) {
    return Promise.resolve(new Response(JSON.stringify([
      post(1, 'wall is open, say something', 3 * 3_600_000),
      post(2, ':plunk-smug:', 2 * 3_600_000),
      post(3, 'anybody up for a round tonight', 60_000),
    ]), { headers: { 'content-type': 'application/json' } }))
  }

  if (where.includes('/rest/v1/rpc/reactions_on_many')) {
    return Promise.resolve(new Response('[]', { headers: { 'content-type': 'application/json' } }))
  }

  if (where.includes('/rest/v1/pictures_by_name')) {
    const rows = [
      'excited', 'embarrassed', 'worried', 'smug', 'dizzy',
      'relieved', 'pleading', 'unimpressed', 'determined',
    ].map((word, at) => ({
      name: `plunk-${word}`,
      pack: 'plunk',
      label: `Plunk, ${word}`,
      picture: `/stickers/plunk/${word}.png`,
      small: `/stickers/plunk/${word}.webp`,
      draws: 'alone',
      sort: at + 1,
    }))
    return Promise.resolve(new Response(JSON.stringify(rows), {
      headers: { 'content-type': 'application/json' },
    }))
  }

  return realFetch(input as RequestInfo, init)
}

const rights = { can_post_wall: true, can_pin_posts: true } as unknown as CommunityOverview

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <TitleTips />
      <div className="min-h-screen bg-ink p-6">
        <div className="mx-auto max-w-2xl">
          <CommunityWall communityId="c" rights={rights} />
        </div>
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
