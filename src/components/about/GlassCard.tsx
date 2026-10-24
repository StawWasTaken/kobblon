import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'

/**
 * One of Staw's glass pieces, with the words on it.
 *
 * The first version put the picture at the top and the words underneath,
 * which makes three cards that are a picture *and* a caption - two
 * objects. Staw: "i want the text to actually be inside of the cards and
 * ontop". It is one object now: the render is the card, the words sit on
 * it, and the card is exactly as tall as the picture Staw drew.
 *
 * The words go at the **top** because of how these are lit. All three
 * renders are black at the top and bright at the bottom, so the top is
 * where type can sit at full white with nothing behind it fighting. A
 * scrim is there anyway for the one that is lighter than the others, and
 * it is a gradient rather than a flat panel - a flat panel over a lit
 * render is a grey box on a glowing thing.
 */
export function GlassCard({ to, art, alt, name, body, cue = 'Look' }: {
  to: string
  art: string
  alt: string
  name: string
  body: string
  cue?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative block overflow-hidden rounded-3xl border border-white/10',
        'transition-[border-color,transform] hover:-translate-y-1 hover:border-brand-bright/50',
      )}
    >
      <img
        src={asset(art)}
        alt={alt}
        loading="lazy"
        className="w-full transition-transform duration-700 ease-out group-hover:scale-105"
      />

      {/* Dark at the top, so the words hold whatever the render does. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-ink/85 via-ink/45 to-transparent" />

      <div className="absolute inset-x-0 top-0 p-7">
        <p className="font-display text-2xl font-extrabold">{name}</p>
        <p className="mt-3 max-w-xs leading-relaxed text-white/70">{body}</p>
        <p className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-brand-bright">
          {cue}
          <Glyph icon={faArrowRight} className="text-xs transition-transform group-hover:translate-x-1" />
        </p>
      </div>
    </Link>
  )
}
