import { Link } from 'react-router-dom'
import { Wordmark } from '@/components/brand/Wordmark'
import { policies } from '@/content/policies'
import { cn } from '@/lib/cn'

/*
 * One foot for the whole logged out side.
 *
 * Everything that is not part of using Kobblon lives here, grouped, once.
 * There is one address per policy and this is the place that lists them, so
 * nobody has to guess whether the privacy page they are looking at is the
 * same one somebody linked them.
 */

const site = [
  { to: '/discover', label: 'Discover' },
  { to: '/create', label: 'Create' },
  { to: '/communities', label: 'Communities' },
  { to: '/people', label: 'People' },
  { to: '/style', label: 'Style' },
]

const help = [
  { to: '/support', label: 'Support' },
  { to: '/standing', label: 'Account status' },
  { to: '/signup', label: 'Make an account' },
  { to: '/login', label: 'Log in' },
]

function Column({ heading, links }: {
  heading: string
  links: { to: string; label: string }[]
}) {
  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
        {heading}
      </p>
      <ul className="mt-3 space-y-2">
        {links.map((one) => (
          <li key={one.to}>
            <Link to={one.to} className="text-sm text-white/55 transition-colors hover:text-white">
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
    <footer className={cn('border-t border-white/10 bg-ink', className)}>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            {/* A line of its own, so the name stays the name at every width. */}
            <Wordmark to="/" className="h-5" always />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
              A place to make something, put it somewhere, and have people turn up to see it.
            </p>
            <p className="mt-5 font-display text-xs font-extrabold uppercase tracking-[0.18em] text-brand-bright">
              Make Something Nobody Else Has
            </p>
          </div>

          <Column heading="Kobblon" links={site} />
          <Column
            heading="Policies"
            links={policies.map((one) => ({ to: `/policies/${one.slug}`, label: one.title }))}
          />
          <Column heading="Help" links={help} />
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-xs text-white/35">
          <p>© {year} Kobblon</p>
          <Link to="/policies" className="hover:text-white">All policies</Link>
          <p className="sm:ml-auto">
            Kobblon is for people aged 15 and over.
          </p>
        </div>
      </div>
    </footer>
  )
}
