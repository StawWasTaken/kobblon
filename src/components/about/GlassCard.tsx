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
 * The words go at the **bottom**, in the dark end of the render. Staw's
 * three pieces are lit the same way - the object in the upper half, the
 * gradient falling to near black underneath - so there is a place for type
 * already in the picture, and nothing has to be dimmed to make one.
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
        'group relative block overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line',
        'transition-[border-color,transform] hover:-translate-y-1 hover:border-brand-bright/50',
      )}
    >
      <img
        src={asset(art)}
        alt={alt}
        loading="lazy"
        className="w-full transition-transform duration-700 ease-out group-hover:scale-105"
      />

      {/*
        * The words sit in the bottom of the render, not over the top of it.
        *
        * Staw: "i want the text to be into the shadow area of the image
        * (bottom part)". These renders are all built the same way - the
        * object lit in the upper half, the gradient falling to near black
        * underneath - so the bottom third is already a place for text to
        * live. Putting them there means the picture is never covered and
        * the words are never fighting the light.
        *
        * Which is also why there is still no scrim. An earlier version
        * dimmed the top two thirds of each render to hold four lines of
        * text, and that is paying for a thing the picture gives away. The
        * words keep a shadow of their own for the one card whose dark end
        * is not quite dark.
        */}
      <div className="absolute inset-x-0 bottom-0 p-5 [text-shadow:0_2px_12px_rgba(0,0,0,0.85)]">
        <p className="font-display text-2xl font-extrabold">{name}</p>
        <p className="mt-1.5 max-w-xs text-sm leading-snug text-white/80">{body}</p>
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-brand-bright">
          {cue}
          <Glyph icon={faArrowRight} className="text-xs transition-transform group-hover:translate-x-1" />
        </p>
      </div>
    </Link>
  )
}
