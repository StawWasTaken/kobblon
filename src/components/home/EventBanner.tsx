import { Link } from 'react-router-dom'
import { Icon } from '@/components/brand/Icon'
import { themeOf, type PlatformEvent } from '@/lib/event'
import { eventShowing } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'

/**
 * The thing Kobblon is running, across the top of Home.
 *
 * Staw asked for "an header on the homepage (like roblox did ...) that
 * leads either to the kobblon event either to the forum category for it",
 * and then handed over the reference for the shape he means: a wide band
 * that is all picture, a small pill in the top corner, a large name and
 * one line under it, a single solid button at the foot, the thing's own
 * mark in the opposite corner, and a quiet line of small print diagonally
 * across from the pill. Five places, each with one job, and the art
 * running out past the edge so the band reads as a window rather than a
 * card with a photograph in it.
 *
 * That is what this is, unchanged. What changed is where the words come
 * from: Staw: "keep the design avatar contest header in the homepage but
 * make it so superadmins can make their own in the staff command and make
 * it if it appears or not". So the design is the same design and the
 * contents are a row that `platform_event_showing()` hands over - at most
 * one, switched on, and not past its end date.
 *
 * It draws nothing at all while that read is in the air, and nothing if it
 * comes back empty or fails. A band is the first thing on the page and the
 * widest, so a skeleton for it is a grey slab that pushes the whole
 * homepage down and then moves it back up again; and a band that renders
 * with no event in it is furniture.
 *
 * The colour and the marks come from the row's theme rather than from
 * here, because somebody writing a Christmas contest in the staff console
 * cannot come back and edit this file. The three themes are the three sets
 * of marks the build ships - a named theme and not a path somebody types,
 * which would be a field that can name a picture that is not there.
 *
 * It is the whole band and also a button. The band being clickable is
 * what makes it read as one object; the button is what says so to
 * somebody tabbing, and to anybody who has learned that a picture is
 * usually not a link. Nested links are illegal in HTML, so the button is
 * a span inside the one anchor rather than a second one.
 */
export function EventBanner({ className }: { className?: string }) {
  const { data: event } = useAsync(() => eventShowing(), [])
  if (!event) return null
  return <EventBand event={event} className={className} />
}

/**
 * The band itself, given an event rather than reading for one.
 *
 * Split out because the staff panel draws it too, over a form, while the
 * words are still being typed - which is the only honest way to let
 * somebody write one of these: a textarea and a colour name tell you
 * nothing about whether the heading fits on two lines.
 */
export function EventBand({ event, className, flat }: {
  event: Pick<PlatformEvent, 'tag' | 'name' | 'blurb' | 'action' | 'theme' | 'prizes'>
    & { link?: string }
    & Partial<Pick<PlatformEvent, 'art_url' | 'back_url' | 'back_colour' | 'note'>>
  className?: string
  /** Draws it without the link, for the preview in the staff console. */
  flat?: boolean
}) {
  const look = themeOf(event.theme)
  /* Its own picture where one has been uploaded, and the theme's where one
   * has not. Staw: "for the art i want it to be an image i can upload. same
   * thing for the background (keep normal+customize it or upload one)". */
  const art = event.art_url || asset(look.mark)
  const back = event.back_url || null

  const inside = (
    <>
      {/*
        * Everything that has to stop at the band's edge, in one clipped
        * layer: the background picture, the theme's light and the darkening
        * the words sit on. The band itself is not clipped any more, because
        * the art has to be able to leave it at the top - see below.
        */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      >
        {/*
          * A background of its own, under everything else. Covering rather
          * than tiled or contained, because the band is one shape at every
          * width and a picture that letterboxes inside it leaves two bars of
          * flat colour that nothing else on the homepage has.
          */}
        {!!back && (
          <img
            src={back}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
          />
        )}

        {/* The theme's light is drawn over the theme's colour and not over
            somebody's photograph: a radial orange wash on top of a picture
            that was chosen is the theme overruling the choice. */}
        {!back && <span className={cn('absolute inset-0', look.glow)} />}

        {/* The flat darkening from the left, so the words sit on something
            rather than on the brightest part of the picture. */}
        <span className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-black/35" />
      </span>

      {/*
        * The art, and the one layer on this band with a rule of its own.
        *
        * Staw: "i meant for the image to not be cut at the top by the header
        * but to still be cut at the bottom". So this layer's bottom edge is
        * the band's bottom edge and it clips there, while its top sits well
        * above the band and clips nothing - the picture rises out of the top
        * of the band like something standing behind it, and is cut off level
        * with the floor.
        *
        * The two numbers go together: the layer starts `6rem` above the
        * band, so `top-[4.5rem]` inside it is `1.5rem` above the band's own
        * top - which is exactly where the art used to be drawn before it was
        * clipped off there.
        *
        * `select-none` and no alt text: it is the picture the band is made
        * of, and a screen reader reading "Kobblon" twice between the tag and
        * the heading is noise.
        */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[-6rem] overflow-hidden"
      >
        <img
          src={art}
          alt=""
          draggable={false}
          className={cn(
            'absolute right-[22%] top-[4.5rem] hidden h-[17rem] w-auto select-none',
            'opacity-90', look.halo,
            'transition-transform duration-500 group-hover:scale-[1.03] sm:block',
          )}
        />
      </span>

      {/* The event's own mark, where the reference puts the thing's name. */}
      {!!look.wordmark && (
        <img
          src={asset(look.wordmark)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute right-5 top-5 h-7 w-auto select-none opacity-90 sm:right-7 sm:top-6 sm:h-9"
        />
      )}

      <div className="relative flex min-h-[13rem] flex-col justify-center px-5 py-6 sm:min-h-[15.5rem] sm:px-9 sm:py-8">
        {/*
          * The pill. White on the picture rather than a tinted chip,
          * because it has to hold against whatever the art is doing
          * behind it - which is the one thing the reference's own pill is
          * doing that a coloured one would not survive.
          */}
        <span className="inline-flex w-fit items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-black">
          {event.tag}
        </span>

        <h2 className="mt-5 max-w-[22ch] font-display text-3xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] sm:text-[2.75rem]">
          {event.name}
        </h2>
        {!!event.blurb && (
          <p className="mt-2 max-w-[46ch] text-sm font-semibold leading-snug text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
            {event.blurb}
          </p>
        )}

        {/*
          * Blue, not the theme's colour. The whole band is already wearing
          * that; blue is Kobblon and is what every other thing to press on
          * this site is, which is the half of the reference worth keeping -
          * its one button is not in the picture's colour either.
          *
          * Built like every other button on the site rather than like a
          * rectangle: the 3px of `brand-ink` under it that goes away on
          * the press while the face drops the same 3px, which is the
          * thing that makes ours look like something to push. It cannot
          * be `<Button>` - that renders a button or a link and this is
          * already inside the anchor that is the whole band - so it is
          * `primary` at `lg`, by hand, and the press comes off the
          * band's own `group` because the band is what is being pressed.
          */}
        <span
          className={cn(
            'mt-6 inline-flex h-12 w-fit select-none items-center justify-center rounded-xl px-10',
            /* Staw: "for the button on the event header the font of the
               text should be the pixel one we use often" - the display
               face, which is what every heading on the site is set in and
               what the band's own name above it is already wearing. */
            'bg-brand font-display text-lg font-extrabold tracking-wide text-white',
            'border-b-[3px] border-brand-ink shadow-lg shadow-black/30',
            'transition-[background-color,transform,box-shadow] duration-150',
            'group-hover:bg-brand-bright',
            'group-active:mt-[1.6875rem] group-active:translate-y-px group-active:border-b-0',
          )}
        >
          {event.action}
        </span>
      </div>

      {/*
        * The small print, across from the pill. The reference has its
        * maturity rating there; ours is what there is to win, because
        * that is the fact somebody deciding whether to enter wants and
        * there is nowhere else on the band to put it.
        *
        * Not drawn at all where nothing is being given away - three empty
        * chips under a contest with no prize is furniture.
        */}
      {!event.prizes.length && !!event.note && (
        <p className="pointer-events-none absolute bottom-4 right-5 hidden max-w-[26ch] text-right text-[11px] font-bold text-white/60 sm:right-7 sm:block">
          {event.note}
        </p>
      )}

      {!!event.prizes.length && (
        <div className="pointer-events-none absolute bottom-4 right-5 hidden items-center gap-3 sm:right-7 sm:flex">
          {event.prizes.map((prize) => (
            <span
              key={prize.place}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/70"
            >
              <span className="text-white/40">{prize.place}</span>
              <Icon name="brix" className="h-3.5 w-3.5 text-amber-300" />
              {/*
                * Written out, not shortened. `formatCount` turns 10,000
                * into "10K" and leaves 5,000 and 2,500 alone, which puts
                * three numbers side by side in two different notations -
                * and the largest prize, the one the row exists for, was
                * the one that stopped looking like money.
                */}
              <span className="tabular-nums text-white">
                {prize.brix.toLocaleString('en-GB')}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* On a phone there is no room beside the art, so the small print
          sits under the words instead of in the corner. */}
      {!event.prizes.length && !!event.note && (
        <p className="relative px-5 pb-5 text-[11px] font-bold text-white/60 sm:hidden">
          {event.note}
        </p>
      )}

      {!!event.prizes.length && (
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pb-5 sm:hidden">
          {event.prizes.map((prize) => (
            <span
              key={prize.place}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/70"
            >
              <span className="text-white/40">{prize.place}</span>
              <Icon name="brix" className="h-3.5 w-3.5 text-amber-300" />
              <span className="tabular-nums text-white">
                {prize.brix.toLocaleString('en-GB')}
              </span>
            </span>
          ))}
        </div>
      )}
    </>
  )

  const shell = cn(
    /* No `overflow-hidden` here: the art has to be able to rise out of the
       top edge. Everything that must stop at the edge is inside its own
       clipped layer above. */
    'group relative block rounded-2xl border transition-colors',
    /* A colour of its own beats the theme's, and a picture of its own
       covers both - so the class is only in the way when one is set. */
    !event.back_colour && look.back, look.edge, className,
  )
  const paint = event.back_colour ? { backgroundColor: event.back_colour } : undefined

  /* The preview is not a link: a band being written is not somewhere to go
   * yet, and a staff console that navigates away mid-sentence is rude. */
  if (flat) return <div className={shell} style={paint}>{inside}</div>

  return <Link to={event.link ?? '/'} className={shell} style={paint}>{inside}</Link>
}
