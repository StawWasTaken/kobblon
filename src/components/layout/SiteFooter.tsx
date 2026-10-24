import { Link } from 'react-router-dom'
import { faDiscord, faYoutube } from '@fortawesome/free-brands-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import { Wordmark } from '@/components/brand/Wordmark'
import { Kmark } from '@/components/brand/Kmark'
import { cn } from '@/lib/cn'

/*
 * One foot for the whole site.
 *
 * Staw's shape, and the reason for each column: the lockup and the
 * copyright on the left; the pages of Kobblon itself that a stranger can
 * reach without an account; the At Kobblon pages, which are what Kobblon
 * says about itself; and where we are elsewhere.
 *
 * Only places that exist are listed. The wiki and the newsroom are ideas,
 * so they are not here - a link to a page nobody has built is worse than
 * no link. The forum is built, so it is.
 */

const kobblon = [
  { to: '/discover', label: 'Play' },
  { to: '/create', label: 'Create' },
  { to: '/communities', label: 'Communities' },
  { to: '/people', label: 'People' },
  { to: '/support', label: 'Support' },
  { to: '/standing', label: 'Your standing' },
]

/*
 * The At Kobblon pages: the ones that speak for Kobblon rather than being
 * part of using it. Support and standing are **not** among them, which
 * Staw settled - a ticket and your own record are things you do here, not
 * things Kobblon says about itself - so they are in the column above.
 */
const atKobblon = [
  { to: '/about', label: 'What is Kobblon' },
  { to: '/download', label: 'Download' },
  { to: '/forum', label: 'Forum' },
  { to: '/policies', label: 'Policies' },
  { to: '/terms', label: 'Terms of Use' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/guidelines', label: 'Community guidelines' },
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

export function SiteFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear()

  return (
    <footer className={cn('relative border-t border-white/10 bg-ink', className)}>
      {/* One brand line along the top, which is the whole of the decoration
          this needs: it says where the page ends without a slab of colour. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/50 to-transparent"
      />

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            {/* The wordmark as type rather than as a picture, with the line
                under it. It stays sharp at any size and takes the theme
                with it, which the drawn lockup cannot. */}
            <Wordmark to="/" className="h-6" always />
            <p className="mt-3.5 font-display text-sm font-extrabold text-white/70">
              The game built by players
            </p>
            <p className="mt-5 text-xs text-white/30">© {year} Kobblon</p>
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
