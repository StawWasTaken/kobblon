/*
 * Which version of Kobblon this is.
 *
 * Staw, 25 October: "show somewhere that the Kobblon website is at its
 * 'V3.4' right now and make that in december it'll be automatically in the
 * 'V3.5'". Then, the same day: "the 3.4 is actually the version of the
 * whole platform (includes website & launcher, the workspace is
 * different)".
 *
 * So this number is **the platform's**: the website and the Launcher move
 * on it together, and the Workspace keeps its own. That is why it is not
 * called the site version and why the footer does not say "website" - a
 * person reporting something quotes one number for the place they were in,
 * and two numbers for one platform is how a bug report ends up naming the
 * wrong half of it.
 *
 * A list of versions and the day each one starts, read against the clock
 * rather than written into the build. It is done this way for one reason:
 * the alternative is remembering to change a number on the first of
 * December, and the version somebody is looking at would be whatever was
 * last deployed rather than what Kobblon actually is. The deployed bundle
 * from November says 3.5 in December on its own.
 *
 * The clock is the viewer's, which means somebody whose machine is a day
 * ahead sees the new number a day early. That is the right trade for a
 * label: the only alternative is asking the server what day it is, and a
 * number in the foot of a page is not worth a request.
 *
 * It also means the Launcher can carry the same list and land on the same
 * answer without asking the website anything. If the two ever have to be
 * guaranteed identical rather than merely kept the same, this moves to an
 * RPC and both sides read that instead.
 *
 * Adding one: put it at the top with the day it starts. The list is read
 * downwards and the first one that has begun wins, so it stays in date
 * order, newest first.
 */
const releases: { from: string; name: string }[] = [
  { from: '2026-12-01', name: '3.5' },
  { from: '2026-10-01', name: '3.4' },
]

/** The current platform version, as `3.4`. */
export function platformVersion(now: Date = new Date()): string {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return (releases.find((one) => one.from <= today) ?? releases[releases.length - 1]).name
}

/** The current platform version, as `V3.4`, which is how Staw writes it. */
export function platformVersionLabel(now: Date = new Date()): string {
  return `V${platformVersion(now)}`
}
