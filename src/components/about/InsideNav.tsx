import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Band } from './Band'
import { Reveal } from './Reveal'
import { Eyebrow } from './Type'
import { asset } from '@/lib/asset'

/**
 * The other two, at the bottom of each of the three.
 *
 * Being inside Kobblon is three things at once - you are safe, there is
 * somewhere to go, and what you make is worth something - so a page about
 * one of them that ends in nothing is a page that has only told a third of
 * it. This is the way across, and it never offers the page you are on.
 */
export const INSIDE = [
  {
    slug: 'report',
    name: 'Report',
    art: '/about/report.webp',
    line: 'How we keep this a decent place to be.',
  },
  {
    slug: 'play',
    name: 'Play',
    art: '/about/play.webp',
    line: 'Worlds people built, and everybody in them.',
  },
  {
    slug: 'brix',
    name: 'Brix',
    art: '/about/brix.webp',
    line: 'What Kobblon runs on, and who gets paid.',
  },
] as const

export function InsideNav({ not }: { not: string }) {
  const rest = INSIDE.filter((one) => one.slug !== not)

  return (
    <Band tone="raised" edge>
      <Reveal>
        <Eyebrow className="mb-6">Inside Kobblon</Eyebrow>
      </Reveal>
      <div className="grid gap-4 sm:grid-cols-2">
        {rest.map((one, at) => (
          <Reveal key={one.slug} delay={at * 80}>
            <Link
              to={`/about/${one.slug}`}
              className="group flex items-center gap-5 overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-4 transition-colors hover:border-brand-bright/60"
            >
              <img
                src={asset(one.art)}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="h-20 w-20 shrink-0 rounded-xl object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="min-w-0">
                <p className="font-display text-xl font-extrabold">{one.name}</p>
                <p className="mt-1 text-sm text-white/60">{one.line}</p>
              </div>
              <Glyph
                icon={faArrowRight}
                className="ml-auto mr-2 shrink-0 text-brand-bright transition-transform group-hover:translate-x-1"
              />
            </Link>
          </Reveal>
        ))}
      </div>
    </Band>
  )
}
