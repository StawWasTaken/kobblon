/*
 * The world by country, shaded by how much of Kobblon is in each one.
 *
 * The map before this was a dot per time zone on a silhouette of the land,
 * which answers "where is somebody" and not "where is Kobblon". Staw asked
 * for the second one: proper borders, and a country lit more or less
 * strongly by its share of everybody.
 *
 * `public/brand/world-countries.svg` is one path per country with the ISO
 * alpha-2 code as its id - the same code `placeOfZone` answers with - drawn
 * in plain equirectangular coordinates so nothing is projected here. It is
 * fetched rather than imported: it is 135KB of outlines that only staff
 * ever see, and a staff map is not worth that in everybody's bundle.
 *
 * What it is actually showing, said plainly:
 *
 *   * A country's share is **accounts seen in its time zones**, not
 *     addresses. The zone is a setting on somebody's machine; anybody can
 *     change it and some people do.
 *   * A country nobody has been seen in is drawn, in the flat colour of
 *     land. Leaving it out would read as water.
 */
import { useEffect, useMemo, useState } from 'react'
import { asset } from '@/lib/asset'
import { countryName, placeOfZone } from '@/lib/places'
import { cn } from '@/lib/cn'

export type CountryShare = {
  code: string
  name: string
  how_many: number
  /** Of everybody counted, between 0 and 1. */
  share: number
}

type Shape = {
  code: string
  d: string
  /** Where to put a marker for a country too small to see. */
  at: { x: number; y: number }
  /** The widest it gets, in viewBox units, so "too small" has a number. */
  across: number
}

/*
 * A country smaller than this is a mark of under two pixels at the size
 * this map is drawn. Hong Kong is the second biggest thing on it today and
 * is about half a unit across: without this it is a country with seven
 * accounts in it and nothing on screen at all.
 */
const TOO_SMALL = 1.6

/** Where a path is and how big, read off the numbers in it. */
function measure(d: string) {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  let minX = Infinity; let maxX = -Infinity
  let minY = Infinity; let maxY = -Infinity
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    const x = numbers[i]
    const y = numbers[i + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (!Number.isFinite(minX)) return { at: { x: 0, y: 0 }, across: 0 }
  return {
    at: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    across: Math.max(maxX - minX, maxY - minY),
  }
}

/*
 * Read once per tab. The file never changes between two renders of the same
 * page, and parsing 174 paths twice because a panel re-mounted is work
 * nobody asked for.
 */
let shapesOnce: Promise<Shape[]> | null = null

function loadShapes(): Promise<Shape[]> {
  if (shapesOnce) return shapesOnce
  shapesOnce = fetch(asset('/brand/world-countries.svg'))
    .then((said) => (said.ok ? said.text() : Promise.reject(new Error(String(said.status)))))
    .then((text) => {
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
      return [...doc.querySelectorAll('path')]
        .map((path) => {
          const d = path.getAttribute('d') ?? ''
          return { code: path.id, d, ...measure(d) }
        })
        .filter((one) => one.code && one.d)
    })
    .catch(() => {
      // Let the next mount try again rather than remembering the failure.
      shapesOnce = null
      return []
    })
  return shapesOnce
}

/** Zone rows rolled up into countries, which is what the map draws. */
export function sharesByCountry(
  rows: { zone: string; country: string | null; how_many: number }[],
): CountryShare[] {
  const counts = new Map<string, { name: string; how_many: number }>()

  for (const row of rows) {
    const place = placeOfZone(row.zone)
    const code = place?.country ?? row.country
    if (!code) continue
    const held = counts.get(code)
    counts.set(code, {
      name: place?.countryName ?? countryName(code) ?? code,
      how_many: (held?.how_many ?? 0) + row.how_many,
    })
  }

  const total = [...counts.values()].reduce((sum, one) => sum + one.how_many, 0)
  return [...counts.entries()]
    .map(([code, one]) => ({
      code,
      name: one.name,
      how_many: one.how_many,
      share: total ? one.how_many / total : 0,
    }))
    .sort((a, b) => b.how_many - a.how_many)
}

export function CountryMap({ countries, active, onHover, className }: {
  countries: CountryShare[]
  active?: string | null
  onHover?: (code: string | null) => void
  className?: string
}) {
  const [shapes, setShapes] = useState<Shape[] | null>(null)

  useEffect(() => {
    let wanted = true
    void loadShapes().then((got) => { if (wanted) setShapes(got) })
    return () => { wanted = false }
  }, [])

  const byCode = useMemo(() => {
    const map = new Map<string, CountryShare>()
    for (const one of countries) map.set(one.code, one)
    return map
  }, [countries])

  /*
   * The strongest country is the full colour and everything else is read
   * against it, rather than against 100% - with nine countries and one of
   * them on a third of everybody, a scale to 100% leaves the whole map
   * nearly black and says nothing.
   *
   * The square root is the same reason a dot was sized by area: a country
   * with half the people should not look like it has none.
   */
  const most = Math.max(...countries.map((one) => one.share), 0.0001)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-ink-line bg-ink-raised',
        className,
      )}
      onMouseLeave={() => onHover?.(null)}
    >
      <svg
        viewBox="0 0 360 180"
        className="block h-auto w-full"
        role="img"
        aria-label="Where Kobblon is, by country"
      >
        {/* The sea, so the land has something to be an island in. */}
        <rect x="0" y="0" width="360" height="180" className="fill-ink" />

        {shapes?.map((shape) => {
          const here = byCode.get(shape.code)
          const lit = active === shape.code
          const strength = here ? Math.sqrt(here.share / most) : 0
          return (
            <path
              key={shape.code}
              d={shape.d}
              vectorEffect="non-scaling-stroke"
              onMouseEnter={() => onHover?.(shape.code)}
              style={{
                fill: here
                  ? `rgba(59, 108, 255, ${(0.18 + strength * 0.8).toFixed(3)})`
                  : 'rgba(255, 255, 255, 0.07)',
              }}
              className={cn(
                'transition-[stroke,filter] duration-150',
                lit
                  ? '[stroke:#fff] [stroke-width:0.9px] [filter:brightness(1.35)]'
                  : '[stroke:rgba(0,0,0,0.55)] [stroke-width:0.35px]',
              )}
            >
              <title>
                {here
                  ? `${here.name} · ${here.how_many} · ${(here.share * 100).toFixed(0)}%`
                  : shape.code}
              </title>
            </path>
          )
        })}
        {/*
          * A ring for a country too small to be a shape here. Same colour,
          * same hover, and only where there is somebody - the map is not
          * going to sprout a hundred rings over empty islands.
          */}
        {shapes?.map((shape) => {
          const here = byCode.get(shape.code)
          if (!here || shape.across > TOO_SMALL) return null
          const lit = active === shape.code
          return (
            <circle
              key={`${shape.code}-mark`}
              cx={shape.at.x}
              cy={shape.at.y}
              r={lit ? 2.6 : 2}
              onMouseEnter={() => onHover?.(shape.code)}
              className={cn(
                'transition-[r] duration-150',
                lit ? 'fill-white' : 'fill-brand-bright',
              )}
            >
              <title>
                {here.name} · {here.how_many} · {(here.share * 100).toFixed(0)}%
              </title>
            </circle>
          )
        })}
      </svg>

      {!shapes && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="animate-pulse text-xs text-muted">Drawing the world…</span>
        </div>
      )}
    </div>
  )
}
