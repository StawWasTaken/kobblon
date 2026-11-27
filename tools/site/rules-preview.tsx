/*
 * Policies and Support, proposed. `?page=policies|support`.
 *
 * Both have the same fault as the old About: a band, a wash, a `BandHead`
 * with an eyebrow over it, and then the thing you actually came for. On
 * Policies the thing you came for is nine documents and it is three
 * thousand pixels down a page that is mostly air. On Support it is a flat
 * wall of thirty rows - every section of every article, run together, each
 * with a tiny grey category over it, which is the help centre every
 * company has.
 *
 * So: no bands. The thing you came for is at the top, the grouping is real
 * rather than a label, and both pages carry a face.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { FACE_COLOUR } from '@/components/social/Reactions'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { AskKobby } from '@/components/about/AskKobby'
import { policies } from '@/content/policies'
import { helpArticles } from '@/content/help'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'
import '@/index.css'

const readable = (day: string) =>
  new Date(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** A face of ours, placed by a wrapper of our own. */
function Face({ face, className, turn, size = 'h-16 w-16' }: {
  face: keyof typeof FACE_COLOUR; className?: string; turn: number; size?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute select-none', className)}
      style={{ transform: `rotate(${turn}deg)` }}
    >
      <Icon name={`reaction-${face}` as 'reaction-smile'} tone={FACE_COLOUR[face]} className={size} />
    </span>
  )
}

/** The top of both pages: short, loud, and the bar straight away. */
function Top({ title, says, children }: {
  title: React.ReactNode; says: string; children?: React.ReactNode
}) {
  return (
    <header className="relative overflow-hidden border-b-2 border-ink-line">
      <img
        src={asset('/brand/waves.png')}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/45" />
      <div className="relative mx-auto max-w-4xl px-5 py-12 sm:py-16">
        <h1 className="font-display text-4xl font-extrabold leading-[0.95] text-on-art sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-lede leading-relaxed text-on-art/75">{says}</p>
        {children}
      </div>
    </header>
  )
}

/* ------------------------------------------------------------- policies */

function Rules() {
  return (
    <div className="min-h-screen bg-ink">
      <Top
        title={<>The rules.<br />All of them.</>}
        says="Nine documents. Written to be read, not to be agreed to."
      >
        <AskKobby className="mt-7 max-w-xl text-left" />
      </Top>

      <div className="relative mx-auto max-w-4xl px-5 py-12">
        <Face face="sunglasses" turn={-12} className="right-2 top-4 hidden sm:block" />

        {/* One row each, not nine cards. Nine cards is a grid somebody has
            to read across; this is a list somebody can run an eye down. */}
        <ul className="divide-y-2 divide-ink-line overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card">
          {policies.map((policy) => (
            <li key={policy.slug}>
              <Link
                to={`/policies/${policy.slug}`}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-extrabold leading-tight">
                    {policy.title}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">{policy.blurb}</span>
                </span>
                <span className="hidden shrink-0 text-mini font-bold uppercase tracking-wide text-muted sm:block">
                  {readable(policy.updated)}
                </span>
                <Glyph
                  icon={faArrowRight}
                  className="shrink-0 text-link transition-transform group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>

        {/* When a rule is about you. Two doors, said plainly. */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/standing"
            className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6 transition-colors hover:border-brand"
          >
            <p className="font-display text-xl font-extrabold leading-none">Where you stand</p>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              Every decision against your account, what it switched off, and how to
              argue with it.
            </p>
          </Link>
          <Link
            to="/support"
            className="relative overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6 transition-colors hover:border-brand"
          >
            <Face face="shocked" turn={10} className="right-3 top-3 opacity-90" size="h-12 w-12" />
            <p className="font-display text-xl font-extrabold leading-none">Write to a person</p>
            <p className="mt-2.5 max-w-[20rem] text-sm leading-relaxed text-muted">
              Not a bot and not a form that goes nowhere. The reply lands in your
              Kobblon inbox.
            </p>
          </Link>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          These say what actually happens. They have not been through a lawyer yet,
          and they will be before Kobblon opens widely. We would rather tell you that
          than pretend.
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- support */

/*
 * Four groups rather than seven.
 *
 * One heading over one card, six times, is a list of headings - and that
 * is what seven topics gave, because most of them hold a single article.
 * These four each hold two or three, which is a group somebody can read
 * as a group.
 */
const GROUPS: { topics: string[]; name: string }[] = [
  { topics: ['account'], name: 'Your account' },
  { topics: ['money', 'creator'], name: 'Brix, buying and building' },
  { topics: ['safety', 'privacy'], name: 'Safety and what is held about you' },
  { topics: ['bug', 'other'], name: 'Everything else' },
]

function Help() {
  return (
    <div className="min-h-screen bg-ink">
      <Top
        title={<>What has<br />gone wrong?</>}
        says="Nine things people actually write in about, and a way to reach a person when none of them is it."
      >
        <AskKobby className="mt-7 max-w-xl text-left" tone="support" />
      </Top>

      <div className="relative mx-auto max-w-4xl px-5 py-12">
        <Face face="sad" turn={-10} className="right-2 top-4 hidden sm:block" />

        {/*
         * Grouped by what it is about, with the group as a heading rather
         * than as a grey word over every single row. The page this
         * replaces listed every section of every article in one flat
         * column - thirty rows, each labelled ACCOUNT or MONEY - which is
         * a wall somebody scrolls past rather than a thing they read.
         */}
        <div className="space-y-8">
          {GROUPS.map((group) => {
            const mine = helpArticles.filter((one) => group.topics.includes(one.topic))
            if (mine.length === 0) return null
            return (
              <section key={group.name}>
                <h2 className="font-display text-xl font-extrabold">{group.name}</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {mine.map((one) => (
                    <Link
                      key={one.slug}
                      to={`/support/h/${one.slug}`}
                      className="group rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-5 transition-colors hover:border-brand"
                    >
                      <p className="font-display text-lg font-extrabold leading-tight">
                        {one.title}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{one.blurb}</p>
                      <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-link">
                        Read it
                        <Glyph
                          icon={faArrowRight}
                          className="transition-transform group-hover:translate-x-1"
                        />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {/* The ticket, which is the actual tool on this page. */}
        <div className="relative mt-10 overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line">
          <img
            src={asset('/brand/waves.png')}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/50" />
          <div className="relative flex flex-col items-center gap-6 p-7 sm:flex-row sm:p-9">
            <img
              src={asset('/mascot/notification.png')}
              alt=""
              aria-hidden="true"
              className="w-24 shrink-0 select-none"
            />
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-extrabold leading-none text-on-art">
                None of that? Write to us.
              </p>
              <p className="mt-3 text-lede leading-relaxed text-on-art/75">
                A ticket goes to a person - there is no bot on the other end of this -
                and the reply lands in your Kobblon inbox.
              </p>
            </div>
            <Button to="/support#write" variant="primary">Open a ticket</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const which = new URLSearchParams(location.search).get('page') ?? 'policies'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    {which === 'support' ? <Help /> : <Rules />}
  </MemoryRouter>,
)
