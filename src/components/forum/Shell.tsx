import { useEffect, useState, type ReactNode } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { useMaybeAuth } from '@/hooks/useAuth'
import { forumBoardsIMind } from '@/lib/api'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon, type KobIcon } from '@/components/brand/Icon'
import { Glyph } from '@/components/brand/Glyph'
import {
  faCircleQuestion, faHammer, faComment, faLock, faPlus, faLayerGroup,
  faMagnifyingGlass, faXmark, faShieldHalved, faUser,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { AboutNav } from '@/components/layout/AboutNav'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { CookieNote } from '@/components/layout/CookieNote'
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
  /*
   * The laurel is ours and it is already what a contest looks like on
   * this site - it is the quest mark, worn by the thing you win. The year
   * and the contest inside it wear the same one: they are the same room
   * at three sizes, and giving each of them its own drawing would say
   * they are three different kinds of place.
   */
  'avatar-contests': { ours: 'laurel-quest' },
  'avatar-contests-2026': { ours: 'laurel-quest' },
  'avatar-contest-halloween-2026': { ours: 'laurel-quest' },
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
  /*
   * Orange, which is one colour the forum did not already carry.
   *
   * The note above says the boards take the site's own colours rather
   * than new ones, and that still holds for the six rooms the forum is
   * made of. A contest is not one of those - it is a thing that arrives,
   * runs and ends - and the family needs to read as one block down a list
   * the eye is scanning by colour. Amber is two rows up on Feedback, so
   * the three share orange and nothing else on the page uses it.
   */
  'avatar-contests': 'bg-orange-400',
  'avatar-contests-2026': 'bg-orange-400',
  'avatar-contest-halloween-2026': 'bg-orange-400',
}

/*
 * The same six colours again, as ink rather than fill.
 *
 * Staw: "how about you make the svg icons of each category the same colour
 * as its category". The stripe down the side of a row and the square in the
 * rail already say which room you are in; the drawing in the middle of the
 * row was saying brand blue six times, which is the one place a colour was
 * spent on nothing.
 *
 * It is a second map rather than a string swap on the first, because
 * `bg-brand-bright` and `text-brand-bright` are two classes and Tailwind
 * only emits the ones it can read whole in a file. Off topic is the one
 * that is not a straight copy: `white/40` is a fill a stripe can carry and
 * a line drawing at this size cannot, so its ink is `white/60`.
 */
export const BOARD_INK: Record<string, string> = {
  announcements: 'text-brand-bright',
  'community-creations': 'text-space-bright',
  'feedback-and-suggestions': 'text-amber-400',
  'help-and-support': 'text-link',
  'building-and-scripting': 'text-violet-400',
  'off-topic': 'text-white/60',
  'avatar-contests': 'text-orange-400',
  'avatar-contests-2026': 'text-orange-400',
  'avatar-contest-halloween-2026': 'text-orange-400',
}

export function BoardMark({ slug, className }: { slug: string; className?: string }) {
  const art = BOARD_ART[slug]
  return (
    <span className={cn(
      'grid shrink-0 place-items-center rounded-lg border border-white/10 bg-ink-raised',
      BOARD_INK[slug] ?? 'text-brand-bright',
      className ?? 'h-7 w-7 text-xs',
    )}>
      {art?.ours
        ? <Icon name={art.ours} className="h-[1em] w-[1em]" />
        : <Glyph icon={art?.fa ?? faComment} />}
    </span>
  )
}

/**
 * The forum's search box.
 *
 * It submits rather than searching as you type. Deliberate: every
 * keystroke is a round trip to Postgres's full-text search over every
 * topic on the platform, and a forum search that fires on the "d" of
 * "door" is six queries nobody wanted. Enter, or the button.
 *
 * What is in the box comes from the address, not from a value kept here:
 * somebody landing on `/forum/search?q=door` from a pasted link must see
 * "door" in the box, and the two go out of step the moment one of them is
 * the only truth. The state is re-seeded whenever the address changes.
 */
export function ForumSearchBox({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const asked = params.get('q') ?? ''
  const [terms, setTerms] = useState(asked)

  useEffect(() => { setTerms(asked) }, [asked])

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const want = terms.trim()
    if (!want) return
    navigate(`/forum/search?q=${encodeURIComponent(want)}`)
  }

  return (
    <form onSubmit={go} className={cn('relative', className)} role="search">
      <Glyph
        icon={faMagnifyingGlass}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/30"
      />
      <input
        type="search"
        value={terms}
        onChange={(e) => setTerms(e.target.value)}
        placeholder="Search the forum"
        aria-label="Search the forum"
        /*
         * `type="search"` brings the browser's own clear cross with it,
         * which lands beside ours: two crosses, one of them unstyled.
         * Ours stays, because it is the one that matches the site.
         */
        className="w-full rounded-xl border border-white/10 bg-ink-card/60 py-2 pl-9 pr-9 text-sm font-semibold text-white placeholder:text-white/30 transition-colors focus:border-brand-bright/50 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {terms && (
        <button
          type="button"
          onClick={() => setTerms('')}
          aria-label="Clear"
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-white/35 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Glyph icon={faXmark} className="text-xs" />
        </button>
      )}
    </form>
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
      {/*
       * The front page only, and mounted rather than told. Unmounting it
       * on the way into a thread is what makes coming back an arrival
       * again - Staw asked for the dots "everytime you go onto the forum
       * page", and a component that stays mounted and is asked to replay
       * itself is a component with a second idea of when it has played.
       */}
      {pathname === '/forum' && <ForumDoor waiting={loading} />}

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

            <ForumSearchBox className="mt-3" />

            <nav className="mt-6">
              <RailLink to="/forum" here={pathname === '/forum'} icon={faLayerGroup}>
                All topics
              </RailLink>
              <YouLink here={pathname.startsWith('/forum/u/')} />
              <MineLink here={pathname === '/forum/mine'} />
            </nav>

            <p className="mb-2 mt-7 px-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
              Categories
            </p>
            {/*
             * The top of the tree and nothing else. Staw: "why did i make
             * multiple categories? cuz i wanted to only view one main
             * category for avatar events in the categories list, i want to
             * keep things clean" - the years and the contests are a way of
             * filing them, not nine more rooms to scroll past. A category
             * inside a category is reached from the category page, which
             * lists what is inside it.
             *
             * It stays lit while you are anywhere under it, so walking
             * into Halloween 2026 does not read as having left the forum's
             * categories entirely.
             */}
            <nav className="space-y-0.5">
              {loading
                ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)
                : boards.filter((one) => one.depth === 0).map((board) => (
                  <RailBoard
                    key={board.slug}
                    board={board}
                    here={topOf(boards, pathname) === board.slug}
                  />
                ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {/* No rail at this width, so the search box comes with the page. */}
          <ForumSearchBox className="mb-5 lg:hidden" />
          {children}
        </main>
      </div>

      <SiteFooter className="relative border-white/[0.08]" />

      {/*
       * Staw: "'We use cookies' doesnt appear in the forums". It did not,
       * because it is mounted by `AboutShell` and the forum is not on
       * that shell - the one page of the At Kobblon side with its own
       * frame was the one page without the notice. It is the same card,
       * not a second one; a second wording of what the site stores is a
       * second claim about it.
       */}
      <CookieNote />
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

/**
 * The rail's link to the boards you look after, drawn only when you look
 * after one.
 *
 * It asks every time the shell mounts rather than once at sign-in: being
 * put in charge of a board happens while somebody is signed in, and a
 * value read at sign-in is the trap this project keeps falling into.
 *
 * `useMaybeAuth` rather than `useAuth`, because this shell is mounted on
 * pages anybody can read - signed out, `useAuth` throws and the whole
 * forum goes blank rather than the one link not appearing.
 */
/**
 * Your own forum profile, from the forum's own rail.
 *
 * It lived in the account menu for a round and came out again with
 * everything else Staw called "a lot of stuff": a menu that is the same on
 * both halves of the site cannot carry one half's pages. The forum is
 * where somebody wants their forum profile, so it is on the forum's rail,
 * next to the two other links that are about them.
 *
 * `useMaybeAuth` for the reason the link below gives: signed out, `useAuth`
 * throws and the whole forum goes blank rather than one link not drawing.
 */
function YouLink({ here }: { here: boolean }) {
  const auth = useMaybeAuth()
  const profile = auth?.profile ?? null
  if (!profile || profile.is_guest) return null

  return (
    <RailLink to={`/forum/u/${profile.username}`} here={here} icon={faUser}>
      Your profile
    </RailLink>
  )
}

function MineLink({ here }: { here: boolean }) {
  const auth = useMaybeAuth()
  const profile = auth?.profile ?? null
  const mine = useAsync(
    () => (profile ? forumBoardsIMind() : Promise.resolve([])),
    [profile?.id],
  )

  if (!(mine.data ?? []).length) return null

  return (
    <RailLink to="/forum/mine" here={here} icon={faShieldHalved}>
      Boards you mind
    </RailLink>
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

/**
 * Which top-level category a forum path is inside, walking up the tree.
 *
 * The rail lights the root of the branch you are in rather than the exact
 * row, because the rows under the root are not drawn - without this, every
 * category in the rail goes dark the moment you open a contest.
 */
function topOf(boards: ForumBoard[], pathname: string): string | null {
  const at = pathname.startsWith('/forum/c/') ? pathname.slice('/forum/c/'.length) : null
  if (!at) return null
  const seen = new Set<string>()
  let here = boards.find((one) => one.slug === at)
  while (here?.parent && !seen.has(here.parent)) {
    seen.add(here.parent)
    const up = boards.find((one) => one.slug === here!.parent)
    if (!up) break
    here = up
  }
  return here?.slug ?? at
}

/** The rail's categories again, for the widths where there is no rail. */
export function BoardStrip({ boards }: { boards: ForumBoard[] }) {
  return (
    <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
      {boards.filter((one) => one.depth === 0).map((board) => (
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
