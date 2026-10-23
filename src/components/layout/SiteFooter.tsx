import { Link } from 'react-router-dom'
import { faDiscord, faYoutube } from '@fortawesome/free-brands-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import { Wordmark } from '@/components/brand/Wordmark'
import { cn } from '@/lib/cn'

/*
 * One foot for the whole site.
 *
 * Staw's shape, and the reason for each column: the lockup and the
 * copyright on the left; the pages of Kobblon itself that a stranger can
 * reach without an account; the About pages, which are what Kobblon says
 * about itself; and where we are elsewhere.
 *
 * Only places that exist are listed. The wiki, the newsroom and the forum
 * are ideas, so they are not here - a link to a page nobody has built is
 * worse than no link.
 */

const kobblon = [
  { to: '/discover', label: 'Play' },
  { to: '/create', label: 'Create' },
  { to: '/communities', label: 'Communities' },
  { to: '/people', label: 'People' },
  { to: '/download', label: 'Download' },
]

const about = [
  { to: '/about', label: 'What Kobblon is' },
  { to: '/support', label: 'Support' },
  { to: '/policies', label: 'The rules' },
  { to: '/terms', label: 'Terms of Use' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/guidelines', label: 'Community guidelines' },
  { to: '/standing', label: 'Your standing' },
]

/** Ours, elsewhere. Every one of these is a real address. */
const social: { href: string; label: string; icon: IconDefinition }[] = [
  { href: 'https://discord.gg/SsjvR6rmez', label: 'Discord', icon: faDiscord },
  {
    href: 'https://www.youtube.com/channel/UCjFPtUjIY7mDFFOv-LuB7hQ',
    label: 'YouTube',
    icon: faYoutube,
  },
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
          <Column heading="About" links={about} />

          <div>
            <Heading>Social</Heading>
            <ul className="mt-4 space-y-2.5">
              {social.map((one) => (
                <li key={one.href}>
                  <a
                    href={one.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group flex items-center gap-2.5 text-sm font-semibold text-white/55 transition-colors hover:text-brand-bright"
                  >
                    <Glyph
                      icon={one.icon}
                      className="h-4 w-4 text-white/35 transition-colors group-hover:text-brand-bright"
                    />
                    {one.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
