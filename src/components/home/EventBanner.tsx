import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { eventNow } from '@/lib/event'
import { cn } from '@/lib/cn'

/**
 * The thing Kobblon is running, across the top of Home.
 *
 * Staw asked for "an header on the homepage (like roblox did ...) that
 * leads either to the kobblon event either to the forum category for it".
 * Roblox's is a wide picture with the name of the event on it and one way
 * in, and the part worth copying is the shape rather than the picture:
 * the whole band is the link, there is exactly one thing to do, and it
 * takes the top of the page without taking the fold.
 *
 * It is the whole band and also a button. The band being clickable is
 * what makes it read as one object; the button is what says so to
 * somebody tabbing, and to anybody who has learned that a picture is
 * usually not a link. Nested links are illegal in HTML, so the button is
 * a span inside the one anchor rather than a second one.
 *
 * No picture yet. Staw said a reference is coming, and a stock
 * photograph standing in for art he has not drawn is the fake thing the
 * ethos is about - so the band is the laurel, the colour and the words,
 * and the art drops in behind when it arrives.
 */
export function EventBanner({ className }: { className?: string }) {
  const event = eventNow()
  if (!event) return null

  return (
    <Link
      to={event.to}
      className={cn(
        'group relative block overflow-hidden rounded-2xl border border-orange-400/25',
        'bg-ink-card transition-colors hover:border-orange-400/50',
        className,
      )}
    >
      {/* The light behind it, and the one place on the site orange is spent. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(251,146,60,0.22),transparent_62%)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-orange-400"
      />

      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-4 py-5 pl-6 pr-5 sm:py-6 sm:pl-8">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-orange-400/30 bg-orange-400/10 text-orange-300 sm:h-14 sm:w-14">
          <Icon name="laurel-quest" className="h-6 w-6 sm:h-7 sm:w-7" />
        </span>

        <div className="min-w-0 flex-1 basis-56">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-300/80">
            {event.tag}
          </p>
          <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
            {event.name}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-snug text-white/55">{event.blurb}</p>

          {/*
            * The prizes, as the Brix they are. Our own mark beside each
            * number rather than the word, because that is how every other
            * amount on this site is written and a contest is not the
            * place to invent a second way of saying Brix.
            */}
          {!!event.prizes.length && (
            <ul className="mt-3 flex flex-wrap items-center gap-2">
              {event.prizes.map((prize) => (
                <li
                  key={prize.place}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 py-1 pl-2.5 pr-3 text-xs font-bold"
                >
                  <span className="text-white/40">{prize.place}</span>
                  <Icon name="brix" className="h-3.5 w-3.5 text-amber-300" />
                  {/*
                    * Written out, not shortened. `formatCount` turns
                    * 10,000 into "10K" and leaves 5,000 and 2,500 alone,
                    * which put three numbers side by side in two
                    * different notations - and the largest prize, the one
                    * the row exists for, was the one that stopped looking
                    * like money.
                    */}
                  <span className="tabular-nums text-white">
                    {prize.brix.toLocaleString('en-GB')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-extrabold text-black transition-colors group-hover:bg-orange-400">
          {event.action}
          <Glyph icon={faArrowRight} className="text-xs transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}
