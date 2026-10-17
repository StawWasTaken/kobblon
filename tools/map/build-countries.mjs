/*
 * The world, one path per country, with the country's own code on it.
 *
 * `public/brand/world.svg` is land only - one path, no borders, nothing to
 * address. A map that shades a country by how many people are there needs
 * each country separately and needs to be able to find it by the code the
 * rest of the site already speaks, which is ISO alpha-2 (`FR`, `US`), the
 * same code `placeOfZone` answers with.
 *
 * Natural Earth at 1:50m, through `world-atlas`, which is public domain.
 * 1:50m rather than the 1:110m the land silhouette was drawn from, because
 * 110m has no Hong Kong, no Singapore, no Macau and no Malta - and Hong
 * Kong is the second biggest thing on this map today. A country that is
 * simply absent reads as a country with nobody in it.
 * The projection is none: plain equirectangular, `x = lon + 180`,
 * `y = 90 - lat`, so the viewBox is 0 0 360 180 and nothing is projected at
 * runtime. The same frame `world.svg` uses, so the dots that were drawn on
 * that one land in the same places on this one.
 *
 * Run it with `node tools/map/build-countries.mjs`. It is not part of the
 * build: the file it writes is committed, because a map that needs three
 * packages installed to exist is a map that breaks somebody else's build.
 */
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import { presimplify, simplify, quantile } from 'topojson-simplify'

const require = createRequire(import.meta.url)
/*
 * Simplified before anything is drawn, and simplified as a *topology* -
 * which is the whole reason the data is one. Simplify each country's
 * outline on its own and France and Spain stop agreeing about where the
 * border is: two coastlines, a gap of sea between them. Here the shared
 * arc is simplified once and both countries keep using it.
 *
 * The quantile is how much detail goes: 0.3 keeps the three tenths of
 * points that matter most to the shape, which at this size is every bend
 * anybody can see and a fifth of the file.
 */
const raw = require('world-atlas/countries-50m.json')
const weighted = presimplify(raw)
const topology = simplify(weighted, quantile(weighted, 0.3))
const iso = require('i18n-iso-countries')

/*
 * One decimal of a degree, which is a tenth of a viewBox unit. The map is
 * drawn about a thousand pixels wide for 360 units, so that is a third of a
 * pixel - finer than anything anybody can see, and it takes the file from
 * 1.2MB to something a staff page can fetch without thinking about it.
 */
const PLACES = 1

/*
 * d3 does the drawing, and it is here because the first version did not.
 *
 * `x = lon + 180` is right for every country that does not cross the
 * antimeridian and badly wrong for the three that do. Russia's outline
 * runs off the right edge at +180 and carries on from -180, so laying its
 * points down in order draws a line straight back across the whole map and
 * fills everything under it: Staw saw it as a grey band lying across Europe
 * and Africa, and Fiji and Antarctica each left one of their own.
 *
 * `geoEquirectangular` with `geoPath` cuts a ring at the antimeridian and
 * closes each half against the edge, which is the whole of the fix. The
 * frame is the same one as before - 360 by 180, no rotation - so every
 * other country lands exactly where it did.
 */
const projection = geoEquirectangular()
  .scale(180 / Math.PI)
  .translate([180, 90])
const draw = geoPath(projection)

/** The path, with its numbers cut down to what anybody can see. */
function trimmed(d) {
  return d.replace(/-?\d+\.\d+/g, (n) => String(Number(Number(n).toFixed(PLACES))))
}

/*
 * An island smaller than this is a rounding artefact at the size this is
 * drawn: a sliver of one or two points that the rounding has flattened into
 * a line. Dropping them is what keeps the file honest rather than full of
 * invisible marks. Measured in square viewBox units, which `geoPath.area`
 * answers in directly.
 */
const TOO_SMALL = 0.0004

function pathOf(geometry) {
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates
  const kept = polygons.filter(
    (rings) => draw.area({ type: 'Polygon', coordinates: rings }) > TOO_SMALL,
  )
  if (!kept.length) return ''
  return trimmed(draw({ type: 'MultiPolygon', coordinates: kept }) ?? '')
}

const countries = feature(topology, topology.objects.countries).features
/*
 * The same countries before anything was thinned out, to fall back on.
 *
 * Simplifying a topology drops the points a shape is made of, and a country
 * small enough is made of few enough that it loses all of them and
 * disappears. Macau went that way: two thousandths of a square unit, and
 * the file had no Macau in it at all. A country that is simply absent reads
 * as a country with nobody in it, which is the one thing this map must
 * never say, so the handful that vanish are drawn from the full outline
 * instead. They are tiny; it costs nothing.
 */
const unthinned = new Map(
  feature(raw, raw.objects.countries).features.map((one) => [String(one.id), one]),
)
const paths = []
const missed = []

for (const one of countries) {
  const code = iso.numericToAlpha2(String(one.id).padStart(3, '0'))
  if (!code) {
    missed.push(one.properties?.name ?? one.id)
    continue
  }
  const whole = unthinned.get(String(one.id))
  const d = pathOf(one.geometry) || (whole ? pathOf(whole.geometry) : '')
  if (!d) continue
  paths.push(`<path id="${code}" d="${d}"/>`)
}

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180" '
  + 'preserveAspectRatio="xMidYMid meet">'
  + paths.join('')
  + '</svg>'

writeFileSync('public/brand/world-countries.svg', svg)
console.log(`${paths.length} countries written, ${(svg.length / 1024).toFixed(0)}KB`)
if (missed.length) console.log(`no code for: ${missed.join(', ')}`)
