import { Link } from 'react-router-dom'
import { faDiscord, faYoutube } from '@fortawesome/free-brands-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import { Wordmark } from '@/components/brand/Wordmark'
import { Kmark } from '@/components/brand/Kmark'
import { cn } from '@/lib/cn'
import { usePlatformVersion } from '@/lib/version'

/*
 * One foot for the whole site.
 *
 * Staw's shape, and the reason for each column: the lockup and the
 * copyright on the left; the pages of Kobblon itself that a stranger can
 * reach without an account; the At Kobblon pages, which are what Kobblon
 * says about itself; and where we are elsewhere.
 *
 * Only places that exist are listed. The wiki is still an idea, so it is
 * not here - a link to a page nobody has built is worse than no link. The
 * forum is built, so it is; and there is no newsroom line to miss, because
 * Staw cancelled the newsroom - "no newsroom, use the forums' announcement
 * channel" - so Kobblon's news lives on a board the forum link already
 * reaches.
 */

const kobblon = [
  { to: '/discover', label: 'Play' },
  { to: '/create', label: 'Create' },
  { to: '/communities', label: 'Communities' },
  { to: '/people', label: 'People' },
]

/*
 * The At Kobblon pages: the ones that speak for Kobblon rather than being
 * part of using it.
 *
 * Support moved here, and account standing left the foot entirely. Staw
 * had settled the opposite once - "a ticket and your own record are
 * things you do here" - and then changed one half of it: Support takes
 * anybody now, with or without an account, which makes it a page Kobblon
 * offers rather than a page of yours. Standing is the other half of that
 * same decision and went the other way, behind the rail, so a link to it
 * in a foot that is drawn on the landing page is a link that would bounce
 * a stranger to the landing page. It is in the account menu, where the
 * person who has one will find it.
 */
const atKobblon = [
  { to: '/about', label: 'What is Kobblon' },
  { to: '/forum', label: 'Forum' },
  { to: '/support', label: 'Support' },
  { to: '/policies', label: 'Policies' },
  { to: '/terms', label: 'Terms of Use' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/guidelines', label: 'Community guidelines' },
  // Download last wherever it is listed. Staw's rule, and the order
  // somebody actually moves through these: the install comes after the
  // page has answered everything else.
  { to: '/download', label: 'Download' },
]

/**
 * Ours, elsewhere - and the one that is not elsewhere at all.
 *
 * Staw: "to social, instead of adding our reddit forum we'll add the
 * Kobblon Forums/ Community Forum (chose the name that u want to use
 * between these two) and use the kobblon logomark for that". Community
 * Forum, because that is what the page calls itself and what its tab title
 * says, and two names for one room is how a link gets clicked twice.
 *
 * It is the only entry here that is ours rather than somebody else's, so
 * it carries our mark rather than a brand glyph, and it is a `to` rather
 * than an `href`: a router link, not a new tab out of the site into the
 * site. Every other one of these is a real address and opens away.
 *
 * Last in the list rather than first, and wearing `Kmark` rather than the
 * drawn `Logomark`. Staw asked for both: the blue picture did not line up
 * with the two glyphs under it, because it is a picture of its own
 * proportions sitting where a 16px square belongs, and it stayed blue while
 * the row it was in went white. `Kmark` is the same shape as a glyph, so it
 * sits in the same box and takes the same colour as Discord and YouTube.
 */
const social: {
  href?: string
  to?: string
  label: string
  icon?: IconDefinition
  mark?: boolean
}[] = [
  { href: 'https://discord.gg/SsjvR6rmez', label: 'Discord', icon: faDiscord },
  {
    href: 'https://www.youtube.com/channel/UCjFPtUjIY7mDFFOv-LuB7hQ',
    label: 'YouTube',
    icon: faYoutube,
  },
  { to: '/forum', label: 'Community Forum', mark: true },
]

function Heading({ children }: { children: string }) {
  return (
    <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/40">
      {children}
    </p>
  )
}

function Column({ heading, links }: {
  heading: string
  links: { to: string; label: string }[]
}) {
  return (
    <div>
      <Heading>{heading}</Heading>
      <ul className="mt-4 space-y-2.5">
        {links.map((one) => (
          <li key={one.to + one.label}>
            <Link
              to={one.to}
              className="text-sm font-semibold text-white/55 transition-colors hover:text-brand-bright"
            >
              {one.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * `compact` is the signed-in pages' version.
 *
 * Staw asked for a foot on those pages too, and asked whether it should be
 * this one or a second one. This one: the links are the same links, and a
 * second foot is a second place for a page that moved to keep pointing at
 * where it used to be. What changes is the room it takes - an At Kobblon
 * page ends at its footer, while a signed-in page is somewhere you are
 * working, so the foot there is a close rather than a chapter of its own.
 */
export function SiteFooter({ className, compact }: { className?: string; compact?: boolean }) {
  const year = new Date().getFullYear()
  const version = usePlatformVersion()

  return (
    <footer className={cn('relative border-t border-white/10 bg-ink', className)}>
      {/* One brand line along the top, which is the whole of the decoration
          this needs: it says where the page ends without a slab of colour. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/50 to-transparent"
      />

      <div className={cn('mx-auto max-w-6xl px-4 sm:px-8', compact ? 'py-10' : 'py-16')}>
        <div className={cn(
          'grid gap-x-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]',
          compact ? 'gap-y-8' : 'gap-y-12',
        )}>
          <div>
            {/* The wordmark as type rather than as a picture, with the line
                under it. It stays sharp at any size and takes the theme
                with it, which the drawn lockup cannot. */}
            <Wordmark to="/" className="h-6" always />
            <p className="mt-3.5 font-display text-sm font-extrabold text-white/70">
              The game built by players
            </p>
            {/* The version sits with the copyright rather than anywhere
                louder: it is the sort of thing somebody goes looking for
                when they are reporting something, and the foot of the page
                is where that is always looked for.
                It comes from the database now, so the website, the Launcher
                and the Workspace all say the same thing on the same day
                with nobody deploying anything - see `@/lib/version`. */}
            <p className="mt-5 flex items-center gap-2 text-xs text-white/30">
              <span>© {year} Kobblon</span>
              <span aria-hidden="true">&middot;</span>
              <span
                className="rounded-md border border-white/10 px-1.5 py-0.5 font-bold text-white/45"
                title={
                  version.next
                    ? `Kobblon is on V${version.name}. V${version.next.name} starts on ${version.next.on}. One number for the website, the Launcher and the Workspace.`
                    : `Which version of Kobblon this is - one number for the website, the Launcher and the Workspace.`
                }
              >
                V{version.name}
              </span>
            </p>
          </div>

          <Column heading="Kobblon" links={kobblon} />
          <Column heading="At Kobblon" links={atKobblon} />

          <div>
            <Heading>Social</Heading>
            <ul className="mt-4 space-y-2.5">
              {social.map((one) => {
                /*
                 * Our mark gets the same 16px box as the glyphs beside it
                 * and the same two colours, so the three labels start on
                 * one line. It is narrower than it is tall, so the box is
                 * square and the shape is centred inside it rather than
                 * stretched to fill it.
                 */
                const inside = (
                  <>
                    <span className="grid h-4 w-4 shrink-0 place-items-center text-white/35 transition-colors group-hover:text-brand-bright">
                      {one.mark
                        ? <Kmark className="h-4 w-auto" />
                        : <Glyph icon={one.icon as IconDefinition} className="h-4 w-4" />}
                    </span>
                    {one.label}
                  </>
                )
                const look = 'group flex items-center gap-2.5 text-sm font-semibold text-white/55 transition-colors hover:text-brand-bright'

                return (
                  <li key={one.label}>
                    {one.to ? (
                      <Link to={one.to} className={look}>{inside}</Link>
                    ) : (
                      <a href={one.href} target="_blank" rel="noreferrer noopener" className={look}>
                        {inside}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
