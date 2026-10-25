/*
 * Which version of the website this is.
 *
 * Staw, 25 October: "show somewhere that the Kobblon website is at its
 * 'V3.4' right now and make that in december it'll be automatically in the
 * 'V3.5'".
 *
 * A list of versions and the day each one starts, read against the clock
 * rather than written into the build. It is done this way for one reason:
 * the alternative is remembering to change a number on the first of
 * December, and the version somebody is looking at would be whatever was
 * last deployed rather than what the site actually is. The deployed bundle
 * from November says 3.5 in December on its own.
 *
 * The clock is the viewer's, which means somebody whose machine is a day
 * ahead sees the new number a day early. That is the right trade for a
 * label: the only alternative is asking the server what day it is, and a
 * number in the foot of a page is not worth a request.
 *
 * Adding one: put it at the top with the day it starts. The list is read
 * downwards and the first one that has begun wins, so it stays in date
 * order, newest first.
 */
const releases: { from: string; name: string }[] = [
  { from: '2026-12-01', name: '3.5' },
  { from: '2026-10-01', name: '3.4' },
]

/** The current version, as `3.4`. */
export function siteVersion(now: Date = new Date()): string {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return (releases.find((one) => one.from <= today) ?? releases[releases.length - 1]).name
}

/** The current version, as `V3.4`, which is how Staw writes it. */
export function siteVersionLabel(now: Date = new Date()): string {
  return `V${siteVersion(now)}`
}
