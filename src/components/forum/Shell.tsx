import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon, type KobIcon } from '@/components/brand/Icon'
import { Glyph } from '@/components/brand/Glyph'
import {
  faCircleQuestion, faHammer, faComment, faLock, faPlus, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { AboutNav } from '@/components/layout/AboutNav'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/States'
import { useForceDark } from '@/hooks/useTheme'
import { ForumDoor } from '@/components/forum/ForumDoor'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ForumBoard } from '@/types/db'

/**
 * The forum's own shell: a rail of categories and the room beside it.
 *
 * Staw: "i want the forum design to be really like ours (At Kobblon) but i
 * also want it to be like the design of discourse forums and i dont want a
 * sort of introduction to the community forum i want that when u arrive u
 * directly see the multiple categories etc".
 *
 * So there is no hero and nothing to scroll past: the categories are the
 * first thing on the screen, in a rail that stays there while you read,
 * which is the shape every forum anybody has used has. What is ours is
 * everything else - the ink, the brand blue, the display type, the bar
 * across the top and the foot underneath, because a forum on its own
 * styling is a second website wearing our name.
 *
 * It is not `AboutShell`, deliberately. That shell is built around a hero
 * and a column of bands, which is exactly the introduction Staw does not
 * want; what it owns besides that is the bar and the foot, and those are
 * here. The two pages that are long reading rather than a board - a topic,
 * and the form for starting one - use this too, so the rail does not
 * vanish the moment you click something.
 */

/*
 * The drawing each board wears: ours where one of ours *means* that, and
 * Font Awesome's where it does not.
 *
 * Staw's rule about icons is that a mark is picked by what it means. Our
 * flag is `report` everywhere on this site, so a flag on Help and support
 * would say the board is for reporting people; our `world` is a World
 * rather than the act of building one. Those two take Font Awesome's, and
 * the day Staw draws a question mark and a hammer, two lines here put them
 * everywhere.
 */
export const BOARD_ART: Record<string, { ours?: KobIcon; fa?: IconDefinition }> = {
  announcements: { ours: 'announcement' },
  'community-creations': { ours: 'assets' },
  'feedback-and-suggestions': { ours: 'chatbubble' },
  'help-and-support': { fa: faCircleQuestion },
  'building-and-scripting': { fa: faHammer },
  'off-topic': { ours: 'people' },
}

/*
 * A colour per board, so a category reads at a glance down a list of
 * twenty topics. Discourse does this with a square of colour and it is the
 * one thing of theirs worth copying outright: the eye finds the room
 * before it reads the title.
 *
 * They are the site's own colours rather than six new ones - brand, space,
 * amber, danger - because a forum that introduces its own palette is a
 * second product.
 */
export const BOARD_COLOUR: Record<string, string> = {
  announcements: 'bg-brand-bright',
  'community-creations': 'bg-space-bright',
  'feedback-and-suggestions': 'bg-amber-400',
  'help-and-support': 'bg-link',
  'building-and-scripting': 'bg-violet-400',
  'off-topic': 'bg-white/40',
}

export function BoardMark({ slug, className }: { slug: string; className?: string }) {
  const art = BOARD_ART[slug]
  return (
    <span className={cn(
      'grid shrink-0 place-items-center rounded-lg border border-white/10 bg-ink-raised text-brand-bright',
      className ?? 'h-7 w-7 text-xs',
    )}>
      {art?.ours
        ? <Icon name={art.ours} className="h-[1em] w-[1em]" />
        : <Glyph icon={art?.fa ?? faComment} />}
    </span>
  )
}

export function ForumShell({
  boards, loading, children,
}: {
  boards: ForumBoard[]
  loading: boolean
  children: ReactNode
}) {
  useForceDark()
  const { pathname } = useLocation()

  return (
    <div className="relative flex min-h-dvh flex-col bg-ink text-white">
      <AboutNav />
      <ForumDoor />

      <div className="mx-auto flex w-full max-w-[88rem] flex-1 gap-8 px-4 py-6 sm:px-6 lg:py-8">
        {/*
         * The rail. Sticky rather than fixed: fixed takes it out of the
         * flow and the page under it then has to be padded by exactly its
         * width, which is a number in two files that disagree the first
         * time either changes.
         */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24">
            <Button to="/forum/new" variant="yes" icon={faPlus} block>Start a topic</Button>

            <nav className="mt-6">
              <RailLink to="/forum" here={pathname === '/forum'} icon={faLayerGroup}>
                All topics
              </RailLink>
            </nav>

            <p className="mb-2 mt-7 px-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
              Categories
            </p>
            <nav className="space-y-0.5">
              {loading
                ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)
                : boards.map((board) => (
                  <RailBoard
                    key={board.slug}
                    board={board}
                    here={pathname === `/forum/c/${board.slug}`}
                  />
                ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <SiteFooter className="relative border-white/[0.08]" />
    </div>
  )
}

function RailLink({
  to, here, icon, children,
}: {
  to: string
  here: boolean
  icon: IconDefinition
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-extrabold transition-colors',
        here ? 'bg-white/[0.07] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white',
      )}
    >
      <Glyph icon={icon} className={cn('text-sm', here ? 'text-brand-bright' : 'text-white/30')} />
      {children}
    </Link>
  )
}

function RailBoard({ board, here }: { board: ForumBoard; here: boolean }) {
  return (
    <Link
      to={`/forum/c/${board.slug}`}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-colors',
        here ? 'bg-white/[0.07] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white',
      )}
    >
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', BOARD_COLOUR[board.slug] ?? 'bg-white/30')} />
      <span className="min-w-0 flex-1 truncate">{board.name}</span>
      {board.staff_only
        ? <Glyph icon={faLock} className="text-[10px] text-white/25" />
        : <span className="text-[11px] tabular-nums text-white/25">
            {formatCount(board.topic_count)}
          </span>}
    </Link>
  )
}

/** The rail's categories again, for the widths where there is no rail. */
export function BoardStrip({ boards }: { boards: ForumBoard[] }) {
  return (
    <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
      {boards.map((board) => (
        <Link
          key={board.slug}
          to={`/forum/c/${board.slug}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-ink-card/60 px-3 py-2 text-xs font-extrabold text-white/70"
        >
          <span className={cn('h-2 w-2 rounded-sm', BOARD_COLOUR[board.slug] ?? 'bg-white/30')} />
          {board.name}
        </Link>
      ))}
    </div>
  )
}
