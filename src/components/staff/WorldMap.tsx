/*
 * Where people are, roughly, on a map of the world.
 *
 * The outline is `public/brand/world.svg` - land only, generated from the
 * public-domain Natural Earth data at 1:110m and drawn in plain
 * equirectangular coordinates, so a point is `lon + 180, 90 - lat` and
 * nothing has to project anything at runtime.
 *
 * What the dots are, said plainly because a console that implies more than
 * it knows is worse than no console:
 *
 *   * One dot per **time zone**, not per person, sized by how many accounts
 *     have been seen there. A map with a dot per account is a map that says
 *     where one person lives, and nobody needs that.
 *   * The position is the **zone's** own coordinates from the tz database -
 *     everybody in Europe/Paris is at Paris.
 *   * The zone is what the browser reports, which is a setting on somebody's
 *     machine. It is a hint. Anybody can change it, and some people do.
 */
import { asset } from '@/lib/asset'
import { placeOfZone } from '@/lib/places'
import { cn } from '@/lib/cn'

export type Dot = { zone: string; country: string | null; how_many: number }

export function WorldMap({ dots, className }: { dots: Dot[]; className?: string }) {
  const placed = dots
    .map((dot) => ({ ...dot, at: placeOfZone(dot.zone) }))
    .filter((dot): dot is Dot & { at: NonNullable<ReturnType<typeof placeOfZone>> } => !!dot.at)

  const most = Math.max(1, ...placed.map((one) => one.how_many))

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-ink-line bg-ink-raised', className)}>
      {/* The land, tinted by the page rather than painted into the file. */}
      <img
        src={asset('/brand/world.svg')}
        alt=""
        aria-hidden="true"
        className="block w-full select-none opacity-25 [filter:brightness(0)_invert(1)]"
        draggable={false}
      />

      <svg
        viewBox="0 0 360 180"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Roughly where people are"
      >
        {placed.map((dot) => {
          // Area with the count, not radius: a dot twice as wide is four
          // times the ink, and reads as four times the people.
          const size = 1.2 + 3.2 * Math.sqrt(dot.how_many / most)
          return (
            <g key={dot.zone}>
              <circle
                cx={dot.at.lon + 180}
                cy={90 - dot.at.lat}
                r={size * 2.2}
                className="fill-brand-bright/15"
              />
              <circle
                cx={dot.at.lon + 180}
                cy={90 - dot.at.lat}
                r={size}
                className="fill-brand-bright/80"
              >
                <title>
                  {dot.at.countryName} · {dot.zone} · {dot.how_many}
                </title>
              </circle>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
